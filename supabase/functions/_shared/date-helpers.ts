/**
 * Retorna o último dia de um mês no formato "YYYY-MM-DD".
 * Aceita "YYYY-MM" ou Date. Usa componentes LOCAIS pra evitar shift de timezone.
 */
export function getLastDayOfMonth(input: string | Date): string {
  let year: number;
  let monthIdx: number; // 0-indexed

  if (typeof input === "string") {
    const [y, m] = input.split("-").map(Number);
    year = y;
    monthIdx = m - 1;
  } else {
    year = input.getFullYear();
    monthIdx = input.getMonth();
  }

  // Dia 0 do próximo mês = último dia do mês corrente
  const lastDay = new Date(year, monthIdx + 1, 0);
  const y = lastDay.getFullYear();
  const m = String(lastDay.getMonth() + 1).padStart(2, "0");
  const d = String(lastDay.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
