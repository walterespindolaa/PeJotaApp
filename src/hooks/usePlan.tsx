import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { logError } from "@/lib/log";
import { computePlanState, type AccessState } from "@/lib/planState";

/**
 * Estados de acesso da plataforma PeJota:
 *
 * trial_active      → usuário de trial, dentro de 7 dias. Acesso total.
 * trial_expired     → trial vencido, não pagou. Carência 30 dias (Dashboard + Planejamento).
 * active_paid       → assinante pagante (Essencial / Pro / Elite).
 * cancelled_grace   → era pagante, parou. Carência 30 dias.
 * awaiting_payment  → usuário do fluxo normal, nunca pagou.
 * inactive_user     → bloqueio total.
 *
 * A lógica de decisão vive em src/lib/planState.ts (pura e testada).
 */
export type { AccessState };

interface PlanState {
  loading: boolean;
  planTier: "free" | "essencial" | "pro" | "elite";
  accessState: AccessState;
  isTrialActive: boolean;
  isGraceFinanceActive: boolean;
  isRestricted: boolean;
  isFull: boolean;
  isInactive: boolean;
  isAwaitingPayment: boolean;
  daysRemainingTrial: number;
  daysRemainingGrace: number;
  daysUntilDeletion: number;
  daysUntilFullExpires: number;
  trialExpiresAt: string | null;
  graceFinanceUntil: string | null;
  scheduledDeletionAt: string | null;
  fullExpiresAt: string | null;
  showRenewalBanner: boolean;
}

const ADMIN_FULL: PlanState = {
  loading: false,
  planTier: "elite",
  accessState: "active_paid",
  isTrialActive: false,
  isGraceFinanceActive: false,
  isRestricted: false,
  isFull: true,
  isInactive: false,
  isAwaitingPayment: false,
  daysRemainingTrial: 0,
  daysRemainingGrace: 0,
  daysUntilDeletion: 0,
  daysUntilFullExpires: 0,
  trialExpiresAt: null,
  graceFinanceUntil: null,
  scheduledDeletionAt: null,
  fullExpiresAt: null,
  showRenewalBanner: false,
};

export const usePlan = (): PlanState => {
  const { user } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<any>(null);
  const [planSlug, setPlanSlug] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    if (roleLoading) return;
    if (isAdmin) { setLoading(false); return; }

    const load = async () => {
      // RPC SECURITY DEFINER que lê o plano efetivo (inclusive herdado) sem RLS
      const { data: stateData, error: stateErr } = await supabase.rpc("get_effective_plan_state");
      if (stateErr) logError("[usePlan] get_effective_plan_state error:", stateErr.message);
      const state = stateData as any;
      const sub = state?.subscription && Object.keys(state.subscription).length > 0 ? state.subscription : null;
      setRow(sub);
      setPlanSlug(state?.plan_slug || null);
      setLoading(false);
    };

    load();
  }, [user, isAdmin, roleLoading]);

  return useMemo(() => {
    if (roleLoading) return { ...ADMIN_FULL, loading: true };
    if (isAdmin) return ADMIN_FULL;
    return { loading, ...computePlanState(row, planSlug, Date.now()) };
  }, [row, planSlug, loading, isAdmin, roleLoading]);
};

// Rotas acessíveis durante a carência (Dashboard + Planejamento e Controle)
export const GRACE_ALLOWED_ROUTES = [
  "/dashboard",
  "/dashboard/renda-despesas",
  "/dashboard/perfil",
  "/dashboard/familia",
  "/dashboard/configuracoes",
  "/dashboard/planos",
];

// Rotas que são bloqueadas após trial/cancelamento
export const LOCKED_ROUTES = [
  "/dashboard/tabela-geral",
  "/dashboard/calendario",
  "/dashboard/analises",
  "/dashboard/objetivos",
  "/dashboard/objetivos-de-vida",
  "/dashboard/aposentadoria",
  "/dashboard/investimentos",
  "/dashboard/bens-imoveis",
  "/dashboard/evolucao-patrimonial",
  "/dashboard/seguros",
  "/dashboard/controledajornada",
  "/dashboard/guiadajornada",
  "/dashboard/negocios",
  "/dashboard/estrategiadesubida",
  "/dashboard/basedamontanha",
  "/dashboard/vistadamontanha",
  "/dashboard/extrato-bancario",
  "/dashboard/fatura",
  "/dashboard/importar-ofx",
  "/dashboard/importar-planilha",
  "/dashboard/express-objetivo",
  "/dashboard/express-aposentadoria",
  "/dashboard/simulador-decisao",
];
