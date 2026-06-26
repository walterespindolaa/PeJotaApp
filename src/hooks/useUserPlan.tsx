import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { logError } from "@/lib/log";

interface UserPlanAccess {
  loading: boolean;
  acesso_organiza_2026: boolean;
  acesso_planejamento_360: boolean;
  tier: string | null;
}

export const useUserPlan = (): UserPlanAccess => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const load = async () => {
      // Use the SECURITY DEFINER RPC to get effective plan (bypasses RLS for inherited plans)
      const { data: stateData, error: stateErr } = await supabase.rpc("get_effective_plan_state");
      if (stateErr) {
        logError("[useUserPlan] get_effective_plan_state error:", stateErr.message);
      }

      const state = stateData as any;
      const effectiveUserId = state?.effective_user_id || user.id;

      // Now query user_plans - but we need the tier which is on user_plans directly
      // For inherited plans, we need to read from the owner's user_plans
      // Since RLS blocks this, we'll use the plan_slug from the RPC to infer the tier
      const planSlug = state?.plan_slug;
      
      if (planSlug === "atlas_elite") {
        setTier("planejamento_360");
      } else if (planSlug === "atlas_pro") {
        setTier("planejamento_360");
      } else if (planSlug === "atlas_essencial") {
        setTier("organiza_2026");
      } else {
        // Fallback: try reading own user_plans (works for non-inherited)
        const { data } = await supabase
          .from("user_plans")
          .select("tier")
          .eq("user_id", user.id)
          .eq("active", true)
          .limit(1)
          .single();
        setTier(data?.tier ?? null);
      }
      
      setLoading(false);
    };

    load();
  }, [user]);

  // Durante o trial (7 dias) o acesso é completo — libera os dois módulos.
  const { isTrialActive } = usePlan();

  // organiza_2026 → só organiza · planejamento_360 → ambos · trial ativo → ambos
  const acesso_organiza_2026 = isTrialActive || tier === "organiza_2026" || tier === "planejamento_360";
  const acesso_planejamento_360 = isTrialActive || tier === "planejamento_360";

  return { loading, acesso_organiza_2026, acesso_planejamento_360, tier };
};
