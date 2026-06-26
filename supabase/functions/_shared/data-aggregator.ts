// Helper compartilhado para Edge Functions de relatório:
// - Resolve filtro de responsável a partir da visão da página
// - Calcula range de datas a partir do PeriodFilter do frontend
// - Projeta itens recorrentes para cada mês do período (equivalente Deno
//   do src/lib/mergeRecurring.ts, para garantir paridade com o frontend)

export type Visao = "geral" | "casal" | "pessoa1" | "pessoa2" | undefined;
export type PeriodFilter =
  | "month_current"
  | "last_3_months"
  | "last_6_months"
  | "year_current"
  | "last_12_months"
  | "last_24_months"
  | "all_time";

export function resolveResponsavelFilter(visao: Visao): string | undefined {
  if (!visao || visao === "geral" || visao === "casal") return undefined;
  if (visao === "pessoa1") return "Pessoa 1";
  if (visao === "pessoa2") return "Pessoa 2";
  return undefined;
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function getDateRangeFromPeriod(period: PeriodFilter | undefined): { start: string; end: string; label: string } {
  const now = new Date();
  const end = fmtDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const subM = (n: number) => fmtDate(new Date(now.getFullYear(), now.getMonth() - n, 1));
  switch (period) {
    case "month_current":
      return { start: fmtDate(new Date(now.getFullYear(), now.getMonth(), 1)), end, label: "mês atual" };
    case "last_3_months":
      return { start: subM(2), end, label: "últimos 3 meses" };
    case "year_current":
      return { start: `${now.getFullYear()}-01-01`, end, label: "ano atual" };
    case "last_12_months":
      return { start: subM(11), end, label: "últimos 12 meses" };
    case "last_24_months":
      return { start: subM(23), end, label: "últimos 24 meses" };
    case "all_time":
      return { start: "2000-01-01", end, label: "desde o início" };
    case "last_6_months":
    default:
      return { start: subM(5), end, label: "últimos 6 meses" };
  }
}

export function monthsBetween(startDate: string, endDate: string): string[] {
  const [sY, sM] = startDate.substring(0, 7).split("-").map(Number);
  const [eY, eM] = endDate.substring(0, 7).split("-").map(Number);
  const out: string[] = [];
  let y = sY, m = sM;
  while (y < eY || (y === eY && m <= eM)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/**
 * Projeta itens recorrentes para cada mês do período.
 * Para cada (item recorrente × mês alvo): se o item foi cadastrado até esse mês
 * e não existe row real dele naquele mês, gera uma row virtual.
 */
export function projectRecurringForPeriod<T extends { id: string; data: string; recorrente?: boolean }>(
  monthlyItems: T[],
  allRecurring: T[],
  startDate: string,
  endDate: string
): T[] {
  const months = monthsBetween(startDate, endDate);
  const realByIdMes = new Set<string>();
  monthlyItems.forEach(i => {
    const mes = i.data?.substring(0, 7);
    if (mes) realByIdMes.add(`${i.id}:${mes}`);
  });
  const extras: T[] = [];
  allRecurring.forEach(item => {
    const itemStartMes = item.data?.substring(0, 7);
    if (!itemStartMes) return;
    const day = item.data.substring(8, 10) || "01";
    months.forEach(targetMes => {
      if (itemStartMes > targetMes) return;
      const ate = (item as any).recorrente_ate;
      if (ate && targetMes > ate) return;
      if (realByIdMes.has(`${item.id}:${targetMes}`)) return;
      extras.push({
        ...item,
        id: `virtual_${item.id}_${targetMes}`,
        data: `${targetMes}-${day}`,
      } as T);
    });
  });
  return [...monthlyItems, ...extras];
}

/**
 * Resolve the base ID of a (possibly virtual) projected item.
 * Virtual items have id = `virtual_<originalId>_<YYYY-MM>`.
 */
export function resolveBaseId(item: { id: string }): string {
  if (typeof item.id !== "string" || !item.id.startsWith("virtual_")) return item.id;
  const m = item.id.match(/^virtual_(.+)_\d{4}-\d{2}$/);
  return m ? m[1] : item.id;
}

/**
 * Filter out skipped (paused) recurring expenses.
 * Non-recurring items and installments (is_parcelada) are never skippable.
 */
export function filterSkippedExpenses<T extends { id: string; data: string; recorrente?: boolean; is_parcelada?: boolean }>(
  expenses: T[],
  skippedKeys: Set<string>,
): T[] {
  if (skippedKeys.size === 0) return expenses;
  return expenses.filter((d: any) => {
    if (d.is_parcelada) return true;
    if (!d.recorrente) return true;
    const mes = (d.data || "").substring(0, 7);
    return !skippedKeys.has(`${resolveBaseId(d)}:${mes}`);
  });
}
