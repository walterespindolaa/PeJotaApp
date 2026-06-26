import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createInviteToken, generateThrowawayPassword } from "../_shared/invite-tokens.ts";

const corsHeaders = {
  "Content-Type": "application/json",
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function getPlanFromPriceId(priceId: string): { slug: string; tier: string } {
  const map: Record<string, { slug: string; tier: string }> = {
    "price_1TGlL3R5a6AdWPyfkvCo0d7w": { slug: "atlas_essencial", tier: "essencial" },
    "price_1TGlLbR5a6AdWPyfgZA4jPqw": { slug: "atlas_pro", tier: "pro" },
    "price_1TGlLxR5a6AdWPyfEaG0XUXm": { slug: "atlas_elite", tier: "elite" },
  };
  return map[priceId] ?? { slug: "atlas_essencial", tier: "essencial" };
}

async function verifyStripeSignature(body: string, signature: string, secret: string): Promise<any> {
  const encoder = new TextEncoder();
  const parts = signature.split(",").reduce((acc: Record<string, string>, part) => {
    const [key, value] = part.split("=");
    acc[key] = value;
    return acc;
  }, {});

  const timestamp = parts["t"];
  const expectedSig = parts["v1"];
  if (!timestamp || !expectedSig) throw new Error("Invalid signature format");

  // Check timestamp is within 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) throw new Error("Timestamp too old");

  const payload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");

  // Comparacao em tempo constante (evita timing attack na verificacao do HMAC).
  if (computed.length !== expectedSig.length) throw new Error("Signature mismatch");
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ expectedSig.charCodeAt(i);
  }
  if (diff !== 0) throw new Error("Signature mismatch");
  return JSON.parse(body);
}

Deno.serve(async (req) => {
  
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const stripeWebhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  async function audit(action: string, targetUserId: string | null, payload: Record<string, unknown>) {
    try {
      await supabase.from("audit_logs").insert({ action, target_user_id: targetUserId, payload });
    } catch (e: any) {
      console.error("[webhook-stripe] audit failed:", e.message);
    }
  }

  // Alerta o admin por e-mail quando algo crítico falha no webhook (ex.: cliente
  // pagou mas a conta não foi provisionada). Nunca quebra o webhook em erro.
  async function alertAdmin(subject: string, detail: string) {
    try {
      const key = Deno.env.get("RESEND_API_KEY");
      if (!key) return;
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Atlas Alertas <suporte@walterespindola.com.br>",
          to: ["suporte@walterespindola.com.br"],
          subject: `[Atlas][ALERTA] ${subject}`,
          text: detail,
        }),
      });
    } catch (e: any) {
      console.error("[webhook-stripe] alertAdmin failed:", e?.message);
    }
  }

  let eventId: string | null = null;
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    if (!stripeWebhookSecret) {
      await audit("webhook_stripe_error", null, { error: "STRIPE_WEBHOOK_SECRET not configured" });
      return respond({ error: "Webhook secret not configured" }, 500);
    }

    let event: any;
    try {
      event = await verifyStripeSignature(body, signature, stripeWebhookSecret);
    } catch (e: any) {
      console.error("[webhook-stripe] signature verification failed:", e.message);
      await audit("webhook_stripe_signature_invalid", null, { error: e.message });
      return respond({ error: "Invalid signature" }, 401);
    }

    const eventType = event.type;
    const obj = event.data?.object;

    // ── IDEMPOTENCY CHECK ──
    // Stripe retries webhooks on timeout/error. Without this check, we'd process
    // the same event multiple times — risk of duplicate subscription creation,
    // plan upgrade duplication, or audit log noise.
    eventId = (event.id as string) || null;
    if (eventId) {
      const { data: existing } = await supabase
        .from("stripe_events_processed")
        .select("event_id")
        .eq("event_id", eventId)
        .maybeSingle();

      if (existing) {
        console.log(`[webhook-stripe] event ${eventId} already processed, skipping`);
        await audit("webhook_stripe_duplicate_skipped", null, { event_id: eventId, event_type: eventType });
        return respond({ received: true, duplicate: true });
      }

      // Mark as processed BEFORE handling to prevent race conditions.
      // If handler fails after this insert, retry from Stripe will be blocked —
      // but that's safer than processing twice. Failures should be investigated
      // via the audit_logs entry.
      const { error: insertErr } = await supabase
        .from("stripe_events_processed")
        .insert({ event_id: eventId, event_type: eventType, stripe_object_id: obj?.id ?? null });

      if (insertErr) {
        // Race condition: another concurrent invocation already inserted.
        // Treat as duplicate.
        if (insertErr.code === "23505") {
          console.log(`[webhook-stripe] event ${eventId} concurrent duplicate, skipping`);
          return respond({ received: true, duplicate: true });
        }
        // Other DB error — log but don't block. Better to risk reprocessing
        // than to fail the webhook entirely (Stripe would retry anyway).
        console.error("[webhook-stripe] failed to persist event_id:", insertErr.message);
      }
    }

    console.log(`[webhook-stripe] event: ${eventType}`);
    await audit("webhook_stripe_received", null, { event_type: eventType, stripe_id: obj?.id });

    // ── COMPRA DE ASSENTOS (Atlas Negócios) — trata separado e retorna cedo ──
    if (eventType === "checkout.session.completed" && obj.metadata?.type === "business_seats") {
      const companyId = obj.metadata?.company_id || null;
      const seats = parseInt(obj.metadata?.seats || "0", 10);
      if (companyId && seats >= 0) {
        await supabase.from("companies").update({ paid_seats: seats, updated_at: new Date().toISOString() }).eq("id", companyId);
        await audit("webhook_stripe_seats", null, { company_id: companyId, seats });
      }
      return respond({ received: true, type: "business_seats" });
    }

    // ── CHECKOUT COMPLETED (new subscription) ──
    if (eventType === "checkout.session.completed") {
      const customerEmail = (obj.customer_email || obj.customer_details?.email || "").toLowerCase().trim();
      const customerName = obj.metadata?.full_name || obj.customer_details?.name || "";
      const phone = obj.metadata?.phone ?? null;
      const subscriptionId = obj.subscription;
      const clientRefId = obj.client_reference_id; // user_id passed from frontend
      const marketingOptIn = obj.metadata?.marketing_opt_in === "true"; // consentimento de marketing (LGPD)

      if (!customerEmail) {
        await audit("webhook_stripe_error", null, { error: "no_email", event_type: eventType });
        await alertAdmin("Pagamento sem e-mail no webhook", `checkout.session.completed sem e-mail — conta não pôde ser criada. stripe_id: ${obj?.id}`);
        return respond({ error: "No email found" }, 400);
      }

      // Detect the purchased plan via price_id
      // Priority: 1) obj.metadata.price_id  2) fetch subscription from Stripe API
      // NUNCA assumir Essencial por padrão — falha ruidosa é melhor que downgrade silencioso.
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
      let resolvedPriceId: string | null = obj.metadata?.price_id || null;

      if (!resolvedPriceId && subscriptionId) {
        try {
          const subRes = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
            headers: { Authorization: `Bearer ${stripeKey}` },
          });
          if (subRes.ok) {
            const sub = await subRes.json();
            resolvedPriceId = sub.items?.data?.[0]?.price?.id || null;
          } else {
            console.error("[webhook-stripe] fetch subscription failed:", subRes.status);
          }
        } catch (e: any) {
          console.error("[webhook-stripe] fetch subscription error:", e.message);
        }
      }

      if (!resolvedPriceId) {
        await audit("webhook_stripe_price_id_missing", null, {
          stripe_subscription_id: subscriptionId,
          stripe_customer: obj.customer,
          session_id: obj.id,
        });
        // 500 força Stripe a retentar — melhor isso que atribuir o plano errado.
        return respond({ error: "Unable to resolve price_id — will retry" }, 500);
      }

      const planInfo = getPlanFromPriceId(resolvedPriceId);
      // Se o price_id não está no nosso mapa, também é erro — alguém criou um preço novo no Stripe sem atualizar o webhook.
      const KNOWN_PRICE_IDS = [
        "price_1TGlL3R5a6AdWPyfkvCo0d7w",
        "price_1TGlLbR5a6AdWPyfgZA4jPqw",
        "price_1TGlLxR5a6AdWPyfEaG0XUXm",
      ];
      if (!KNOWN_PRICE_IDS.includes(resolvedPriceId)) {
        await audit("webhook_stripe_unknown_price_id", null, {
          resolved_price_id: resolvedPriceId,
          stripe_subscription_id: subscriptionId,
        });
        return respond({ error: `Unknown price_id: ${resolvedPriceId}` }, 500);
      }

      // Find or create user
      let userId = clientRefId || null;
      let isNewUser = false;

      // client_reference_id vem de um endpoint publico (create-checkout), entao
      // so confiamos nele se apontar para um usuario que realmente existe.
      // Caso contrario, ignoramos e resolvemos pelo e-mail do pagamento.
      if (userId) {
        const { data: refUser } = await supabase.auth.admin.getUserById(userId);
        if (!refUser?.user) {
          console.log("[webhook-stripe] client_reference_id nao corresponde a usuario existente; resolvendo por e-mail");
          userId = null;
        }
      }

      if (!userId) {
        const { data: foundId } = await supabase.rpc("find_user_id_by_email", { _email: customerEmail });
        if (foundId) {
          userId = foundId as string;
        } else {
          isNewUser = true;
          const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
            email: customerEmail,
            email_confirm: true,
            password: generateThrowawayPassword(),
            user_metadata: { full_name: customerName, phone, signup_source: "stripe_purchase" },
          });
          if (createErr || !newUser?.user) {
            await audit("webhook_stripe_user_create_failed", null, { error: createErr?.message });
            await alertAdmin("Conta NÃO provisionada após pagamento", `Cliente pagou mas a conta não foi criada.\nE-mail: ${customerEmail}\nErro: ${createErr?.message || "desconhecido"}`);
            return respond({ error: "Failed to create user" }, 500);
          }
          userId = newUser.user.id;
        }
      }

      const now = new Date();

      // Update user_subscriptions
      await supabase.from("user_subscriptions").upsert({
        user_id: userId,
        plan_tier: "full",
        access_state: "active",
        origin: "stripe",
        updated_at: now.toISOString(),
        full_expires_at: null, // Stripe manages recurring billing, no fixed expiry
        full_expire_action: "restrict",
        cancelled_at: null,
        restricted_at: null,
      } as any, { onConflict: "user_id" });

      // ── Atribuição de assessor (programa de cupons) ──
      try {
        const discount = Array.isArray(obj.discounts) ? obj.discounts[0] : null;
        const promoId  = discount?.promotion_code ?? null;
        const couponId = typeof discount?.coupon === "string" ? discount.coupon : (discount?.coupon?.id ?? null);
        if (promoId || couponId) {
          const { data: ac } = await supabase
            .from("advisor_coupons")
            .select("id")
            .eq("active", true)
            .or(`stripe_promotion_code_id.eq.${promoId ?? "none"},stripe_coupon_id.eq.${couponId ?? "none"}`)
            .maybeSingle();
          if (ac?.id) {
            await supabase.from("advisor_referrals").upsert({
              advisor_coupon_id: ac.id,
              stripe_subscription_id: subscriptionId,
              stripe_customer_id: obj.customer ?? null,
              user_id: userId ?? null,
              plan: planInfo?.slug ?? null,
            }, { onConflict: "stripe_subscription_id" });
          }
        }
      } catch (e: any) {
        console.error("[webhook-stripe] advisor attribution error", e?.message);
      }

      // Find the plan in our plans table and assign via user_plans
      const { data: planRow } = await supabase.from("plans").select("id").eq("slug", planInfo.slug).maybeSingle();
      if (planRow) {
        await supabase.from("user_plans").upsert({
          user_id: userId,
          plan_id: planRow.id,
          active: true,
          started_at: now.toISOString(),
          expires_at: null,
        } as any, { onConflict: "user_id" });
      }

      // Store stripe customer/subscription IDs for future reference
      const profileUpdate: Record<string, unknown> = {
        stripe_customer_id: obj.customer,
        stripe_subscription_id: subscriptionId,
      };
      if (phone) profileUpdate.phone = phone;
      // So registra opt-in quando o usuario aceitou; nunca revoga consentimento previo aqui.
      if (marketingOptIn) {
        profileUpdate.marketing_opt_in = true;
        profileUpdate.marketing_opt_in_at = new Date().toISOString();
        profileUpdate.marketing_opt_in_source = "checkout";
      }
      await supabase.from("profiles").update(profileUpdate as any).eq("user_id", userId);

      await audit("webhook_stripe_checkout_completed", userId, {
        plan: planInfo.slug,
        is_new_user: isNewUser,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: obj.customer,
      });

      // Send onboarding email (create password link) for new users
      if (isNewUser) {
        try {
          const { url } = await createInviteToken(supabase, {
            userId,
            email: customerEmail,
            source: "admin",
            metadata: { origin: "stripe_purchase", plan: planInfo.slug },
          });
          await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
            body: JSON.stringify({ type: "account_access", to: customerEmail, name: customerName, link: url, user_id: userId }),
          });
        } catch (e: any) {
          console.error("[webhook-stripe] onboarding email failed:", e.message);
        }
      }

      return respond({ success: true, plan: planInfo.slug });
    }

    // ── SUBSCRIPTION CREATED (fired alongside checkout.session.completed) ──
    if (eventType === "customer.subscription.created") {
      const priceId = obj.items?.data?.[0]?.price?.id;
      const planInfo = priceId ? getPlanFromPriceId(priceId) : null;

      const { data: profile } = await supabase.from("profiles")
        .select("user_id").eq("stripe_customer_id", obj.customer).maybeSingle();

      if (!profile) {
        await audit("webhook_stripe_user_not_found", null, { stripe_customer: obj.customer, event_type: eventType });
        return respond({ success: true, message: "User not found, skipping" });
      }

      const userId = (profile as any).user_id;
      const now = new Date();

      if (planInfo) {
        const { data: planRow } = await supabase.from("plans").select("id").eq("slug", planInfo.slug).maybeSingle();
        if (planRow) {
          await supabase.from("user_plans").upsert({
            user_id: userId,
            plan_id: planRow.id,
            active: true,
            started_at: now.toISOString(),
            expires_at: null,
          } as any, { onConflict: "user_id" });
        }

        await supabase.from("user_subscriptions").update({
          plan_tier: "full",
          access_state: "active",
          updated_at: now.toISOString(),
          cancelled_at: null,
        } as any).eq("user_id", userId);
      }

      await audit("webhook_stripe_subscription_created", userId, {
        plan: planInfo?.slug ?? "unknown",
        stripe_subscription_id: obj.id,
        price_id: priceId ?? null,
      });

      return respond({ success: true });
    }

    // ── SUBSCRIPTION UPDATED (upgrade/downgrade/renewal) ──
    // ── ASSENTOS: mudança de quantidade/status sincroniza paid_seats ──
    if (eventType === "customer.subscription.updated" && obj.metadata?.type === "business_seats") {
      const companyId = obj.metadata?.company_id || null;
      const qty = obj.items?.data?.[0]?.quantity ?? 0;
      const active = obj.status === "active" || obj.status === "trialing";
      if (companyId) {
        await supabase.from("companies").update({ paid_seats: active ? qty : 0, updated_at: new Date().toISOString() }).eq("id", companyId);
        await audit("webhook_stripe_seats_updated", null, { company_id: companyId, seats: active ? qty : 0, status: obj.status });
      }
      return respond({ received: true, type: "business_seats_updated" });
    }

    if (eventType === "customer.subscription.updated") {
      const customerEmail = obj.customer_email || "";
      const priceId = obj.items?.data?.[0]?.price?.id;
      const planInfo = priceId ? getPlanFromPriceId(priceId) : null;
      const status = obj.status; // active, past_due, canceled, unpaid

      // Find user by stripe customer ID
      const { data: profile } = await supabase.from("profiles")
        .select("user_id").eq("stripe_customer_id", obj.customer).maybeSingle();

      if (!profile) {
        await audit("webhook_stripe_user_not_found", null, { stripe_customer: obj.customer });
        return respond({ success: true, message: "User not found, skipping" });
      }

      const userId = (profile as any).user_id;
      const now = new Date();

      if (status === "active" && planInfo) {
        // Active subscription — update plan
        const { data: planRow } = await supabase.from("plans").select("id").eq("slug", planInfo.slug).maybeSingle();
        if (planRow) {
          await supabase.from("user_plans").upsert({
            user_id: userId,
            plan_id: planRow.id,
            active: true,
            started_at: now.toISOString(),
          } as any, { onConflict: "user_id" });
        }

        await supabase.from("user_subscriptions").update({
          plan_tier: "full",
          access_state: "active",
          updated_at: now.toISOString(),
          cancelled_at: null,
        } as any).eq("user_id", userId);

        await audit("webhook_stripe_plan_updated", userId, { plan: planInfo.slug, status });
      }

      if (status === "past_due") {
        await audit("webhook_stripe_past_due", userId, { stripe_subscription: obj.id });
        // Don't restrict yet — Stripe will retry payment (dunning)
      }

      // Fim do dunning sem pagamento: o Stripe pode marcar 'canceled' ou 'unpaid'
      // aqui (em vez de disparar subscription.deleted). Aplica a mesma carência.
      if (status === "canceled" || status === "unpaid") {
        const graceEnd = new Date(now);
        graceEnd.setDate(graceEnd.getDate() + 30);
        await supabase.from("user_subscriptions").update({
          access_state: "cancelled_grace",
          cancelled_at: now.toISOString(),
          grace_finance_until: graceEnd.toISOString(),
          updated_at: now.toISOString(),
        } as any).eq("user_id", userId);
        await supabase.from("user_plans").update({ active: false }).eq("user_id", userId);
        await audit("webhook_stripe_sub_inactive_via_updated", userId, { status, grace_until: graceEnd.toISOString() });
      }

      return respond({ success: true });
    }

    // ── ASSENTOS: cancelamento zera paid_seats ──
    if (eventType === "customer.subscription.deleted" && obj.metadata?.type === "business_seats") {
      const companyId = obj.metadata?.company_id || null;
      if (companyId) {
        await supabase.from("companies").update({ paid_seats: 0, updated_at: new Date().toISOString() }).eq("id", companyId);
        await audit("webhook_stripe_seats_cancelled", null, { company_id: companyId });
      }
      return respond({ received: true, type: "business_seats_cancelled" });
    }

    // ── SUBSCRIPTION DELETED (cancelled, expired) ──
    if (eventType === "customer.subscription.deleted") {
      const { data: profile } = await supabase.from("profiles")
        .select("user_id").eq("stripe_customer_id", obj.customer).maybeSingle();

      if (!profile) {
        return respond({ success: true, message: "User not found" });
      }

      const userId = (profile as any).user_id;
      const now = new Date();
      const graceEnd = new Date(now);
      graceEnd.setDate(graceEnd.getDate() + 30); // 30 days grace period

      await supabase.from("user_subscriptions").update({
        access_state: "cancelled_grace",
        cancelled_at: now.toISOString(),
        grace_finance_until: graceEnd.toISOString(),
        updated_at: now.toISOString(),
      } as any).eq("user_id", userId);

      await supabase.from("user_plans").update({
        active: false,
      }).eq("user_id", userId);

      await audit("webhook_stripe_subscription_deleted", userId, {
        grace_until: graceEnd.toISOString(),
      });

      return respond({ success: true, action: "cancelled_with_grace" });
    }

    // ── INVOICE PAYMENT FAILED ──
    if (eventType === "invoice.payment_failed") {
      const { data: profile } = await supabase.from("profiles")
        .select("user_id").eq("stripe_customer_id", obj.customer).maybeSingle();

      if (profile) {
        const userId = (profile as any).user_id;

        await audit("webhook_stripe_payment_failed", userId, {
          attempt: obj.attempt_count,
          next_attempt: obj.next_payment_attempt,
        });

        // ── E-mail de dunning: avisa o cliente da falha de pagamento. ──
        // Em erro de envio, apenas loga — nunca quebra o webhook.
        try {
          // E-mail vem da invoice (customer_email) ou, em fallback, do auth user.
          let customerEmail: string = (obj.customer_email || "").toLowerCase().trim();
          let customerName = obj.customer_name || "";
          if (!customerEmail) {
            const { data: authUser } = await supabase.auth.admin.getUserById(userId);
            customerEmail = (authUser?.user?.email || "").toLowerCase().trim();
            customerName = customerName || (authUser?.user?.user_metadata?.full_name as string) || "";
          }
          if (customerEmail) {
            await fetch(`${supabaseUrl}/functions/v1/send-email`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceRoleKey}` },
              body: JSON.stringify({ type: "payment_failed", to: customerEmail, name: customerName, user_id: userId }),
            });
          } else {
            console.error("[webhook-stripe] payment_failed: no email found for user", userId);
          }
        } catch (e: any) {
          console.error("[webhook-stripe] dunning email failed:", e.message);
        }

        // Don't restrict access — Stripe is still retrying (dunning).
        // The real restriction only happens on customer.subscription.deleted,
        // which applies the 30-day grace period.
      }

      return respond({ success: true });
    }

    // Unknown event — log and ignore
    await audit("webhook_stripe_unhandled", null, { event_type: eventType });
    return respond({ success: true, message: "Event not handled" });

  } catch (err: any) {
    console.error("[webhook-stripe] error:", err.message);
    // Rollback do marcador de idempotência: se o handler falhou, removemos o
    // event_id pra que o retry do Stripe consiga reprocessar (evita "pagou e não
    // recebeu acesso"). A proteção contra duplicado real continua via 23505.
    if (eventId) {
      await supabase.from("stripe_events_processed").delete().eq("event_id", eventId).catch(() => {});
    }
    await audit("webhook_stripe_error", null, { error: err.message }).catch(() => {});
    await alertAdmin("Erro inesperado no webhook Stripe", `O webhook falhou e o evento foi liberado pra retry.\nErro: ${err?.message}`).catch(() => {});
    return respond({ error: "Internal server error" }, 500);
  }
});
