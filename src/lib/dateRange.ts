import { startOfMonth, subMonths, startOfYear, format } from "date-fns";

export type PeriodFilter =
  | "month_current"
  | "last_3_months"
  | "last_6_months"
  | "year_current"
  | "last_12_months"
  | "last_24_months"
  | "all_time";

export const PERIOD_LABELS: Record<PeriodFilter, string> = {
  month_current: "Mês atual",
  last_3_months: "Últimos 3 meses",
  last_6_months: "Últimos 6 meses",
  year_current: "Ano atual",
  last_12_months: "Últimos 12 meses",
  last_24_months: "Últimos 24 meses",
  all_time: "Desde o início",
};

export function getDateRange(filter: PeriodFilter): { start: string | null; end: string } {
  const now = new Date();
  const end = format(now, "yyyy-MM-dd");

  switch (filter) {
    case "month_current":
      return { start: format(startOfMonth(now), "yyyy-MM-dd"), end };
    case "last_3_months":
      return { start: format(subMonths(now, 3), "yyyy-MM-dd"), end };
    case "last_6_months":
      return { start: format(subMonths(now, 6), "yyyy-MM-dd"), end };
    case "year_current":
      return { start: format(startOfYear(now), "yyyy-MM-dd"), end };
    case "last_12_months":
      return { start: format(subMonths(now, 12), "yyyy-MM-dd"), end };
    case "last_24_months":
      return { start: format(subMonths(now, 24), "yyyy-MM-dd"), end };
    case "all_time":
      return { start: null, end };
  }
}

export function formatPeriodLabel(filter: PeriodFilter): string {
  const { start, end } = getDateRange(filter);
  if (!start) return "Desde o início";
  const fmtDate = (d: string) => {
    const [y, m, day] = d.split("-");
    return `${day}/${m}/${y}`;
  };
  return `${PERIOD_LABELS[filter]} (${fmtDate(start)} a ${fmtDate(end)})`;
}

const STORAGE_KEY = "atlas_report_period";

export function loadPeriodFilter(): PeriodFilter {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && v in PERIOD_LABELS) return v as PeriodFilter;
  } catch {}
  return "month_current";
}

export function savePeriodFilter(f: PeriodFilter) {
  try { localStorage.setItem(STORAGE_KEY, f); } catch {}
}

export const INCOME_CATEGORIES = [
  "Salário/Pró-labore", "Rendimentos/Investimentos", "Aluguel recebido", "Reembolsos", "Renda Extra", "Outros",
];

export const EXPENSE_CATEGORIES = [
  "Moradia", "Alimentação", "Transporte", "Saúde", "Educação", "Lazer",
  "Assinaturas", "Cartão de Crédito", "Impostos/Taxas", "Seguros",
  "Família/Filhos", "Viagem", "Outros",
];
