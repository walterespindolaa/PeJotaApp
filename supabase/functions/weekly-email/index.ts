import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hashPii } from "../_shared/pii.ts";

const corsHeaders = {
  "Content-Type": "application/json",
};

const EMAIL_FROM = "Atlas <suporte@walterespindola.com.br>";
const EMAIL_REPLY_TO = "suporte@walterespindola.com.br";
const SITE_URL = "https://app.useatlasapp.com";

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function buildWeeklyEmailHTML(name: string, stats: { entradas: number; saidas: number; saldo: number; hasCompany: boolean; companyName?: string }): string {
  const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const saldoColor = stats.saldo >= 0 ? "#2B6CB0" : "#E53E3E";

  const checklistItems = [
    "✔ Registrar receitas da semana",
    "✔ Registrar despesas da semana",
    "✔ Conferir saldo do caixa",
    ...(stats.hasCompany ? ["✔ Separar valor para impostos", "✔ Definir pró-labore"] : []),
  ];

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F1EC;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EC;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,64,53,0.08);">
  <tr><td style="background:#4A4035;padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#F4F1EC;font-size:22px;font-weight:700;">Atlas</h1>
    <p style="margin:8px 0 0;color:#C4B8A4;font-size:13px;">Seu check-up financeiro da semana</p>
  </td></tr>
  <tr><td style="padding:40px;">
    <p style="margin:0 0 20px;color:#6B5E50;font-size:15px;line-height:1.6;">
      Olá${name ? `, ${name}` : ""}! 👋
    </p>
    <p style="margin:0 0 24px;color:#6B5E50;font-size:15px;line-height:1.6;">
      Hora de dar uma olhada nas suas finanças. Leva menos de 2 minutos.
    </p>

    ${stats.entradas > 0 || stats.saidas > 0 ? `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #EDE8DF;border-radius:12px;overflow:hidden;">
      ${stats.hasCompany && stats.companyName ? `<tr><td colspan="2" style="background:#F9F7F4;padding:12px 16px;font-size:13px;color:#6B5E50;font-weight:600;">📊 ${stats.companyName}</td></tr>` : ""}
      <tr>
        <td style="padding:16px;text-align:center;border-right:1px solid #EDE8DF;">
          <p style="margin:0;color:#A09472;font-size:11px;text-transform:uppercase;">Entradas</p>
          <p style="margin:4px 0 0;color:#2B6CB0;font-size:18px;font-weight:700;">${fmtBRL(stats.entradas)}</p>
        </td>
        <td style="padding:16px;text-align:center;">
          <p style="margin:0;color:#A09472;font-size:11px;text-transform:uppercase;">Saídas</p>
          <p style="margin:4px 0 0;color:#E53E3E;font-size:18px;font-weight:700;">${fmtBRL(stats.saidas)}</p>
        </td>
      </tr>
      <tr><td colspan="2" style="padding:12px 16px;text-align:center;border-top:1px solid #EDE8DF;background:#F9F7F4;">
        <p style="margin:0;color:#A09472;font-size:11px;text-transform:uppercase;">Quanto sobrou</p>
        <p style="margin:4px 0 0;color:${saldoColor};font-size:20px;font-weight:700;">${fmtBRL(stats.saldo)}</p>
      </td></tr>
    </table>
    ` : ""}

    <p style="margin:0 0 12px;color:#4A4035;font-size:14px;font-weight:600;">📋 Checklist da semana:</p>
    ${checklistItems.map(item => `<p style="margin:0 0 8px;color:#6B5E50;font-size:14px;line-height:1.5;">${item}</p>`).join("")}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;"><tr><td align="center">
      <a href="${SITE_URL}/dashboard" target="_blank" style="display:inline-block;background:#2B6CB0;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
        Abrir Atlas →
      </a>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#F9F7F4;padding:20px 40px;text-align:center;border-top:1px solid #EDE8DF;">
    <p style="margin:0;color:#A09472;font-size:11px;">Para desativar, acesse Perfil → Lembrete Semanal</p>
    <p style="margin:4px 0 0;color:#A09472;font-size:11px;">© ${new Date().getFullYear()} Atlas</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  

  // --- Auth: require service_role key (cron/internal only) ---
  const authHeader = req.headers.get("Authorization") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRole) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (!resendKey) {
    return new Response(JSON.stringify({ ok: false, error: "no_resend_key" }), { headers: corsHeaders });
  }

  // Get current hour in UTC
  const nowUTC = new Date();
  const results: any[] = [];

  // Find users who should receive email now — paginated to support large user bases
  const PAGE = 500;
  let offset = 0;
  while (true) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, weekly_email_enabled, weekly_email_day, weekly_email_hour, weekly_email_timezone, last_weekly_email_sent_at, selected_company_id")
      .eq("weekly_email_enabled", true)
      .order("user_id", { ascending: true })
      .range(offset, offset + PAGE - 1);

    if (!profiles || profiles.length === 0) break;

    for (const profile of profiles) {
    try {
      // Check if it's the right day/hour for this user's timezone
      const tz = profile.weekly_email_timezone || "America/Sao_Paulo";
      const userNow = new Date(nowUTC.toLocaleString("en-US", { timeZone: tz }));
      const userDay = userNow.getDay();
      const userHour = userNow.getHours();

      if (userDay !== (profile.weekly_email_day ?? 0)) continue;
      if (userHour !== (profile.weekly_email_hour ?? 20)) continue;

      // Check if already sent this week
      if (profile.last_weekly_email_sent_at) {
        const lastSent = new Date(profile.last_weekly_email_sent_at);
        const diffHours = (nowUTC.getTime() - lastSent.getTime()) / (1000 * 60 * 60);
        if (diffHours < 144) continue; // 6 days minimum between sends
      }

      // Get user email
      const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
      if (!userData?.user?.email) continue;

      // Calculate weekly stats
      const weekStart = new Date(nowUTC);
      weekStart.setDate(weekStart.getDate() - 7);
      const weekStartStr = weekStart.toISOString().slice(0, 10);

      let entradas = 0, saidas = 0;
      let hasCompany = false;
      let companyName: string | undefined;

      // Try business data first if user has a selected company
      if (profile.selected_company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("name")
          .eq("id", profile.selected_company_id)
          .eq("user_id", profile.user_id)
          .maybeSingle();

        if (company) {
          hasCompany = true;
          companyName = company.name;

          const { data: txs } = await supabase
            .from("business_transactions")
            .select("direction, amount")
            .eq("company_id", profile.selected_company_id)
            .eq("user_id", profile.user_id)
            .gte("date", weekStartStr);

          if (txs) {
            for (const tx of txs) {
              if (tx.direction === "in") entradas += Number(tx.amount);
              else saidas += Number(tx.amount);
            }
          }
        }
      }

      // If no business data, try personal expenses/income
      if (!hasCompany) {
        const { data: receitas } = await supabase
          .from("receitas")
          .select("valor")
          .eq("user_id", profile.user_id)
          .gte("data", weekStartStr);

        if (receitas) entradas = receitas.reduce((s: number, r: any) => s + Number(r.valor), 0);

        const { data: despesas } = await supabase
          .from("despesas")
          .select("valor")
          .eq("user_id", profile.user_id)
          .gte("data", weekStartStr);

        if (despesas) saidas = despesas.reduce((s: number, d: any) => s + Number(d.valor), 0);
      }

      const html = buildWeeklyEmailHTML(profile.full_name || "", {
        entradas,
        saidas,
        saldo: entradas - saidas,
        hasCompany,
        companyName,
      });

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: EMAIL_FROM,
          reply_to: EMAIL_REPLY_TO,
          to: [userData.user.email],
          subject: "Seu check-up financeiro da semana no Atlas ✨ (2 min)",
          html,
        }),
      });

      if (emailRes.ok) {
        console.log(`[weekly-email] sent to user ${profile.user_id}`);
        await supabase.from("profiles").update({ last_weekly_email_sent_at: nowUTC.toISOString() }).eq("user_id", profile.user_id);
        await supabase.from("audit_logs").insert({
          action: "weekly_email_sent",
          target_user_id: profile.user_id,
          payload: { to_hash: await hashPii(userData.user.email), date: nowUTC.toISOString().slice(0, 10) },
        });
        results.push({ userId: profile.user_id, sent: true });
      } else {
        const errBody = await emailRes.json().catch(() => ({}));
        console.error(`[weekly-email] error for user ${profile.user_id}:`, errBody);
        await supabase.from("audit_logs").insert({
          action: "weekly_email_error",
          target_user_id: profile.user_id,
          payload: { to_hash: await hashPii(userData.user.email), error: errBody },
        });
      }
      } catch (err: any) {
        console.error(`[weekly-email] exception for ${profile.user_id}:`, err?.message);
      }
    }

    if (profiles.length < PAGE) break;
    offset += PAGE;
  }

  return new Response(JSON.stringify({ ok: true, sent: results.filter(r => r.sent).length, total: results.length }), { headers: corsHeaders });
});
