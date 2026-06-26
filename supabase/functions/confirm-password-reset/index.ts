import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { hashPii } from "../_shared/pii.ts";

function respond(body: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function emailToUuid(email: string): Promise<string> {
  const data = new TextEncoder().encode(email.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Format as UUID v4-ish (deterministic but compatible with uuid column)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, corsHeaders);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { token, new_password } = await req.json();

    if (!token || typeof token !== "string") {
      return respond({ error: "Token inválido." }, 400, corsHeaders);
    }
    if (!new_password || typeof new_password !== "string" || new_password.length < 8) {
      return respond({ error: "A senha deve ter no mínimo 8 caracteres." }, 400, corsHeaders);
    }

    const tokenHash = await sha256(token);

    const { data: resetRecord, error: lookupError } = await supabase
      .from("password_resets")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (lookupError || !resetRecord) {
      await supabase.from("audit_logs").insert({
        action: "password_reset_completed",
        payload: { event_type: "password_reset_completed", status: "invalid_token" },
      });
      return respond({ error: "Token inválido ou expirado. Solicite um novo link." }, 400, corsHeaders);
    }

    if (resetRecord.used_at) {
      return respond({ error: "Este link já foi utilizado. Solicite um novo." }, 400, corsHeaders);
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      await supabase.from("audit_logs").insert({
        action: "password_reset_completed",
        payload: { event_type: "password_reset_completed", status: "token_expired", email_hash: await hashPii(resetRecord.email) },
      });
      return respond({ error: "Link expirado. Solicite um novo na tela de login." }, 400, corsHeaders);
    }

    // Rate limit por email pra evitar brute-force de tokens.
    // Helper aceita uuid em "userId" mas a tabela rate_limit_v2 tem user_id uuid.
    // Usamos um UUID determinístico baseado no email pra encaixar no schema.
    const emailKey = await emailToUuid(resetRecord.email);
    const rl = await checkRateLimit(emailKey, { scope: "confirm-password-reset", window: "hour", limit: 10 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders, "Muitas tentativas de redefinição. Aguarde uma hora.");

    const { data: foundUserId } = await supabase.rpc("find_user_id_by_email", { _email: resetRecord.email });
    const user = foundUserId ? { id: foundUserId as string } : null;

    if (!user) {
      await supabase.from("audit_logs").insert({
        action: "password_reset_completed",
        payload: { event_type: "password_reset_completed", status: "user_not_found", email_hash: await hashPii(resetRecord.email) },
      });
      return respond({ error: "Usuário não encontrado." }, 400, corsHeaders);
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: new_password,
    });

    if (updateError) {
      await supabase.from("audit_logs").insert({
        action: "password_reset_completed",
        target_user_id: user.id,
        payload: { event_type: "password_reset_completed", status: "update_failed", email_hash: await hashPii(resetRecord.email) },
      });
      return respond({ error: "Erro ao atualizar senha. Tente novamente." }, 500, corsHeaders);
    }

    await supabase
      .from("password_resets")
      .update({ used_at: new Date().toISOString() })
      .eq("id", resetRecord.id);

    await supabase.from("audit_logs").insert({
      action: "password_reset_completed",
      target_user_id: user.id,
      payload: { event_type: "password_reset_completed", status: "success", email_hash: await hashPii(resetRecord.email) },
    });

    return respond({ success: true, message: "Senha redefinida com sucesso!" }, 200, corsHeaders);
  } catch (err: any) {
    console.error("[confirm-password-reset] Error");
    try {
      await supabase.from("audit_logs").insert({
        action: "password_reset_completed",
        payload: { event_type: "password_reset_completed", status: "error" },
      });
    } catch (_) {}
    return respond({ error: "Erro interno. Tente novamente." }, 500, corsHeaders);
  }
});
