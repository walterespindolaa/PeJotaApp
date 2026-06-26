import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

// fetch com timeout via AbortController — evita pendurar a function se a BRAPI travar.
async function fetchWithTimeout(url: string, timeoutMs = 9000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  const corsHeaders = getCorsHeadersWithContentType(req);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const userId = claimsData.claims.sub as string;

  // Rate limit: 20/hour per user
  const rl = await checkRateLimit(userId, { scope: "get-macro-data", window: "hour", limit: 20 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const BRAPI_TOKEN = Deno.env.get("BRAPI_API_TOKEN");
    if (!BRAPI_TOKEN) throw new Error("BRAPI_API_TOKEN not configured");

    const now = new Date();
    const endDate = `${String(now.getDate()).padStart(2,"0")}/${String(now.getMonth()+1).padStart(2,"0")}/${now.getFullYear()}`;
    const startDate = "01/01/2020";

    const [selicRes, ipcaRes] = await Promise.all([
      fetchWithTimeout(`https://brapi.dev/api/v2/prime-rate?country=brazil&historical=true&start=${startDate}&end=${endDate}&sortBy=date&sortOrder=asc&token=${BRAPI_TOKEN}`),
      fetchWithTimeout(`https://brapi.dev/api/v2/inflation?country=brazil&historical=true&start=${startDate}&end=${endDate}&sortBy=date&sortOrder=asc&token=${BRAPI_TOKEN}`),
    ]);

    const [selicJson, ipcaJson] = await Promise.all([selicRes.json(), ipcaRes.json()]);

    console.log("selic raw:", JSON.stringify(selicJson).substring(0, 300));
    console.log("ipca raw:", JSON.stringify(ipcaJson).substring(0, 300));

    // BRAPI retorna date como "DD/MM/YYYY" e value como string
    const normalizeDate = (d: string) => {
      if (!d) return d;
      // "01/01/2024" -> "01/2024"
      const parts = d.split("/");
      if (parts.length === 3) return `${parts[1]}/${parts[2]}`;
      return d;
    };

    // Selic vem diária da BRAPI; agregamos pegando o último valor de cada mês.
    const selicDaily = ((selicJson["prime-rate"] || selicJson.primeRate || []) as any[])
      .map((d: any) => ({
        rawDate: String(d.date || d.Date || ""),
        value: Number(d.value ?? d.Value ?? 0),
      }))
      .filter(d => d.value > 0 && d.rawDate);

    const monthMap: Record<string, { date: string; value: number; sortKey: string }> = {};
    for (const d of selicDaily) {
      // BRAPI date format: "DD/MM/YYYY"
      const parts = d.rawDate.split("/");
      if (parts.length !== 3) continue;
      const [_, mm, yyyy] = parts;
      const key = `${yyyy}-${mm}`;
      // Mantém o último (já que dailyArr está em ordem cronológica asc)
      monthMap[key] = { date: `${mm}/${yyyy}`, value: d.value, sortKey: key };
    }
    const selic = Object.values(monthMap).sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ date, value }) => ({ date, value }));

    // IPCA do BRAPI retorna acumulado 12 meses — rotulamos adequadamente
    const ipca = ((ipcaJson.inflation || []) as any[])
      .map((d: any) => ({
        date: normalizeDate(d.date || d.Date || ""),
        value: Number(d.value || d.Value || 0),
      }))
      .filter(d => d.value > 0);

    return new Response(JSON.stringify({ selic, ipca }), {
      headers: corsHeaders,
    });

  } catch (err) {
    console.error("get-macro-data error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
