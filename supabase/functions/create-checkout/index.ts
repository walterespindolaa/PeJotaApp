import { getCorsHeadersWithContentType, getCorsHeaders } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const PRICE_MAP: Record<string, string> = {
  essencial: "price_1TGlL3R5a6AdWPyfkvCo0d7w",
  pro: "price_1TGlLbR5a6AdWPyfgZA4jPqw",
  elite: "price_1TGlLxR5a6AdWPyfEaG0XUXm",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function hashEmail(email: string): string {
  // Simple non-crypto hash to use as rate-limit key without storing the email
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = ((h << 5) - h + email.charCodeAt(i)) | 0;
  }
  return `email_${(h >>> 0).toString(36)}`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: corsHeaders });
  }

  const plano = typeof payload?.plano === "string" ? payload.plano.trim().toLowerCase() : "";
  const nome = typeof payload?.nome === "string" ? payload.nome.trim() : "";
  const email = typeof payload?.email === "string" ? payload.email.trim().toLowerCase() : "";
  const telefone = typeof payload?.telefone === "string" ? payload.telefone.trim() : "";
  const clientRefId = typeof payload?.client_reference_id === "string" ? payload.client_reference_id.trim() : "";
  const aceitoMarketing = payload?.aceito_marketing === true;

  if (!PRICE_MAP[plano]) {
    return new Response(JSON.stringify({ error: "invalid_plan" }), { status: 400, headers: corsHeaders });
  }
  if (!email || !EMAIL_RE.test(email) || email.length > 255) {
    return new Response(JSON.stringify({ error: "invalid_email" }), { status: 400, headers: corsHeaders });
  }
  if (!nome || nome.length > 200) {
    return new Response(JSON.stringify({ error: "invalid_name" }), { status: 400, headers: corsHeaders });
  }
  if (!telefone || telefone.length > 40) {
    return new Response(JSON.stringify({ error: "invalid_phone" }), { status: 400, headers: corsHeaders });
  }

  // Rate limit by email — public endpoint, no auth. Use deterministic UUID derived from email hash.
  const emailKey = hashEmail(email);
  // checkRateLimit expects a uuid user_id; build a deterministic one from the email hash.
  const enc = new TextEncoder().encode(email);
  const digest = await crypto.subtle.digest("SHA-256", enc);
  const bytes = new Uint8Array(digest);
  const hex = Array.from(bytes.slice(0, 16)).map((b) => b.toString(16).padStart(2, "0")).join("");
  const pseudoUuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;

  const rl = await checkRateLimit(pseudoUuid, { scope: "create-checkout", window: "hour", limit: 10 });
  if (!rl.allowed) {
    return rateLimitResponse(rl, corsHeaders);
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    console.error("[create-checkout] STRIPE_SECRET_KEY not configured");
    return new Response(JSON.stringify({ error: "stripe_not_configured" }), { status: 500, headers: corsHeaders });
  }

  const priceId = PRICE_MAP[plano];

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("customer_email", email);
  if (clientRefId) form.set("client_reference_id", clientRefId);
  form.set("allow_promotion_codes", "true");
  form.set("success_url", "https://app.useatlasapp.com/comprar/sucesso?session_id={CHECKOUT_SESSION_ID}");
  form.set("cancel_url", `https://app.useatlasapp.com/comprar/${plano}`);
  form.set("metadata[price_id]", priceId);
  form.set("metadata[plan]", plano);
  form.set("metadata[full_name]", nome);
  form.set("metadata[phone]", telefone);
  form.set("metadata[marketing_opt_in]", aceitoMarketing ? "true" : "false");
  form.set("subscription_data[metadata][price_id]", priceId);
  form.set("subscription_data[metadata][plan]", plano);
  form.set("subscription_data[metadata][full_name]", nome);
  form.set("subscription_data[metadata][phone]", telefone);
  form.set("subscription_data[metadata][marketing_opt_in]", aceitoMarketing ? "true" : "false");

  try {
    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
    });

    if (!stripeRes.ok) {
      const errBody = await stripeRes.text();
      console.error("[create-checkout] stripe error:", stripeRes.status, errBody.slice(0, 500));
      return new Response(JSON.stringify({ error: "stripe_error" }), { status: 502, headers: corsHeaders });
    }

    const session = await stripeRes.json();
    if (!session?.url) {
      console.error("[create-checkout] missing session url");
      return new Response(JSON.stringify({ error: "stripe_invalid_response" }), { status: 502, headers: corsHeaders });
    }

    console.log(`[create-checkout] session created plan=${plano} key=${emailKey}`);
    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("[create-checkout] fetch failed:", e?.message);
    return new Response(JSON.stringify({ error: "internal_error" }), { status: 500, headers: corsHeaders });
  }
});