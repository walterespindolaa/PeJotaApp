// Centralized checkout URLs — Stripe (loaded from environment)
export const STRIPE_ESSENCIAL_URL = import.meta.env.VITE_STRIPE_ESSENCIAL_URL ?? "";
export const STRIPE_PRO_URL       = import.meta.env.VITE_STRIPE_PRO_URL ?? "";
export const STRIPE_ELITE_URL     = import.meta.env.VITE_STRIPE_ELITE_URL ?? "";

/**
 * Returns the best upgrade URL given the user's current plan slug.
 * - free / essencial → Pro
 * - pro → Elite
 * - elite / admin → Elite (renewal)
 */
export function getUpgradeUrl(currentPlanSlug?: string | null): string {
  if (!currentPlanSlug) return STRIPE_PRO_URL;
  if (currentPlanSlug === "atlas_pro") return STRIPE_ELITE_URL;
  if (currentPlanSlug === "atlas_elite") return STRIPE_ELITE_URL;
  // free, atlas_essencial, or unknown → Pro
  return STRIPE_PRO_URL;
}

// Legacy alias kept for backward compatibility (points to Pro)
export const CHECKOUT_URL = STRIPE_PRO_URL;
