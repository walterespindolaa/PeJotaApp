import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: corsHeaders,
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAdmin = createClient(supabaseUrl, serviceKey);

  let body: { token?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400, headers: corsHeaders });
  }

  const { token, password } = body;

  if (!token || typeof token !== "string") {
    return new Response(JSON.stringify({ error: "token_required" }), { status: 400, headers: corsHeaders });
  }

  if (!password || typeof password !== "string" || password.length < 8) {
    return new Response(JSON.stringify({ error: "password_invalid" }), { status: 400, headers: corsHeaders });
  }

  // 1. CONSUME: marca token como usado (atomico, single-use). Falha se token ja usado/expirado.
  const { data: consumed, error: consumeErr } = await supabaseAdmin.rpc("consume_invite_token", { _token: token });

  if (consumeErr) {
    const isInvalid = consumeErr.message?.includes("invalid_or_expired_token");
    return new Response(
      JSON.stringify({ error: isInvalid ? "invalid_or_expired_token" : "consume_failed" }),
      { status: isInvalid ? 410 : 500, headers: corsHeaders },
    );
  }

  if (!consumed || consumed.length === 0) {
    return new Response(JSON.stringify({ error: "invalid_or_expired_token" }), { status: 410, headers: corsHeaders });
  }

  const { user_id, email } = consumed[0];

  // 2. Define a senha pela primeira vez (sem comparar com "old password" — esse era o bug)
  const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
    password,
    email_confirm: true,
  });

  if (updateErr) {
    console.error("[set-initial-password] updateUserById error:", updateErr.message);
    return new Response(
      JSON.stringify({ error: "password_set_failed", detail: updateErr.message }),
      { status: 500, headers: corsHeaders },
    );
  }

  // 3. Limpa flag must_change_password no profile
  await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq("user_id", user_id);

  // 4. Audit log (best-effort)
  try {
    await supabaseAdmin.from("audit_logs").insert({
      action: "initial_password_set",
      target_user_id: user_id,
      payload: { set_at: new Date().toISOString() },
    });
  } catch (_) {}

  // 5. Gera magic link tipo "magiclink" pra extrair access_token e refresh_token
  // SPA vai usar esses tokens pra setar sessao direto, sem signInWithPassword
  const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  if (linkErr || !linkData?.properties) {
    console.error("[set-initial-password] generateLink error:", linkErr?.message);
    // Mesmo sem o link, a senha foi definida com sucesso — user pode logar manualmente.
    // Retorna sucesso mas com flag pra SPA fallback pra signInWithPassword.
    return new Response(
      JSON.stringify({
        success: true,
        fallback: true,
        email,
      }),
      { headers: corsHeaders },
    );
  }

  // O properties.action_link contem URL com hash:
  // https://...#access_token=XXX&refresh_token=YYY&...
  // Em vez de fazer parse do hash, retornamos o hashed_token + email
  // pra SPA usar verifyOtp() — mais simples e oficial.
  const hashedToken = (linkData.properties as { hashed_token?: string }).hashed_token;

  if (!hashedToken) {
    return new Response(
      JSON.stringify({
        success: true,
        fallback: true,
        email,
      }),
      { headers: corsHeaders },
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      email,
      hashed_token: hashedToken,
    }),
    { headers: corsHeaders },
  );
});
