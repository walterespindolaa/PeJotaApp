import { startOfMonth, subMonths, format } from "date-fns";

export type PeriodoAnalise = "mes" | "3m" | "6m" | "12m" | "24m" | "all";

export const PERIOD_OPTIONS: { value: PeriodoAnalise; label: string }[] = [
  { value: "mes", label: "Mês atual" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "24m", label: "Últimos 24 meses" },
  { value: "all", label: "Desde o início" },
];

export function getPeriodConfig(periodo: PeriodoAnalise, mesAno: string) {
  const [year, month] = mesAno.split("-").map(Number);
  const mesDate = new Date(year, month - 1);
  const mesLabel = mesDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const capitalizedMesLabel = mesLabel.charAt(0).toUpperCase() + mesLabel.slice(1);

  if (periodo === "mes") {
    const start = `${mesAno}-01`;
    const endDay = new Date(year, month, 0).getDate();
    const end = `${mesAno}-${String(endDay).padStart(2, "0")}`;
    return {
      isMonthly: true,
      title: `Resumo do Mês — ${capitalizedMesLabel}`,
      label: PERIOD_OPTIONS.find(p => p.value === periodo)!.label,
      start,
      end,
    };
  }

  const now = new Date();
  const end = format(now, "yyyy-MM-dd");
  let start: string | null = null;
  const periodLabel = PERIOD_OPTIONS.find(p => p.value === periodo)!.label;

  switch (periodo) {
    case "3m":
      start = format(subMonths(now, 3), "yyyy-MM-dd");
      break;
    case "6m":
      start = format(subMonths(now, 6), "yyyy-MM-dd");
      break;
    case "12m":
      start = format(subMonths(now, 12), "yyyy-MM-dd");
      break;
    case "24m":
      start = format(subMonths(now, 24), "yyyy-MM-dd");
      break;
    case "all":
      start = null;
      break;
  }

  return {
    isMonthly: false,
    title: `Resumo do Período — ${periodLabel}`,
    label: periodLabel,
    start,
    end,
  };
}
