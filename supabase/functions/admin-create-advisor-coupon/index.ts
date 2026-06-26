import { getCorsHeadersWithContentType, getCorsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function verifyAdmin(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error } = await userClient.auth.getUser(token);
  if (error || !userData?.user) return null;

  const service = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleData } = await service
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleData) return null;
  return userData.user.id;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: getCorsHeaders(req) });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: corsHeaders });
  }

  const adminId = await verifyAdmin(req);
  if (!adminId) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: corsHeaders });
  }

  let payload: any;
  try { payload = await req.json(); }
  catch { return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400, headers: corsHeaders }); }

  const advisorName = String(payload?.advisor_name ?? "").trim();
  const code = String(payload?.code ?? "").trim().toUpperCase();
  const percentOff = Number(payload?.percent_off);
  const commissionPct = Number(payload?.commission_pct);
  const durationMonths = payload?.duration_months ? Number(payload.duration_months) : null;

  const bad = (e: string, detail?: string) =>
    new Response(JSON.stringify({ error: e, ...(detail ? { detail } : {}) }), { status: 400, headers: corsHeaders });

  if (!advisorName || advisorName.length > 200) return bad("invalid_advisor_name");
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) return bad("invalid_code", "Use A-Z, 0-9, _ ou - (3 a 40 chars).");
  if (!(percentOff > 0 && percentOff <= 100)) return bad("invalid_percent_off");
  if (!(commissionPct >= 0 && commissionPct <= 100)) return bad("invalid_commission_pct");

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) {
    return new Response(JSON.stringify({ error: "stripe_not_configured" }), { status: 500, headers: corsHeaders });
  }
  const stripeHeaders = {
    Authorization: `Bearer ${stripeKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // 1) Coupon
  const couponForm = new URLSearchParams();
  couponForm.set("percent_off", String(percentOff));
  if (durationMonths && durationMonths > 0) {
    couponForm.set("duration", "repeating");
    couponForm.set("duration_in_months", String(durationMonths));
  } else {
    couponForm.set("duration", "forever");
  }
  couponForm.set("name", `Assessor: ${advisorName}`);
  couponForm.set("metadata[advisor_name]", advisorName);
  couponForm.set("metadata[origin]", "advisor_program");

  const couponRes = await fetch("https://api.stripe.com/v1/coupons", {
    method: "POST", headers: stripeHeaders, body: couponForm.toString(),
  });
  if (!couponRes.ok) {
    console.error("[advisor-coupon] coupon error", couponRes.status, (await couponRes.text()).slice(0, 300));
    return new Response(JSON.stringify({ error: "stripe_coupon_error" }), { status: 502, headers: corsHeaders });
  }
  const coupon = await couponRes.json();

  // 2) Promotion code
  const promoForm = new URLSearchParams();
  promoForm.set("promotion[type]", "coupon");
  promoForm.set("promotion[coupon]", coupon.id);
  promoForm.set("code", code);
  promoForm.set("metadata[advisor_name]", advisorName);

  const promoRes = await fetch("https://api.stripe.com/v1/promotion_codes", {
    method: "POST", headers: stripeHeaders, body: promoForm.toString(),
  });
  if (!promoRes.ok) {
    const promoErrText = await promoRes.text();
    console.error("[advisor-coupon] promo error", promoRes.status, promoErrText.slice(0, 500));
    return new Response(
      JSON.stringify({ error: "stripe_promo_error", detail: promoErrText.slice(0, 500) }),
      { status: 502, headers: corsHeaders },
    );
  }
  const promo = await promoRes.json();

  // 3) Persist
  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row, error: insErr } = await service
    .from("advisor_coupons")
    .insert({
      advisor_name: advisorName,
      code,
      percent_off: percentOff,
      commission_pct: commissionPct,
      duration_months: durationMonths,
      stripe_coupon_id: coupon.id,
      stripe_promotion_code_id: promo.id,
      created_by: adminId,
    })
    .select()
    .single();

  if (insErr) {
    console.error("[advisor-coupon] db insert error", {
      message: insErr.message, code: insErr.code, details: insErr.details, hint: insErr.hint,
    });
    return new Response(
      JSON.stringify({
        error: "db_error",
        db_code: insErr.code,
        db_message: insErr.message,
        db_details: insErr.details,
        db_hint: insErr.hint,
      }),
      { status: 500, headers: corsHeaders },
    );
  }

  return new Response(JSON.stringify({ ok: true, coupon: row }), { status: 200, headers: corsHeaders });
});