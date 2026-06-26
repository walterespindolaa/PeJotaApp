/**
 * Lógica PURA de estado de plano/acesso (extraída de usePlan para ser testável).
 * Recebe a linha de user_subscriptions + plan_slug + "agora" (ms) e devolve o
 * estado de acesso. Não toca em React/Supabase — 100% determinística.
 */

export type AccessState =
  | "trial_active"
  | "trial_expired"
  | "active_paid"
  | "cancelled_grace"
  | "awaiting_payment"
  | "inactive_user";

export interface ComputedPlanState {
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

const diffDays = (future: string | null, now: number) => {
  if (!future) return 0;
  return Math.max(0, Math.ceil((new Date(future).getTime() - now) / 86400000));
};
const diffDaysSigned = (future: string, now: number) => Math.ceil((new Date(future).getTime() - now) / 86400000);

export function resolvePlanTier(subTier: string, planSlug: string | null): "free" | "essencial" | "pro" | "elite" {
  if (subTier !== "full") return "free";
  if (planSlug === "atlas_elite") return "elite";
  if (planSlug === "atlas_pro") return "pro";
  return "essencial";
}

export function computePlanState(row: any, planSlug: string | null, now: number): ComputedPlanState {
  const base = {
    isTrialActive: false,
    isGraceFinanceActive: false,
    isRestricted: false,
    isFull: false,
    isInactive: false,
    isAwaitingPayment: false,
    daysRemainingTrial: 0,
    daysRemainingGrace: 0,
    daysUntilDeletion: 0,
    daysUntilFullExpires: 0,
    trialExpiresAt: null as string | null,
    graceFinanceUntil: null as string | null,
    scheduledDeletionAt: null as string | null,
    fullExpiresAt: null as string | null,
    showRenewalBanner: false,
  };

  // Sem assinatura → aguardando pagamento
  if (!row) {
    return { ...base, planTier: "free", accessState: "awaiting_payment", isAwaitingPayment: true };
  }

  const subTier = row.plan_tier as string;
  const fullExpiresAt = row.full_expires_at || null;
  const dbAccessState = row.access_state as string;
  const planTier = resolvePlanTier(subTier, planSlug);

  const baseDates = {
    trialExpiresAt: row.trial_expires_at || null,
    graceFinanceUntil: row.grace_finance_until || null,
    scheduledDeletionAt: row.scheduled_deletion_at || null,
    fullExpiresAt,
  };

  // Aguardando pagamento (fluxo normal, nunca pagou)
  if (dbAccessState === "awaiting_payment") {
    return { ...base, ...baseDates, planTier: "free", accessState: "awaiting_payment", isAwaitingPayment: true };
  }

  // Cancelado/inadimplente: carência e depois bloqueio (ANTES do ramo "full")
  if (dbAccessState === "cancelled_grace") {
    const graceEndC = row.grace_finance_until ? new Date(row.grace_finance_until).getTime() : 0;
    if (graceEndC > 0 && now <= graceEndC) {
      return {
        ...base, ...baseDates, planTier: "free", accessState: "cancelled_grace",
        isGraceFinanceActive: true,
        daysRemainingGrace: diffDays(row.grace_finance_until, now),
        daysUntilDeletion: diffDays(row.scheduled_deletion_at, now),
      };
    }
    return {
      ...base, ...baseDates, planTier: "free", accessState: "inactive_user",
      isRestricted: true, isInactive: true, daysUntilDeletion: diffDays(row.scheduled_deletion_at, now),
    };
  }

  // Bloqueio explícito
  if (dbAccessState === "restricted") {
    return {
      ...base, ...baseDates, planTier: "free", accessState: "inactive_user",
      isRestricted: true, isInactive: true, daysUntilDeletion: diffDays(row.scheduled_deletion_at, now),
    };
  }

  // FULL pago que expirou
  if (subTier === "full" && fullExpiresAt) {
    const fullEnd = new Date(fullExpiresAt).getTime();
    if (now > fullEnd) {
      const graceEnd = row.grace_finance_until ? new Date(row.grace_finance_until).getTime() : fullEnd + 45 * 86400000;
      const daysAfterExpiry = -diffDaysSigned(fullExpiresAt, now);
      const showRenewalBanner = daysAfterExpiry <= 7;
      if (now > graceEnd) {
        return {
          ...base, ...baseDates, planTier: "free", accessState: "inactive_user",
          isRestricted: true, isInactive: true, daysUntilDeletion: diffDays(row.scheduled_deletion_at, now),
        };
      }
      return {
        ...base, ...baseDates, planTier: "free", accessState: "cancelled_grace",
        isGraceFinanceActive: true,
        daysRemainingGrace: diffDays(row.grace_finance_until, now),
        daysUntilDeletion: diffDays(row.scheduled_deletion_at, now),
        showRenewalBanner,
      };
    }
  }

  // FULL ativo (pago e não expirado)
  if (subTier === "full") {
    const daysUntilFullExpires = diffDays(fullExpiresAt, now);
    const showRenewalBanner = fullExpiresAt ? daysUntilFullExpires <= 15 : false;
    return {
      ...base, ...baseDates, planTier, accessState: "active_paid", isFull: true,
      daysUntilFullExpires, showRenewalBanner,
    };
  }

  // Free: lógica de trial
  const trialEnd = row.trial_expires_at ? new Date(row.trial_expires_at).getTime() : 0;
  const graceEnd = row.grace_finance_until ? new Date(row.grace_finance_until).getTime() : 0;
  const isTrialActive = dbAccessState === "trial" && trialEnd > 0 && now <= trialEnd;
  const isInGrace = !isTrialActive && graceEnd > 0 && now <= graceEnd;
  const isInactive = !isTrialActive && !isInGrace;

  let accessState: AccessState;
  if (isTrialActive) accessState = "trial_active";
  else if (dbAccessState === "cancelled_grace" || (row.cancelled_at && isInGrace)) accessState = isInGrace ? "cancelled_grace" : "inactive_user";
  else if (isInGrace) accessState = "trial_expired";
  else accessState = "inactive_user";

  return {
    ...base, ...baseDates, planTier: "free", accessState,
    isTrialActive,
    isGraceFinanceActive: isInGrace && !isTrialActive,
    isRestricted: isInactive,
    isInactive,
    isAwaitingPayment: false,
    daysRemainingTrial: diffDays(row.trial_expires_at, now),
    daysRemainingGrace: diffDays(row.grace_finance_until, now),
    daysUntilDeletion: diffDays(row.scheduled_deletion_at, now),
  };
}
