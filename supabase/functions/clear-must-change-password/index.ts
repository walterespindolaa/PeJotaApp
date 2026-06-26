import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    // Valida o JWT do usuário (ele precisa estar autenticado pra limpar a própria flag)
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    // Usa service role pra bypassar o trigger protect_sensitive_profile_columns
    const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    if (updateError) {
      console.error("[clear-must-change-password] update error:", updateError.message);
      return new Response(JSON.stringify({ error: "Falha ao atualizar perfil" }), { status: 500, headers: corsHeaders });
    }

    // Audit log (best-effort)
    try {
      await adminClient.from("audit_logs").insert({
        action: "must_change_password_cleared",
        target_user_id: userId,
        payload: { cleared_at: new Date().toISOString() },
      });
    } catch (_) {}

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
  } catch (err: any) {
    console.error("[clear-must-change-password] error:", err?.message);
    return new Response(JSON.stringify({ error: "Erro interno" }), { status: 500, headers: corsHeaders });
  }
});
