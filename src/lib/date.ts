/**
 * Helpers de data — sempre construídos com dia fixo 1 para evitar overflow de
 * meses curtos (ex.: 31 de mai. + setMonth volta "jun.") e desvios de timezone.
 */

/**
 * Rótulo curto de mês ("jan", "fev", ...) em pt-BR.
 * dia 1 evita overflow de meses curtos (ex.: 31 de mai -> "jun").
 */
export function monthLabel(year: number, monthIndex: number): string {
  const d = new Date(year, monthIndex, 1);
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

/**
 * Rótulo curto de mês a partir de uma string "YYYY-MM" ou "YYYY-MM-DD".
 * Faz split em vez de new Date(string) para não parsear como UTC (que pode
 * voltar um dia e trocar o mês).
 */
export function monthLabelFromRef(ref: string): string {
  const [y, m] = String(ref).split("-").map(Number);
  if (!y || !m) return "";
  return monthLabel(y, m - 1);
}
