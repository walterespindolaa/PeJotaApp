import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePlan } from "@/hooks/usePlan";
import type { AccessState } from "@/hooks/usePlan";
import { logError } from "@/lib/log";

export type FeatureKey =
  | "planejamento_controle"
  | "lancamentos"
  | "calendario_pagamentos"
  | "analises"
  | "extrato_bancario"
  | "express_objetivos"
  | "express_aposentadoria"
  | "relatorio_controle"
  | "importar_ofx"
  | "importar_planilha"
  | "fatura_cartao"
  | "objetivos_de_vida"
  | "aposentadoria"
  | "investimentos"
  | "bens_imoveis"
  | "protecao_seguros"
  | "relatorio_atlas"
  | "evolucao_patrimonial"
  | "atlas_negocios"
  | "projecao_patrimonial"
  | "plano_liberdade"
  | "manual_do_dinheiro"
  | "dominando_variavel"
  | "planejamento_financeiro_curso"
  | "curso_organizacao"
  | "renda_passiva_fiis"
  | "financas_casal"
  | "planejamento_tributario"
  | "novo_mapa_dinheiro";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

interface FeatureAccessState {
  loading: boolean;
  userPlan: Plan | null;
  allPlans: Plan[];
  features: Set<FeatureKey>;
  hasFeature: (key: FeatureKey) => boolean;
  requiredPlanFor: (key: FeatureKey) => Plan | null;
  isTrialActive: boolean;
  accessState: AccessState;
}

const PLAN_ORDER = ["atlas_essencial", "atlas_pro", "atlas_elite"];

/** The slug whose features trial users inherit (Pro, not Elite) */
const TRIAL_PLAN_SLUG = "atlas_pro";

/** Features available during trial_expired / cancelled_grace / awaiting_payment */
const GRACE_FEATURES: FeatureKey[] = ["planejamento_controle", "lancamentos"];

/** Cursos pagos — NÃO liberados no trial (a partir do Essencial pago) */
const PAID_ONLY_FEATURES: FeatureKey[] = [
  "curso_organizacao",
  "plano_liberdade",
  "manual_do_dinheiro",
  "planejamento_financeiro_curso",
  "planejamento_tributario",
  "novo_mapa_dinheiro",
];

export const useFeatureAccess = (): FeatureAccessState => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { isTrialActive, accessState, loading: planLoading } = usePlan();
  const [loading, setLoading] = useState(true);
  const [userPlan, setUserPlan] = useState<Plan | null>(null);
  const [allPlans, setAllPlans] = useState<Plan[]>([]);
  const [featuresByPlan, setFeaturesByPlan] = useState<Record<string, FeatureKey[]>>({});
  const [userFeatures, setUserFeatures] = useState<FeatureKey[]>([]);
  const [isCompanyMember, setIsCompanyMember] = useState(false);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (roleLoading || planLoading) return;

    const load = async () => {
      // Use the SECURITY DEFINER RPC to get the effective plan state (bypasses RLS)
      const { data: stateData, error: stateErr } = await supabase.rpc("get_effective_plan_state");
      if (stateErr) {
        logError("[useFeatureAccess] get_effective_plan_state error:", stateErr.message);
      }
      const state = stateData as any;
      const effectivePlanId = state?.plan_id || null;

      const [plansRes, pfRes] = await Promise.all([
        supabase.from("plans").select("id, name, slug, description").order("created_at"),
        supabase.from("plan_features").select("plan_id, feature_key"),
      ]);

      const plansList = (plansRes.data || []) as Plan[];
      setAllPlans(plansList);

      const fbp: Record<string, FeatureKey[]> = {};
      for (const f of pfRes.data || []) {
        if (!fbp[f.plan_id]) fbp[f.plan_id] = [];
        fbp[f.plan_id].push(f.feature_key as FeatureKey);
      }
      setFeaturesByPlan(fbp);

      const currentPlan = effectivePlanId ? plansList.find(p => p.id === effectivePlanId) || null : null;
      setUserPlan(currentPlan);
      setUserFeatures(currentPlan ? (fbp[currentPlan.id] || []) : []);

      // Membro de empresa ganha acesso ao PeJota Negócios (o dono paga o assento)
      const { count } = await supabase.from("company_members" as any).select("id", { count: "exact", head: true }).eq("user_id", user.id);
      setIsCompanyMember((count || 0) > 0);

      setLoading(false);
    };

    load();
  }, [user, roleLoading, planLoading]);

  return useMemo(() => {
    const combinedLoading = loading || roleLoading || planLoading;
    const allFeaturesList = Object.values(featuresByPlan).flat() as FeatureKey[];

    const lowestPlanFor = (key: FeatureKey): Plan | null => {
      for (const slug of PLAN_ORDER) {
        const plan = allPlans.find(p => p.slug === slug);
        if (!plan) continue;
        if ((featuresByPlan[plan.id] || []).includes(key)) return plan;
      }
      return null;
    };

    // Admins → all features
    if (isAdmin) {
      return {
        loading: combinedLoading,
        userPlan: userPlan || { id: "", name: "Admin", slug: "admin", description: null },
        allPlans,
        features: new Set<FeatureKey>(allFeaturesList),
        hasFeature: () => true,
        requiredPlanFor: () => null,
        isTrialActive: false,
        accessState: "active_paid" as AccessState,
      };
    }

    // Trial active → same features as Pro plan (not Elite)
    if (isTrialActive) {
      const trialPlan = allPlans.find(p => p.slug === TRIAL_PLAN_SLUG);
      const trialFeatures = trialPlan ? new Set<FeatureKey>(featuresByPlan[trialPlan.id] || []) : new Set<FeatureKey>(allFeaturesList);
      // Cursos são pagos: fora do trial (upsell aponta pro menor plano que tem o curso = Essencial).
      PAID_ONLY_FEATURES.forEach(f => trialFeatures.delete(f));
      if (isCompanyMember) trialFeatures.add("atlas_negocios");
      return {
        loading: combinedLoading,
        userPlan: trialPlan || userPlan || { id: "", name: "Trial", slug: "trial", description: null },
        allPlans,
        features: trialFeatures,
        hasFeature: (key: FeatureKey) => trialFeatures.has(key),
        requiredPlanFor: (key: FeatureKey) => {
          if (trialFeatures.has(key)) return null;
          return lowestPlanFor(key);
        },
        isTrialActive: true,
        accessState: "trial_active" as AccessState,
      };
    }

    // Inactive user → no features at all
    if (accessState === "inactive_user") {
      return {
        loading: combinedLoading,
        userPlan,
        allPlans,
        features: new Set<FeatureKey>(),
        hasFeature: () => false,
        requiredPlanFor: lowestPlanFor,
        isTrialActive: false,
        accessState,
      };
    }

    // Awaiting payment / trial_expired / cancelled_grace → only basic features
    if (accessState === "awaiting_payment" || accessState === "trial_expired" || accessState === "cancelled_grace") {
      const graceSet = new Set<FeatureKey>(GRACE_FEATURES);
      if (isCompanyMember) graceSet.add("atlas_negocios");
      return {
        loading: combinedLoading,
        userPlan,
        allPlans,
        features: graceSet,
        hasFeature: (key: FeatureKey) => graceSet.has(key),
        requiredPlanFor: (key: FeatureKey) => {
          if (graceSet.has(key)) return null;
          return lowestPlanFor(key);
        },
        isTrialActive: false,
        accessState,
      };
    }

    // Active paid → features from their specific plan (Essencial / Pro / Elite)
    const features = new Set<FeatureKey>(userFeatures);
    if (isCompanyMember) features.add("atlas_negocios");
    const hasFeature = (key: FeatureKey) => features.has(key);
    const requiredPlanFor = (key: FeatureKey): Plan | null => {
      if (features.has(key)) return null;
      return lowestPlanFor(key);
    };

    return {
      loading: combinedLoading,
      userPlan,
      allPlans,
      features,
      hasFeature,
      requiredPlanFor,
      isTrialActive: false,
      accessState,
    };
  }, [loading, userPlan, allPlans, featuresByPlan, userFeatures, isAdmin, roleLoading, isTrialActive, planLoading, accessState, isCompanyMember]);
};
