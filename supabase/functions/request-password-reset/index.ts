import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { checkRateLimit } from "../_shared/rate-limit.ts";
import { hashPii } from "../_shared/pii.ts";

// Global do runtime de Edge Functions (Deno Deploy). Ausente em ambientes locais.
declare const EdgeRuntime: undefined | { waitUntil(promise: Promise<unknown>): void };

function respond(body: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

// Deriva um UUID deterministico a partir de uma string (ip/email) para usar
// como chave do checkRateLimit, que espera um _user_id no formato uuid.
async function pseudoUuidFrom(input: string): Promise<string> {
  const enc = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const hex = Array.from(new Uint8Array(digest).slice(0, 16)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function generateToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const SITE_NAME = "Atlas";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, corsHeaders);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (!resendKey) {
    console.error("RESEND_API_KEY not configured");
    return respond({ error: "Server configuration error" }, 500, corsHeaders);
  }

  // Resposta generica — identica para todos os casos. Retornada SEMPRE antes
  // do trabalho dependente da existencia do usuario, para tempo constante.
  const respondGeneric = () =>
    respond({ message: "Se o e-mail estiver cadastrado, você receberá as instruções." }, 200, corsHeaders);

  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return respondGeneric();
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailHash = await hashPii(cleanEmail);
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "";
    const userAgent = req.headers.get("user-agent") || "";

    // --- Limites de taxa (iguais para todo mundo, antes da resposta) ---

    // Por e-mail: max 5/hora. (NOTA: so conta e-mails existentes, pois
    // password_resets so recebe linha quando o usuario existe — por isso o
    // limite por IP abaixo cobre o caso de e-mails inexistentes.)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("password_resets")
      .select("id", { count: "exact", head: true })
      .eq("email", cleanEmail)
      .gte("created_at", oneHourAgo);

    // Por IP: max 20/hora — cobre tentativas de enumeracao com e-mails que nao existem.
    let ipLimited = false;
    if (ip) {
      const ipKey = await pseudoUuidFrom(`pwreset:${ip}`);
      const rlIp = await checkRateLimit(ipKey, { scope: "request-password-reset-ip", window: "hour", limit: 20 });
      ipLimited = !rlIp.allowed;
    }

    if ((count || 0) >= 5 || ipLimited) {
      // Sem PII: loga apenas o hash do e-mail.
      await supabase.from("audit_logs").insert({
        action: "password_reset_requested",
        payload: { event_type: "password_reset_requested", status: "rate_limited", email_hash: emailHash },
      });
      return respondGeneric();
    }

    // --- Trabalho dependente da existencia do usuario: roda APOS responder ---
    const work = (async () => {
      const { data: foundUserId } = await supabase.rpc("find_user_id_by_email", { _email: cleanEmail });
      const user = foundUserId ? { id: foundUserId as string } : null;

      if (!user) {
        // Sem PII: nao loga o e-mail bruto quando o usuario nao existe (conecta com a Fase 2.2).
        await supabase.from("audit_logs").insert({
          action: "password_reset_requested",
          payload: { event_type: "password_reset_requested", status: "user_not_found", email_hash: emailHash },
        });
        return;
      }

      const token = generateToken(32);
      const tokenHash = await sha256(token);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await supabase.from("password_resets").insert({
        email: cleanEmail,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        ip,
        user_agent: userAgent,
      });

      const resetLink = `https://app.useatlasapp.com/reset-password?token=${token}`;
      const templateProps = { siteName: SITE_NAME, confirmationUrl: resetLink };

      const html = await renderAsync(React.createElement(RecoveryEmail, templateProps));
      const text = await renderAsync(React.createElement(RecoveryEmail, templateProps), { plainText: true });

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Atlas <suporte@walterespindola.com.br>",
          to: [cleanEmail],
          subject: "Redefinir sua senha — Atlas",
          html,
          text,
        }),
      });
      if (!emailRes.ok) {
        console.error("[request-password-reset] Email send failed");
        await supabase.from("audit_logs").insert({
          action: "password_reset_requested",
          target_user_id: user.id,
          payload: { event_type: "password_reset_requested", status: "email_failed", provider: "resend" },
        });
        return;
      }

      await supabase.from("audit_logs").insert({
        action: "password_reset_requested",
        target_user_id: user.id,
        payload: { event_type: "password_reset_requested", status: "success", provider: "lovable_cloud" },
      });
    })();

    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(work);
    } else {
      work.catch((e) => console.error("[request-password-reset] bg error:", e instanceof Error ? e.message : "unknown"));
    }

    return respondGeneric();
  } catch (_err) {
    console.error("[request-password-reset] Error");
    await supabase.from("audit_logs").insert({
      action: "password_reset_requested",
      payload: { event_type: "password_reset_requested", status: "error" },
    }).catch(() => {});
    // Mantem resposta generica tambem em erro, para nao vazar timing/contrato.
    return respondGeneric();
  }
});
