import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { buildInviteEmailHtml } from "../_shared/invite-tokens.ts";

function respond(body: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function resetPasswordHTML(link: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F1EC;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EC;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,64,53,0.08);">
  <tr><td style="background:#2B4A5C;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Atlas</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;color:#2B3340;font-size:20px;font-weight:700;">Redefinir sua senha</h2>
    <p style="margin:0 0 24px;color:#4A5568;font-size:15px;line-height:1.6;">
      Recebemos uma solicitação para redefinir a senha da sua conta no Atlas. Clique no botão abaixo para criar uma nova senha.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${link}" target="_blank" style="display:inline-block;background:#2B4A5C;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;letter-spacing:0.3px;">
        Redefinir Senha
      </a>
    </td></tr></table>
    <p style="margin:24px 0 0;color:#6B7280;font-size:13px;line-height:1.5;">
      Se você não solicitou essa alteração, ignore este e-mail. O link expira em 1 hora.
    </p>
  </td></tr>
  <tr><td style="background:#F9F7F4;padding:20px 40px;text-align:center;border-top:1px solid #EDE8DF;">
    <p style="margin:0;color:#A09472;font-size:12px;">© ${new Date().getFullYear()} Atlas · Organização Financeira</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function paymentFailedHTML(name: string): string {
  const greeting = name ? `Olá, ${name}` : "Olá";
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F1EC;font-family:'DM Sans',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EC;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,64,53,0.08);">
  <tr><td style="background:#2B4A5C;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">Atlas</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <h2 style="margin:0 0 16px;color:#2B3340;font-size:20px;font-weight:700;">Falha no pagamento da sua assinatura</h2>
    <p style="margin:0 0 16px;color:#4A5568;font-size:15px;line-height:1.6;">
      ${greeting}, não conseguimos processar o pagamento da sua assinatura Atlas.
    </p>
    <p style="margin:0 0 24px;color:#4A5568;font-size:15px;line-height:1.6;">
      Para evitar a interrupção do seu acesso, verifique os dados do seu cartão e atualize sua forma de pagamento. Faremos novas tentativas de cobrança automaticamente.
    </p>
    <p style="margin:0;color:#6B7280;font-size:13px;line-height:1.5;">
      Se você já regularizou o pagamento ou cancelou a assinatura, desconsidere este e-mail.
    </p>
  </td></tr>
  <tr><td style="background:#F9F7F4;padding:20px 40px;text-align:center;border-top:1px solid #EDE8DF;">
    <p style="margin:0;color:#A09472;font-size:12px;">© ${new Date().getFullYear()} Atlas · Organização Financeira</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, corsHeaders);

  // --- Auth: require service_role or internal secret ---
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRole) {
    return respond({ error: "Unauthorized" }, 401, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return respond({ error: "Email provider not configured" }, 500, corsHeaders);
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return respond({ error: "Invalid JSON" }, 400, corsHeaders);
  }

  const { type, to, name, link, user_id } = payload;
  if (!to || !type) {
    return respond({ error: "Missing required fields" }, 400, corsHeaders);
  }

  let subject: string;
  let html: string;

  try {
    switch (type) {
      case "reset_password":
        if (!link) return respond({ error: "Missing link" }, 400, corsHeaders);
        subject = "Redefinir sua senha — Atlas";
        html = resetPasswordHTML(link);
        break;
      case "account_access":
        if (!link) return respond({ error: "Missing link" }, 400, corsHeaders);
        subject = "Seu acesso ao Atlas — crie sua senha";
        html = buildInviteEmailHtml({ acceptUrl: link, recipientName: name || "", source: "admin" });
        break;
      case "payment_failed":
        subject = "Falha no pagamento da sua assinatura Atlas";
        html = paymentFailedHTML(name || "");
        break;
      default:
        return respond({ error: "Unknown email type" }, 400, corsHeaders);
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Atlas <suporte@walterespindola.com.br>",
        reply_to: "suporte@walterespindola.com.br",
        to: [to],
        subject,
        html,
      }),
    });

    const resBody = await res.json();

    if (!res.ok) {
      console.error("[send-email] Provider error");
      await supabase.from("audit_logs").insert({
        action: "email_send",
        target_user_id: user_id || null,
        payload: { event_type: "email_send", status: "error", to_email: to, subject, provider: "resend" },
      });
      return respond({ error: "Failed to send email" }, 500, corsHeaders);
    }

    await supabase.from("audit_logs").insert({
      action: "email_send",
      target_user_id: user_id || null,
      payload: { event_type: "email_send", status: "success", to_email: to, subject, provider: "resend", provider_message_id: resBody.id },
    });

    return respond({ success: true, id: resBody.id }, 200, corsHeaders);
  } catch (err: any) {
    console.error("[send-email] Internal error");
    return respond({ error: "Internal error sending email" }, 500, corsHeaders);
  }
});
