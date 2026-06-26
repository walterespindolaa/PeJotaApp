import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

// BCB SGS API series codes
const SERIES = {
  selic: 432,
  cdi: 4389,
  ipca: 433,
};

// fetch com timeout via AbortController — evita pendurar a function se a API do BCB travar.
async function fetchWithTimeout(url: string, timeoutMs = 9000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

async function fetchBCB(seriesCode: number): Promise<{ valor: number; data: string } | null> {
  try {
    const today = new Date();
    const endDate = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    const startDate = (() => {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 2);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    })();

    const url = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesCode}/dados?formato=json&dataInicial=${startDate}&dataFinal=${endDate}`;
    const res = await fetchWithTimeout(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const last = data[data.length - 1];
    const [dd, mm, yyyy] = last.data.split("/");
    return { valor: parseFloat(last.valor), data: `${yyyy}-${mm}-${dd}` };
  } catch (e) {
    console.error(`Error fetching BCB series ${seriesCode}:`, e);
    return null;
  }
}

serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: service_role OU x-cron-secret (cron) OU usuário admin (UI) ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isServiceRole = authHeader === `Bearer ${serviceKey}`;
    const isCronSecret = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
    const isCron = isServiceRole || isCronSecret;

    if (!isCron) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace("Bearer ", "");
      const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claims?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
      }
      const userId = claims.claims.sub as string;
      const { data: roleData } = await serviceClient
        .from("user_roles").select("role")
        .eq("user_id", userId).eq("role", "admin").maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
      }
    }

    const supabase = serviceClient;
    const results: Record<string, any> = {};

    for (const [name, code] of Object.entries(SERIES)) {
      const result = await fetchBCB(code);
      if (result) {
        results[name] = result;
        await supabase.from("indicadores_economicos").upsert(
          {
            indicador: name,
            valor: result.valor,
            data_referencia: result.data,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "indicador" }
        );
      }
    }

    return new Response(JSON.stringify({ success: true, data: results }), { headers: corsHeaders });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Internal server error" }),
      { status: 500, headers: corsHeaders }
    );
  }
});
