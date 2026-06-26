/**
 * Standard financial functions matching Excel/Google Sheets conventions.
 * All rates are periodic (monthly if calculating monthly).
 */

/** Future Value: FV(rate, nper, pmt, pv) */
export function FV(rate: number, nper: number, pmt: number, pv: number): number {
  if (rate === 0) return -(pv + pmt * nper);
  const factor = Math.pow(1 + rate, nper);
  return -(pv * factor + pmt * ((factor - 1) / rate));
}

/** Present Value: PV(rate, nper, pmt, fv) */
export function PV(rate: number, nper: number, pmt: number, fv: number): number {
  if (rate === 0) return -(fv + pmt * nper);
  const factor = Math.pow(1 + rate, nper);
  return -(fv + pmt * ((factor - 1) / rate)) / factor;
}

/** Payment: PMT(rate, nper, pv, fv) */
export function PMT(rate: number, nper: number, pv: number, fv: number): number {
  if (rate === 0) return -(pv + fv) / nper;
  const factor = Math.pow(1 + rate, nper);
  return -(pv * factor + fv) * rate / (factor - 1);
}

/**
 * @deprecated Use useI18n().fmt() or formatMoney() from @/lib/formatMoney instead.
 * Kept for backward compatibility in non-component contexts.
 */
export const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** @deprecated Use useI18n().fmtShort() instead */
export const fmtShort = (v: number) => {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}k`;
  return fmt(v);
};
