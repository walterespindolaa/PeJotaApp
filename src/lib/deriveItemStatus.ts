// Helper compartilhado para derivar status de receitas/despesas NAO-PARCELADAS
// a partir da tabela `pagamentos` + regra de overdue para recorrentes virtuais.
// Usado em useOrganiza.tsx (Planejamento) e Calendario.tsx para manter consistencia.

export type Pagamento = {
  id?: string;
  user_id?: string;
  ref_type: string;
  ref_id: string;
  mes?: string;
  status: string;
  pago_em?: string | null;
};

export type DerivableItem = {
  id: string;
  status: string;
  _virtual?: boolean;
  _originalId?: string;
  dia_vencimento?: number | null;
  vencimento?: number | null;
  dia_recebimento?: number | null;
};

export const pagKey = (refType: string, refId: string) => `${refType}:${refId}`;

export const buildPagamentosMap = (pagamentos: Pagamento[]): Record<string, Pagamento> => {
  const map: Record<string, Pagamento> = {};
  pagamentos.forEach(p => {
    map[pagKey(p.ref_type, p.ref_id)] = p;
  });
  return map;
};

/**
 * Deriva o status de UM item (receita ou despesa nao-parcelada).
 * refType: "ganho" para receitas, "despesa" para despesas.
 * mesAno: "YYYY-MM" do mes em contexto.
 * today: "YYYY-MM-DD" opcional; default e hoje.
 */
export const deriveItemStatus = <T extends DerivableItem>(
  item: T,
  pagamentosMap: Record<string, Pagamento>,
  refType: "ganho" | "despesa",
  mesAno: string,
  today?: string
): string => {
  const todayStr = today || new Date().toISOString().split("T")[0];
  const realId = item._originalId || item.id;
  const pag = pagamentosMap[pagKey(refType, realId)];
  if (pag) return pag.status;

  // Sem pagamento registrado: aplicar regra de overdue apenas para recorrentes virtuais.
  if (item._virtual) {
    const vencDia = item.dia_vencimento || item.vencimento || item.dia_recebimento;
    if (vencDia) {
      const vencDate = `${mesAno}-${String(vencDia).padStart(2, "0")}`;
      if (vencDate < todayStr) {
        return refType === "ganho" ? "pendente" : "em_atraso";
      }
    }
    return refType === "ganho" ? "pendente" : "a_pagar";
  }

  // Item real sem pagamento: manter status original do banco.
  return item.status;
};

/** Atalho para aplicar derivacao a uma lista. */
export const applyDerivedStatus = <T extends DerivableItem>(
  items: T[],
  pagamentosMap: Record<string, Pagamento>,
  refType: "ganho" | "despesa",
  mesAno: string,
  today?: string
): T[] => items.map(item => ({
  ...item,
  status: deriveItemStatus(item, pagamentosMap, refType, mesAno, today),
}));
