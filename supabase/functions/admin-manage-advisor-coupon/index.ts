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
    .from("user_roles").select("role")
    .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
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

  const action = String(payload?.action ?? "");
  const couponId = String(payload?.coupon_id ?? "");
  if (!couponId) return new Response(JSON.stringify({ error: "missing_coupon_id" }), { status: 400, headers: corsHeaders });

  const service = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: row, error: rowErr } = await service
    .from("advisor_coupons").select("*").eq("id", couponId).maybeSingle();
  if (rowErr || !row) {
    return new Response(JSON.stringify({ error: "coupon_not_found" }), { status: 404, headers: corsHeaders });
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripeHeaders = {
    Authorization: `Bearer ${stripeKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (action === "toggle") {
    const nextActive = !!payload?.active;
    if (row.stripe_promotion_code_id && stripeKey) {
      const form = new URLSearchParams();
      form.set("active", String(nextActive));
      const res = await fetch(`https://api.stripe.com/v1/promotion_codes/${row.stripe_promotion_code_id}`, {
        method: "POST", headers: stripeHeaders, body: form.toString(),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("[advisor-coupon] toggle stripe error", res.status, t.slice(0, 300));
        return new Response(JSON.stringify({ error: "stripe_toggle_error", detail: t.slice(0, 300) }), { status: 502, headers: corsHeaders });
      }
    }
    const { error: upErr } = await service.from("advisor_coupons").update({ active: nextActive }).eq("id", couponId);
    if (upErr) return new Response(JSON.stringify({ error: "db_error", db_message: upErr.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ ok: true, active: nextActive }), { status: 200, headers: corsHeaders });
  }

  if (action === "update") {
    const patch: Record<string, unknown> = {};
    if (payload?.advisor_name !== undefined) {
      const name = String(payload.advisor_name).trim();
      if (!name || name.length > 200) return new Response(JSON.stringify({ error: "invalid_advisor_name" }), { status: 400, headers: corsHeaders });
      patch.advisor_name = name;
    }
    if (payload?.commission_pct !== undefined) {
      const c = Number(payload.commission_pct);
      if (!(c >= 0 && c <= 100)) return new Response(JSON.stringify({ error: "invalid_commission_pct" }), { status: 400, headers: corsHeaders });
      patch.commission_pct = c;
    }
    if (Object.keys(patch).length === 0) return new Response(JSON.stringify({ error: "nothing_to_update" }), { status: 400, headers: corsHeaders });
    const { error: upErr } = await service.from("advisor_coupons").update(patch).eq("id", couponId);
    if (upErr) return new Response(JSON.stringify({ error: "db_error", db_message: upErr.message }), { status: 500, headers: corsHeaders });
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  }

  if (action === "delete") {
    if (row.stripe_coupon_id && stripeKey) {
      const res = await fetch(`https://api.stripe.com/v1/coupons/${row.stripe_coupon_id}`, {
        method: "DELETE", headers: stripeHeaders,
      });
      if (!res.ok && res.status !== 404) {
        const t = await res.text();
        console.error("[advisor-coupon] delete stripe error", res.status, t.slice(0, 300));
        return new Response(JSON.stringify({ error: "stripe_delete_error", detail: t.slice(0, 300) }), { status: 502, headers: corsHeaders });
      }
    }
    const { error: delErr } = await service.from("advisor_coupons").delete().eq("id", couponId);
    if (delErr) {
      await service.from("advisor_coupons").update({ active: false }).eq("id", couponId);
      return new Response(JSON.stringify({ ok: true, softDeleted: true, reason: "tinha_indicacoes" }), { status: 200, headers: corsHeaders });
    }
    return new Response(JSON.stringify({ ok: true, deleted: true }), { status: 200, headers: corsHeaders });
  }

  return new Response(JSON.stringify({ error: "unknown_action" }), { status: 400, headers: corsHeaders });
});
