import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { company_id, seats } = await req.json();
    const n = parseInt(String(seats), 10);
    if (!n || n < 1 || n > 9) {
      return new Response(JSON.stringify({ error: "Quantidade de assentos inválida (1 a 9)" }), { status: 400, headers: corsHeaders });
    }

    // Só o dono compra assentos
    const { data: company } = await admin.from("companies").select("id, user_id, name").eq("id", company_id).single();
    if (!company || company.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Apenas o dono pode comprar assentos" }), { status: 403, headers: corsHeaders });
    }

    const priceId = Deno.env.get("STRIPE_SEAT_PRICE_ID");
    if (!priceId) {
      return new Response(JSON.stringify({ error: "Preço de assento não configurado (STRIPE_SEAT_PRICE_ID)" }), { status: 500, headers: corsHeaders });
    }
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const { data: ownerData } = await admin.auth.admin.getUserById(userId);
    const ownerEmail = ownerData?.user?.email;

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", String(n));
    if (ownerEmail) form.set("customer_email", ownerEmail);
    form.set("client_reference_id", userId);
    form.set("success_url", "https://app.useatlasapp.com/dashboard/negocios?seats=ok");
    form.set("cancel_url", "https://app.useatlasapp.com/dashboard/negocios");
    form.set("metadata[type]", "business_seats");
    form.set("metadata[company_id]", String(company_id));
    form.set("metadata[seats]", String(n));
    form.set("subscription_data[metadata][type]", "business_seats");
    form.set("subscription_data[metadata][company_id]", String(company_id));
    form.set("subscription_data[metadata][seats]", String(n));

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${stripeKey}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const session = await res.json();
    if (!res.ok) {
      console.error("[business-seats-checkout] stripe error:", session);
      return new Response(JSON.stringify({ error: session?.error?.message || "Erro no Stripe" }), { status: 500, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ url: session.url }), { headers: corsHeaders });
  } catch (e) {
    console.error("[business-seats-checkout] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
