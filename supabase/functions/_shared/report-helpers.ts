/**
 * Shared helpers for report Edge Functions.
 * Computes monthly aggregations and trends from raw transaction data.
 */

export function getReportDateRange(): { sixMonthsAgo: string; today: string } {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return {
    sixMonthsAgo: sixMonthsAgo.toISOString().split("T")[0],
    today: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0],
  };
}

interface MonthlyAgg {
  mes: string;
  total: number;
  count: number;
}

export function groupByMonth(records: any[], dateField = "data", valueField = "valor"): MonthlyAgg[] {
  const map: Record<string, { total: number; count: number }> = {};
  records.forEach(r => {
    const mes = r[dateField]?.substring(0, 7);
    if (!mes) return;
    if (!map[mes]) map[mes] = { total: 0, count: 0 };
    map[mes].total += Number(r[valueField] || 0);
    map[mes].count += 1;
  });
  return Object.entries(map)
    .map(([mes, v]) => ({ mes, ...v }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

export function computeTrend(monthly: MonthlyAgg[]): { media: number; tendencia: string; variacao: number } {
  const media = monthly.length > 0
    ? monthly.reduce((s, m) => s + m.total, 0) / monthly.length
    : 0;
  if (monthly.length < 2) return { media, tendencia: "insuficiente", variacao: 0 };
  const mid = Math.floor(monthly.length / 2);
  const firstHalf = monthly.slice(0, mid);
  const secondHalf = monthly.slice(mid);
  const avgFirst = firstHalf.reduce((s, m) => s + m.total, 0) / (firstHalf.length || 1);
  const avgSecond = secondHalf.reduce((s, m) => s + m.total, 0) / (secondHalf.length || 1);
  const variacao = avgFirst > 0 ? Math.round(((avgSecond - avgFirst) / avgFirst) * 100) : 0;
  let tendencia = "estavel";
  if (variacao > 10) tendencia = "crescente";
  else if (variacao < -10) tendencia = "decrescente";
  return { media: Math.round(media), tendencia, variacao };
}
