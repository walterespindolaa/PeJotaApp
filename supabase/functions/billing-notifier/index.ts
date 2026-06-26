import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashPii } from "../_shared/pii.ts";

const corsHeaders = {
  "Content-Type": "application/json",
};

const EMAIL_FROM = "Atlas <suporte@walterespindola.com.br>";
const EMAIL_REPLY_TO = "suporte@walterespindola.com.br";
const SITE_URL = "https://app.useatlasapp.com";
// Funil unico via Stripe: CTA leva para a pagina de planos dentro do app,
// onde o checkout e criado pela Edge Function create-checkout (Stripe).
const CHECKOUT_URL = `${SITE_URL}/dashboard/planos`;
const RENEWAL_URL = `${SITE_URL}/dashboard/planos`;

interface NotifConfig {
  type: string;
  subject: string;
  ctaText: string;
  ctaUrl: string;
  bodyText: string;
}

const NOTIF_CONFIGS: Record<string, NotifConfig> = {
  trial_3d: {
    type: "trial_3d",
    subject: "Seu teste grátis termina em 3 dias ⏳",
    ctaText: "Ativar Atlas FULL",
    ctaUrl: CHECKOUT_URL,
    bodyText: "Seu período de teste gratuito no Atlas termina em 3 dias. Ative o plano FULL para continuar usando todos os módulos.",
  },
  trial_1d: {
    type: "trial_1d",
    subject: "Último dia do seu teste grátis ⚠️",
    ctaText: "Ativar Atlas FULL",
    ctaUrl: CHECKOUT_URL,
    bodyText: "Amanhã seu acesso gratuito ao Atlas será reduzido. Ative agora para não perder suas análises e planejamentos.",
  },
  full_15d: {
    type: "full_15d",
    subject: "Seu plano Atlas FULL vence em 15 dias 🔔",
    ctaText: "Renovar agora",
    ctaUrl: RENEWAL_URL,
    bodyText: "Seu plano Atlas FULL vence em 15 dias. Renove agora para manter o acesso completo às suas análises e planejamentos.",
  },
  full_7d: {
    type: "full_7d",
    subject: "Faltam 7 dias para vencer ⏰",
    ctaText: "Renovar agora",
    ctaUrl: RENEWAL_URL,
    bodyText: "Faltam apenas 7 dias para seu plano Atlas FULL expirar. Renove agora para não perder o acesso.",
  },
  full_1d: {
    type: "full_1d",
    subject: "Seu plano vence amanhã 🚨",
    ctaText: "Renovar agora",
    ctaUrl: RENEWAL_URL,
    bodyText: "Seu plano Atlas FULL vence amanhã! Renove agora para não perder o acesso.",
  },
};

function buildEmailHTML(config: NotifConfig, name: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F1EC;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EC;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,64,53,0.08);">
  <tr><td style="background:#4A4035;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#F4F1EC;font-size:22px;font-weight:700;">Atlas</h1>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="margin:0 0 20px;color:#6B5E50;font-size:15px;line-height:1.6;">
      Olá${name ? `, ${name}` : ""}!
    </p>
    <p style="margin:0 0 24px;color:#6B5E50;font-size:15px;line-height:1.6;">
      ${config.bodyText}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${config.ctaUrl}" target="_blank" style="display:inline-block;background:#2B6CB0;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
        ${config.ctaText}
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#F9F7F4;padding:20px 40px;text-align:center;border-top:1px solid #EDE8DF;">
    <p style="margin:0;color:#A09472;font-size:12px;">© ${new Date().getFullYear()} Atlas · Organização Financeira</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function datePlusDays(days: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {

  // --- Auth: require service_role key (cron/internal only) ---
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;
  const cronSecret = Deno.env.get("CRON_SECRET");
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;

  if (!isServiceRole && !isCron) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (!resendKey) {
    console.log("[billing-notifier] RESEND_API_KEY not configured");
    return new Response(JSON.stringify({ ok: false, error: "no_resend_key" }), { headers: corsHeaders });
  }

  const results: any[] = [];
  const today = datePlusDays(0);

  // Build notification list — paginated fetch of subscriptions to support large user bases
  const notifications: { userId: string; config: NotifConfig }[] = [];

  const PAGE = 500;
  let offset = 0;
  while (true) {
    const { data: subs } = await supabase
      .from("user_subscriptions")
      .select("user_id, plan_tier, access_state, trial_expires_at, full_expires_at")
      .order("user_id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (!subs || subs.length === 0) break;

    for (const sub of subs) {
      if (sub.plan_tier === "free" && sub.access_state === "trial" && sub.trial_expires_at) {
        const trialDate = new Date(sub.trial_expires_at).toISOString().slice(0, 10);
        const d3 = datePlusDays(3);
        const d1 = datePlusDays(1);
        if (trialDate === d3) notifications.push({ userId: sub.user_id, config: NOTIF_CONFIGS.trial_3d });
        if (trialDate === d1) notifications.push({ userId: sub.user_id, config: NOTIF_CONFIGS.trial_1d });
      }

      if (sub.plan_tier === "full" && sub.full_expires_at) {
        const fullDate = new Date(sub.full_expires_at).toISOString().slice(0, 10);
        const d15 = datePlusDays(15);
        const d7 = datePlusDays(7);
        const d1 = datePlusDays(1);
        if (fullDate === d15) notifications.push({ userId: sub.user_id, config: NOTIF_CONFIGS.full_15d });
        if (fullDate === d7) notifications.push({ userId: sub.user_id, config: NOTIF_CONFIGS.full_7d });
        if (fullDate === d1) notifications.push({ userId: sub.user_id, config: NOTIF_CONFIGS.full_1d });
      }
    }

    if (subs.length < PAGE) break;
    offset += PAGE;
  }

  console.log(`[billing-notifier] ${notifications.length} notifications to send`);

  for (const notif of notifications) {
    const idempotencyKey = `${notif.config.type}_${today}`;

    const { data: existing } = await supabase
      .from("audit_logs")
      .select("id")
      .eq("action", "billing_notifier_sent")
      .eq("target_user_id", notif.userId)
      .contains("payload", { type: notif.config.type, date: today })
      .limit(1);

    if (existing && existing.length > 0) {
      results.push({ userId: notif.userId, type: notif.config.type, skipped: true });
      continue;
    }

    const { data: userData } = await supabase.auth.admin.getUserById(notif.userId);
    if (!userData?.user?.email) continue;

    const email = userData.user.email;
    const name = userData.user.user_metadata?.full_name || "";

    const html = buildEmailHTML(notif.config, name);

    try {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: EMAIL_FROM,
          reply_to: EMAIL_REPLY_TO,
          to: [email],
          subject: notif.config.subject,
          html,
        }),
      });
      const emailBody = await emailRes.json();

      if (emailRes.ok) {
        console.log(`[billing-notifier] sent ${notif.config.type} to user ${notif.userId}`);
        await supabase.from("audit_logs").insert({
          action: "billing_notifier_sent",
          target_user_id: notif.userId,
          payload: { type: notif.config.type, date: today, to_hash: await hashPii(email), provider_id: emailBody?.id },
        });
        results.push({ userId: notif.userId, type: notif.config.type, sent: true });
      } else {
        console.error(`[billing-notifier] Resend error for user ${notif.userId}:`, emailBody);
        await supabase.from("audit_logs").insert({
          action: "billing_notifier_error",
          target_user_id: notif.userId,
          payload: { type: notif.config.type, date: today, to_hash: await hashPii(email), status: emailRes.status, response_body: emailBody },
        });
        results.push({ userId: notif.userId, type: notif.config.type, error: true });
      }
    } catch (err: any) {
      console.error(`[billing-notifier] error:`, err?.message);
      await supabase.from("audit_logs").insert({
        action: "billing_notifier_error",
        target_user_id: notif.userId,
        payload: { type: notif.config.type, date: today, error: err?.message },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, sent: results.filter(r => r.sent).length, total: notifications.length, results }), { headers: corsHeaders });
});
