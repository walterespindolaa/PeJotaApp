import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const termsVersion = typeof body?.termsVersion === "string" && body.termsVersion.trim()
      ? body.termsVersion.trim()
      : "1.0";

    const ipAddressRaw =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "";

    const ipAddress = ipAddressRaw.includes(",")
      ? ipAddressRaw.split(",")[0].trim()
      : ipAddressRaw.trim() || null;

    const userAgent = req.headers.get("user-agent") || null;

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: upsertError } = await adminClient
      .from("user_terms_acceptance")
      .upsert(
        {
          user_id: user.id,
          terms_version: termsVersion,
          accepted_at: new Date().toISOString(),
          ip_address: ipAddress,
          user_agent: userAgent,
        },
        { onConflict: "user_id,terms_version" }
      );

    if (upsertError) {
      return new Response(JSON.stringify({ error: upsertError.message }), { status: 400, headers: corsHeaders });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
