import { describe, it, expect } from "vitest";
import { computePlanState, resolvePlanTier } from "@/lib/planState";

const NOW = new Date("2026-06-26T12:00:00Z").getTime();
const inDays = (d: number) => new Date(NOW + d * 86400000).toISOString();

describe("computePlanState — estados de acesso", () => {
  it("sem assinatura → awaiting_payment, sem acesso full", () => {
    const s = computePlanState(null, null, NOW);
    expect(s.accessState).toBe("awaiting_payment");
    expect(s.isAwaitingPayment).toBe(true);
    expect(s.isFull).toBe(false);
  });

  it("awaiting_payment explícito → sem acesso", () => {
    const s = computePlanState({ plan_tier: "free", access_state: "awaiting_payment" }, null, NOW);
    expect(s.accessState).toBe("awaiting_payment");
    expect(s.isFull).toBe(false);
  });

  it("trial dentro do prazo → trial_active, acesso", () => {
    const s = computePlanState({ plan_tier: "free", access_state: "trial", trial_expires_at: inDays(3) }, null, NOW);
    expect(s.accessState).toBe("trial_active");
    expect(s.isTrialActive).toBe(true);
    expect(s.isRestricted).toBe(false);
  });

  it("trial vencido mas dentro da carência → trial_expired (acesso parcial)", () => {
    const s = computePlanState({ plan_tier: "free", access_state: "trial", trial_expires_at: inDays(-2), grace_finance_until: inDays(20) }, null, NOW);
    expect(s.accessState).toBe("trial_expired");
    expect(s.isGraceFinanceActive).toBe(true);
    expect(s.isRestricted).toBe(false);
  });

  it("trial vencido e fora da carência → inactive_user (bloqueado)", () => {
    const s = computePlanState({ plan_tier: "free", access_state: "trial", trial_expires_at: inDays(-40), grace_finance_until: inDays(-10) }, null, NOW);
    expect(s.accessState).toBe("inactive_user");
    expect(s.isRestricted).toBe(true);
  });

  it("pagante ativo (full, sem expiração) → active_paid, isFull", () => {
    const s = computePlanState({ plan_tier: "full", access_state: "active" }, "atlas_pro", NOW);
    expect(s.accessState).toBe("active_paid");
    expect(s.isFull).toBe(true);
    expect(s.planTier).toBe("pro");
  });

  // ── REGRESSÃO DO P0: cancelamento DEVE revogar o acesso ──
  it("cancelled_grace DENTRO da carência → NÃO é full, mas tem carência", () => {
    const s = computePlanState({ plan_tier: "full", access_state: "cancelled_grace", grace_finance_until: inDays(15), cancelled_at: inDays(-1) }, "atlas_pro", NOW);
    expect(s.isFull).toBe(false);
    expect(s.accessState).toBe("cancelled_grace");
    expect(s.isGraceFinanceActive).toBe(true);
  });

  it("cancelled_grace FORA da carência → bloqueado (inactive_user)", () => {
    const s = computePlanState({ plan_tier: "full", access_state: "cancelled_grace", grace_finance_until: inDays(-5), cancelled_at: inDays(-40) }, "atlas_pro", NOW);
    expect(s.isFull).toBe(false);
    expect(s.accessState).toBe("inactive_user");
    expect(s.isRestricted).toBe(true);
  });

  it("restricted → bloqueado, nunca full", () => {
    const s = computePlanState({ plan_tier: "full", access_state: "restricted" }, "atlas_elite", NOW);
    expect(s.isFull).toBe(false);
    expect(s.isRestricted).toBe(true);
  });

  it("full expirado e fora da carência → inactive_user", () => {
    const s = computePlanState({ plan_tier: "full", access_state: "active", full_expires_at: inDays(-60), grace_finance_until: inDays(-10) }, "atlas_pro", NOW);
    expect(s.isFull).toBe(false);
    expect(s.accessState).toBe("inactive_user");
  });
});

describe("resolvePlanTier", () => {
  it("free quando não é full", () => expect(resolvePlanTier("free", "atlas_pro")).toBe("free"));
  it("mapeia slugs pagos", () => {
    expect(resolvePlanTier("full", "atlas_elite")).toBe("elite");
    expect(resolvePlanTier("full", "atlas_pro")).toBe("pro");
    expect(resolvePlanTier("full", "atlas_essencial")).toBe("essencial");
    expect(resolvePlanTier("full", null)).toBe("essencial");
  });
});
