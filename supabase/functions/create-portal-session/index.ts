import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getCorsHeadersWithContentType } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });

  const corsHeaders = getCorsHeadersWithContentType(req);

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user)
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "No Stripe customer found" }),
        { status: 404, headers: corsHeaders }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
    const bodyData = await req.json().catch(() => ({}));
    const rawReturnUrl = bodyData.return_url || "";

    // Validate return_url against allowlist
    const ALLOWED_RETURN_PREFIXES = [
      "https://app.useatlasapp.com",
      "https://useatlasapp.com",
    ];
    const return_url = ALLOWED_RETURN_PREFIXES.some(prefix => rawReturnUrl.startsWith(prefix))
      ? rawReturnUrl
      : "https://app.useatlasapp.com/dashboard/planos";

    const portalRes = await fetch(
      "https://api.stripe.com/v1/billing_portal/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          customer: profile.stripe_customer_id,
          return_url,
        }),
      }
    );

    const portal = await portalRes.json();
    if (!portalRes.ok)
      return new Response(
        JSON.stringify({ error: portal.error?.message }),
        { status: 400, headers: corsHeaders }
      );

    return new Response(JSON.stringify({ url: portal.url }), {
      headers: corsHeaders,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
