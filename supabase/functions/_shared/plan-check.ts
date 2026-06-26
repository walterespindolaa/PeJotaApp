import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

async function resolveEffectiveUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .eq("role", "member")
    .in("status", ["active", "invited"])
    .maybeSingle();

  if (!membership?.household_id) return userId;

  const { data: household } = await supabase
    .from("households")
    .select("owner_id")
    .eq("id", membership.household_id)
    .maybeSingle();

  return household?.owner_id || userId;
}

/**
 * Checks if a user has active premium (full) access.
 * Household members inherit plan validation from the owner account.
 */
export async function hasPremiumAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const effectiveUserId = await resolveEffectiveUserId(supabase, userId);

  // Check admin role first
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", effectiveUserId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleData) return true;

  // Check subscription
  const { data: sub } = await supabase
    .from("user_subscriptions")
    .select("plan_tier, access_state, trial_expires_at, full_expires_at")
    .eq("user_id", effectiveUserId)
    .maybeSingle();

  if (!sub) return false;

  // awaiting_payment → no access
  if (sub.access_state === "awaiting_payment") return false;

  // Active full subscription (not expired)
  if (sub.plan_tier === "full") {
    if (!sub.full_expires_at) return true;
    return new Date(sub.full_expires_at).getTime() > Date.now();
  }

  // Trial active
  if (sub.access_state === "trial" && sub.trial_expires_at) {
    return new Date(sub.trial_expires_at).getTime() > Date.now();
  }

  return false;
}

/**
 * Check if user has access to a specific feature based on their plan.
 * Returns true if the user's plan includes the feature_key.
 */
export async function hasFeatureAccess(
  supabase: SupabaseClient,
  userId: string,
  featureKey: string
): Promise<boolean> {
  const effectiveUserId = await resolveEffectiveUserId(supabase, userId);

  // Admin bypass
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", effectiveUserId)
    .eq("role", "admin")
    .maybeSingle();
  if (roleData) return true;

  // Get user's plan via the RPC
  const serviceSupabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: stateData } = await serviceSupabase.rpc("get_effective_plan_state_for_user", { target_user_id: effectiveUserId });
  const planId = (stateData as any)?.plan_id;
  if (!planId) return false;

  // Check if plan includes this feature
  const { data: feature } = await serviceSupabase
    .from("plan_features")
    .select("id")
    .eq("plan_id", planId)
    .eq("feature_key", featureKey)
    .maybeSingle();

  return !!feature;
}

export function featureDeniedResponse(corsHeaders: Record<string, string>, featureKey: string) {
  return new Response(
    JSON.stringify({ error: `Recurso "${featureKey}" não disponível no seu plano atual. Faça upgrade para acessar.` }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export function premiumDeniedResponse(corsHeaders: Record<string, string>) {
  return new Response(
    JSON.stringify({ error: "Recurso disponível apenas para assinantes. Faça upgrade para continuar." }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
