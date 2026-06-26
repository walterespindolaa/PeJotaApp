// Projeta parcelas ATIVAS em um mês/período a partir de despesas is_parcelada.
// Equivalente frontend do supabase/functions/_shared/parcela-projector.ts.
// installment_instances é fonte de verdade para STATUS (paid/pending/late), não para VALOR.

export type ParcelaDespesa = {
  id: string;
  data: string;
  data_inicio_parcelas: string | null;
  parcela_atual: number | string | null;
  total_parcelas: number | string | null;
  valor: number | string;
  categoria?: string;
  responsavel?: string;
  [key: string]: any;
};

export type ParcelaProjetada = {
  installmentId: string;
  mes: string;          // "YYYY-MM"
  parcelaNumero: number;
  valor: number;
  dueDate: string;      // "YYYY-MM-DD"
  categoria?: string;
  responsavel?: string;
};

export function projectParcelasForMonth(
  despesasParceladas: ParcelaDespesa[],
  targetMesAno: string
): ParcelaProjetada[] {
  const [targetY, targetM] = targetMesAno.split("-").map(Number);
  const result: ParcelaProjetada[] = [];
  despesasParceladas.forEach(p => {
    const startDateStr = p.data_inicio_parcelas || p.data;
    if (!startDateStr) return;
    const [startY, startM] = startDateStr.substring(0, 7).split("-").map(Number);
    const monthOffset = (targetY - startY) * 12 + (targetM - startM);
    const parcelaAtualOriginal = Number(p.parcela_atual) || 1;
    const totalParcelas = Number(p.total_parcelas) || 1;
    const parcelaNestesMes = parcelaAtualOriginal + monthOffset;
    if (parcelaNestesMes < 1 || parcelaNestesMes > totalParcelas) return;
    const day = startDateStr.substring(8, 10) || "01";
    result.push({
      installmentId: p.id,
      mes: targetMesAno,
      parcelaNumero: parcelaNestesMes,
      valor: Number(p.valor) || 0,
      dueDate: `${targetMesAno}-${day}`,
      categoria: p.categoria,
      responsavel: p.responsavel,
    });
  });
  return result;
}

export function projectParcelasForPeriod(
  despesasParceladas: ParcelaDespesa[],
  startDate: string,
  endDate: string
): ParcelaProjetada[] {
  const [sY, sM] = startDate.substring(0, 7).split("-").map(Number);
  const [eY, eM] = endDate.substring(0, 7).split("-").map(Number);
  const result: ParcelaProjetada[] = [];
  let y = sY, m = sM;
  while (y < eY || (y === eY && m <= eM)) {
    const mesAno = `${y}-${String(m).padStart(2, "0")}`;
    result.push(...projectParcelasForMonth(despesasParceladas, mesAno));
    m++; if (m > 12) { m = 1; y++; }
  }
  return result;
}

export function projectParcelasForDateRange(
  despesasParceladas: ParcelaDespesa[],
  startDate: string,  // "YYYY-MM-DD"
  endDate: string
): ParcelaProjetada[] {
  const projected = projectParcelasForPeriod(despesasParceladas, startDate, endDate);
  return projected.filter(p => p.dueDate >= startDate && p.dueDate <= endDate);
}
