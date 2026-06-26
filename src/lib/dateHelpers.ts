/**
 * Returns the last day of a given month as "YYYY-MM-DD".
 * Uses the trick: day 0 of next month = last day of current month.
 * e.g. lastDayOfMonth("2026-04") → "2026-04-30"
 *      lastDayOfMonth("2026-01") → "2026-01-31"
 */
export const lastDayOfMonth = (mesAno: string): string => {
  const [y, m] = mesAno.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return `${mesAno}-${String(lastDay).padStart(2, "0")}`;
};

/**
 * Returns the first day of a given month as "YYYY-MM-DD".
 * e.g. firstDayOfMonth("2026-04") → "2026-04-01"
 */
export const firstDayOfMonth = (mesAno: string): string => `${mesAno}-01`;
