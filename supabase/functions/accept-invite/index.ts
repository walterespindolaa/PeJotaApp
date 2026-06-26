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

  let body: { token?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_body" }), { status: 400, headers: corsHeaders });
  }

  const token = body.token;
  if (!token || typeof token !== "string") {
    return new Response(JSON.stringify({ error: "token_required" }), { status: 400, headers: corsHeaders });
  }

  // PEEK: valida token sem consumir. So consumimos depois que senha for definida.
  const { data: peeked, error: peekErr } = await supabaseAdmin.rpc("peek_invite_token", { _token: token });

  if (peekErr) {
    const isInvalid = peekErr.message?.includes("invalid_or_expired_token");
    return new Response(
      JSON.stringify({ error: isInvalid ? "invalid_or_expired_token" : "peek_failed" }),
      { status: isInvalid ? 410 : 500, headers: corsHeaders },
    );
  }

  if (!peeked || peeked.length === 0) {
    return new Response(JSON.stringify({ error: "invalid_or_expired_token" }), { status: 410, headers: corsHeaders });
  }

  const { user_id, email, source } = peeked[0];

  // Activate household membership if invited (faz aqui, e nao depende de senha definida)
  if (source === "household") {
    await supabaseAdmin
      .from("household_members")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .eq("user_id", user_id)
      .eq("status", "invited");
  }

  // NAO mexe em senha. NAO retorna access_credential. SPA vai redirect pra
  // /force-password-change?token=X&email=Y onde user define a primeira senha.
  return new Response(
    JSON.stringify({
      success: true,
      email,
      user_id,
    }),
    { headers: corsHeaders },
  );
});
