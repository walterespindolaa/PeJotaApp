import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { hashPii } from "../_shared/pii.ts";

const EMAIL_FROM = "Atlas <suporte@walterespindola.com.br>";
const EMAIL_REPLY_TO = "suporte@walterespindola.com.br";
const SITE_URL = "https://app.useatlasapp.com";

function respond(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

function welcomeTrialHTML(name: string): string {
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
    <h2 style="margin:0 0 8px;color:#4A4035;font-size:20px;font-weight:700;">Seu teste gratuito de 7 dias começou! 🎉</h2>
    <p style="margin:0 0 20px;color:#6B5E50;font-size:15px;line-height:1.6;">
      Olá${name ? `, ${name}` : ""}! Bem-vindo ao Atlas. Nos próximos 7 dias você terá acesso completo a todas as funcionalidades.
    </p>
    <div style="margin:20px 0;background:#F9F7F4;border-radius:10px;padding:20px;border:1px solid #EDE8DF;">
      <p style="margin:0 0 10px;color:#4A4035;font-size:14px;font-weight:600;">📌 O que acontece depois?</p>
      <p style="margin:0 0 6px;color:#6B5E50;font-size:13px;line-height:1.5;">• <strong>Dias 1–7:</strong> Acesso completo a tudo</p>
      <p style="margin:0 0 6px;color:#6B5E50;font-size:13px;line-height:1.5;">• <strong>Dias 8–30:</strong> Acesso limitado ao financeiro básico (planejamento, lançamentos, calendário)</p>
      <p style="margin:0;color:#6B5E50;font-size:13px;line-height:1.5;">• <strong>Após 30 dias:</strong> Acesso bloqueado (seus dados ficam salvos por 60 dias)</p>
    </div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
      <a href="${SITE_URL}/auth" target="_blank" style="display:inline-block;background:#2B6CB0;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
        Começar Agora
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

async function sendEmail(to: string, subject: string, html: string, supabase: any, functionName: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.log(`[${functionName}] RESEND_API_KEY not configured, skipping email`);
    return { ok: false, email_sent: false, reason: "no_api_key" };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: EMAIL_FROM,
        reply_to: EMAIL_REPLY_TO,
        to: [to],
        subject,
        html,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      console.error(`[${functionName}] Resend error (${res.status}):`, body);
      await supabase.from("audit_logs").insert({
        action: "resend_email_error",
        payload: { function: functionName, to_hash: await hashPii(to), status: res.status, response_body: body, from: EMAIL_FROM },
      });
      return { ok: true, email_sent: false };
    }

    console.log(`[${functionName}] email sent:`, body?.id);
    await supabase.from("audit_logs").insert({
      action: "resend_email_sent",
      payload: { function: functionName, to_hash: await hashPii(to), provider_id: body?.id, from: EMAIL_FROM },
    });
    return { ok: true, email_sent: true, provider_id: body?.id };
  } catch (err: any) {
    console.error(`[${functionName}] email exception:`, err?.message);
    await supabase.from("audit_logs").insert({
      action: "resend_email_error",
      payload: { function: functionName, to_hash: await hashPii(to), error: err?.message, from: EMAIL_FROM },
    });
    return { ok: true, email_sent: false };
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, corsHeaders);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  async function audit(action: string, targetUserId: string | null, payload: Record<string, unknown>) {
    try {
      await supabase.from("audit_logs").insert({ action, target_user_id: targetUserId, payload });
    } catch { /* silent */ }
  }

  // --- Rate limit by IP (max 5 registrations per hour per IP) ---
  // Apenas verifica; incrementa depois das validações (pra não penalizar
  // usuário que digitou email já cadastrado).
  const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("cf-connecting-ip") || "unknown";
  const ipKey = `reg_${clientIP.replace(/[^a-zA-Z0-9]/g, "_")}`;
  const hourKey = new Date().toISOString().slice(0, 13);

  const { data: rlRow } = await supabase
    .from("rate_limit_register" as any)
    .select("count, hour_key")
    .eq("ip_key", ipKey)
    .maybeSingle();

  const currentCount = (rlRow && rlRow.hour_key === hourKey) ? (rlRow.count || 0) : 0;
  if (currentCount >= 5) {
    await audit("trial_register_rate_limited", null, { ip: clientIP });
    return respond({ error: "Muitas tentativas. Aguarde alguns minutos." }, 429, corsHeaders);
  }

  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return respond({ error: "Invalid JSON" }, 400, corsHeaders);
    }

    const name = (body?.name || "").trim();
    const email = (body?.email || "").trim().toLowerCase();
    const phone = (body?.phone || "").trim();
    const password = (body?.password || "").trim();
    const couponCode = (body?.coupon_code || "").trim().toUpperCase();
    const aceitoMarketing = body?.aceito_marketing === true;
    const aceitoTermos = body?.aceito_termos === true;

    if (!name || !email || !password) {
      return respond({ error: "Nome, email e senha são obrigatórios." }, 400, corsHeaders);
    }
    if (password.length < 8) {
      return respond({ error: "A senha deve ter no mínimo 8 caracteres." }, 400, corsHeaders);
    }

    // --- Validate coupon if provided ---
    let coupon: any = null;
    if (couponCode) {
      const { data: c } = await supabase
        .from("partner_coupons")
        .select("*, partners(id, name, status)")
        .eq("code", couponCode)
        .eq("status", "active")
        .maybeSingle();

      if (!c) {
        return respond({ error: "invalid_coupon", message: "Cupom inválido ou inativo." }, 400, corsHeaders);
      }
      if (c.usage_limit && c.usage_count >= c.usage_limit) {
        return respond({ error: "invalid_coupon", message: "Cupom esgotado." }, 400, corsHeaders);
      }
      const now = new Date();
      if (c.valid_from && new Date(c.valid_from) > now) {
        return respond({ error: "invalid_coupon", message: "Cupom ainda não está ativo." }, 400, corsHeaders);
      }
      if (c.valid_until && new Date(c.valid_until) < now) {
        return respond({ error: "invalid_coupon", message: "Cupom expirado." }, 400, corsHeaders);
      }
      if (c.partners?.status !== "active") {
        return respond({ error: "invalid_coupon", message: "Parceiro inativo." }, 400, corsHeaders);
      }
      coupon = c;
    }

    // --- Check duplicate email ---
    const { data: existingUserId } = await supabase.rpc("find_user_id_by_email", { _email: email });
    const existingUser = existingUserId ? { id: existingUserId as string } : null;

    if (existingUser) {
      return respond({ error: "email_exists", message: "Você já tem cadastro. Clique em Entrar ou recupere sua senha." }, 409, corsHeaders);
    }

    // --- Check duplicate phone (if provided) ---
    if (phone) {
      const { data: phoneProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("phone", phone)
        .maybeSingle();

      if (phoneProfile) {
        return respond({ error: "phone_exists", message: "Este telefone já está associado a outra conta." }, 409, corsHeaders);
      }
    }

    // --- Create user ---
    // Incrementa rate limit só aqui — depois de validar email único, telefone único e cupom.
    await supabase.from("rate_limit_register" as any).upsert({
      ip_key: ipKey,
      hour_key: hourKey,
      count: currentCount + 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: "ip_key" });

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, signup_source: "trial" },
    });

    if (createError || !newUser?.user) {
      await audit("trial_register_failed", null, { step: "user_create_failed", email_hash: await hashPii(email), error: createError?.message });
      return respond({ error: "Falha ao criar conta. Tente novamente." }, 500, corsHeaders);
    }

    const userId = newUser.user.id;

    // Update profile (phone + consentimento de marketing)
    const profileUpdate: Record<string, unknown> = {};
    if (phone) profileUpdate.phone = phone;
    if (aceitoMarketing) {
      profileUpdate.marketing_opt_in = true;
      profileUpdate.marketing_opt_in_at = new Date().toISOString();
      profileUpdate.marketing_opt_in_source = "comece";
    }
    if (Object.keys(profileUpdate).length > 0) {
      await supabase.from("profiles").update(profileUpdate).eq("user_id", userId);
    }

    // --- Record Terms of Use / Privacy Policy acceptance ---
    // Mesma tabela/colunas usadas pela edge function accept-terms.
    if (aceitoTermos) {
      const userAgent = req.headers.get("user-agent") || null;
      const { error: termsError } = await supabase
        .from("user_terms_acceptance")
        .upsert(
          {
            user_id: userId,
            terms_version: "1.0",
            accepted_at: new Date().toISOString(),
            ip_address: clientIP === "unknown" ? null : clientIP,
            user_agent: userAgent,
          },
          { onConflict: "user_id,terms_version" }
        );
      if (termsError) {
        console.error("[register-trial] terms acceptance insert failed:", termsError.message);
      }
    }

    // Set trial dates — trigger may create row with awaiting_payment if signup_source wasn't
    // processed yet, so we explicitly enforce the correct trial state here.
    const trialExpires = new Date();
    trialExpires.setDate(trialExpires.getDate() + 7);

    const graceEnd = new Date();
    graceEnd.setDate(graceEnd.getDate() + 37); // 7 trial + 30 grace

    const { error: subError } = await supabase.from("user_subscriptions")
  .upsert({
    user_id: userId,
    origin: "trial",
    access_state: "trial",
    trial_expires_at: trialExpires.toISOString(),
    grace_finance_until: graceEnd.toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id" });

if (subError) {
  console.error("[register-trial] upsert user_subscriptions failed:", subError.message);
}

    // --- Apply coupon if valid ---
    let couponApplied = false;
    if (coupon) {
      // 1. Create attribution with snapshot
      await supabase.from("user_partner_attributions").insert({
        user_id: userId,
        partner_id: coupon.partner_id,
        coupon_id: coupon.id,
        coupon_code: coupon.code,
        attribution_source: "coupon",
        assigned_plan_slug: coupon.plan_slug || null,
        pricing_model_snapshot: coupon.pricing_model,
        client_discount_snapshot: {
          type: coupon.client_discount_type,
          value: coupon.client_discount_value,
        },
        partner_commission_snapshot: {
          type: coupon.partner_commission_type,
          value: coupon.partner_commission_value,
        },
        client_cost_zero: coupon.client_cost_zero,
        partner_pays_full: coupon.partner_pays_full,
      });

      // 2. Increment usage count atomically
      await supabase.rpc("increment_coupon_usage", { p_coupon_id: coupon.id });

      // 3. Apply plan if coupon specifies one
      // Map plan_slug to the correct plan_tier for user_plans
      const SLUG_TO_TIER: Record<string, string> = {
        atlas_essencial: "organiza_2026",
        atlas_pro: "planejamento_360",
        atlas_elite: "planejamento_360",
      };

      if (coupon.plan_slug) {
        const { data: plan } = await supabase
          .from("plans")
          .select("id")
          .eq("slug", coupon.plan_slug)
          .maybeSingle();

        if (plan) {
          const targetTier = SLUG_TO_TIER[coupon.plan_slug] || "organiza_2026";
          await supabase.from("user_plans")
            .update({ plan_id: plan.id, tier: targetTier, assigned_by_admin: true, assigned_at: new Date().toISOString() })
            .eq("user_id", userId);
        }
      }

      // 4. If client_cost_zero, grant paid-level access.
      // Note: plan_tier is a binary gate ("free"/"full") — actual feature
      // gating is controlled by user_plans.tier set above via SLUG_TO_TIER.
      if (coupon.client_cost_zero) {
        await supabase.from("user_subscriptions")
          .update({
            plan_tier: "full",
            access_state: "active",
            origin: "partner_coupon",
            full_expires_at: null, // no expiration for partner-sponsored
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } else {
        // Normal coupon — still mark origin
        await supabase.from("user_subscriptions")
          .update({
            origin: "partner_coupon",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }

      couponApplied = true;
      await audit("coupon_applied", userId, {
        coupon_code: coupon.code,
        partner_id: coupon.partner_id,
        pricing_model: coupon.pricing_model,
        client_cost_zero: coupon.client_cost_zero,
        plan_slug: coupon.plan_slug,
      });
    }

    await audit("trial_register_success", userId, { step: "user_created", source: couponApplied ? "partner_coupon" : "trial" });

    // --- Send welcome trial email ---
    await sendEmail(email, "Seu teste gratuito de 7 dias começou 🎉", welcomeTrialHTML(name), supabase, "register-trial");

    return respond({ success: true, user_id: userId, coupon_applied: couponApplied }, 201, corsHeaders);

  } catch (err: any) {
    console.error("[register-trial] Internal error");
    return respond({ error: "Erro interno. Tente novamente." }, 500, corsHeaders);
  }
});
