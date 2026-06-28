/* ============================================================
   PeJota — Núcleo financeiro do negócio (funções PURAS e testáveis)
   Portado das fórmulas do Zephyr (finance.ts) e adaptado ao modelo
   do PeJota: business_transactions (in/out por categoria) +
   business_categories.grupo + business_cashflow_budget + business_bills.

   Toda função aqui é pura (sem Supabase, sem React) para poder ser
   validada com testes automatizados. As telas só passam os dados.
   ============================================================ */

export type Direction = "in" | "out";
export type Grupo = "Receita" | "Deduções" | "Custos Fixos" | "Folha" | "Dispensável" | "Outros";

export interface Tx {
  date: string;            // 'YYYY-MM-DD'
  amount: number;          // sempre positivo; o sentido vem de direction
  direction: Direction;
  category_id?: string | null;
}
export interface Categoria {
  id: string;
  grupo?: string | null;
}
export interface BudgetRow {
  ref_month: string;       // 'YYYY-MM-01'
  category_id?: string | null;
  grupo?: string | null;
  projected: number;
}
export interface Bill {
  kind: "receber" | "pagar";
  amount: number;
  status: string;          // 'pendente' | 'liquidado'
  due_date?: string | null;
}

// ── Datas (sem dependências) ──
export const ym = (dateStr: string): string => (dateStr || "").slice(0, 7);
export const isInMonth = (dateStr: string, month: string): boolean => ym(dateStr) === month;
export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

// ── Grupo de uma categoria ──
// Usa o grupo cadastrado na categoria; cai para heurística pelo sentido.
export function grupoDe(categoryId: string | null | undefined, categorias: Categoria[], direction: Direction): Grupo {
  const c = categorias.find((x) => x.id === categoryId);
  const g = (c?.grupo || "").trim();
  const validos: Grupo[] = ["Receita", "Deduções", "Custos Fixos", "Folha", "Dispensável"];
  if (validos.includes(g as Grupo)) return g as Grupo;
  return direction === "in" ? "Receita" : "Custos Fixos";
}

// ── Resumo mensal: receita, despesa, resultado, margem ──
export interface ResumoMes { receita: number; despesa: number; resultado: number; margem: number; }
export function resumoMes(txs: Tx[], month: string): ResumoMes {
  const doMes = txs.filter((t) => isInMonth(t.date, month));
  const receita = doMes.filter((t) => t.direction === "in").reduce((s, t) => s + Number(t.amount || 0), 0);
  const despesa = doMes.filter((t) => t.direction === "out").reduce((s, t) => s + Number(t.amount || 0), 0);
  const resultado = receita - despesa;
  const margem = receita > 0 ? resultado / receita : 0;
  return { receita: round2(receita), despesa: round2(despesa), resultado: round2(resultado), margem };
}

// ── Saldo em caixa (acumulado): entradas - saídas até uma data (ou tudo) ──
export function saldoCaixa(txs: Tx[], uptoDate?: string): number {
  const base = uptoDate ? txs.filter((t) => t.date <= uptoDate) : txs;
  const entra = base.filter((t) => t.direction === "in").reduce((s, t) => s + Number(t.amount || 0), 0);
  const sai = base.filter((t) => t.direction === "out").reduce((s, t) => s + Number(t.amount || 0), 0);
  return round2(entra - sai);
}

// ── DRE gerencial do período (mês) ──
export interface DRE {
  receitaBruta: number;
  deducoes: number;
  receitaLiquida: number;
  custosFixos: number;
  folha: number;
  dispensavel: number;
  lucroLiquido: number;
  margem: number;
}
export function dreDoMes(txs: Tx[], categorias: Categoria[], month: string): DRE {
  const doMes = txs.filter((t) => isInMonth(t.date, month));
  const somaGrupo = (g: Grupo, dir: Direction) =>
    doMes.filter((t) => t.direction === dir && grupoDe(t.category_id, categorias, t.direction) === g)
      .reduce((s, t) => s + Number(t.amount || 0), 0);

  const receitaBruta = somaGrupo("Receita", "in");
  const deducoes = somaGrupo("Deduções", "out");
  const custosFixos = somaGrupo("Custos Fixos", "out");
  const folha = somaGrupo("Folha", "out");
  const dispensavel = somaGrupo("Dispensável", "out");
  const receitaLiquida = receitaBruta - deducoes;
  const lucroLiquido = receitaLiquida - custosFixos - folha - dispensavel;
  return {
    receitaBruta: round2(receitaBruta), deducoes: round2(deducoes), receitaLiquida: round2(receitaLiquida),
    custosFixos: round2(custosFixos), folha: round2(folha), dispensavel: round2(dispensavel),
    lucroLiquido: round2(lucroLiquido), margem: receitaBruta > 0 ? lucroLiquido / receitaBruta : 0,
  };
}

// ── Projetado × Realizado por categoria (mês) ──
export interface ProjRealRow { category_id: string | null; projected: number; realized: number; diff: number; }
export function projetadoVsRealizado(budget: BudgetRow[], txs: Tx[], month: string): ProjRealRow[] {
  const monthFirst = `${month}-01`;
  const cats = new Set<string | null>();
  budget.filter((b) => b.ref_month === monthFirst).forEach((b) => cats.add(b.category_id ?? null));
  txs.filter((t) => isInMonth(t.date, month)).forEach((t) => cats.add(t.category_id ?? null));
  return Array.from(cats).map((cid) => {
    const projected = budget.filter((b) => b.ref_month === monthFirst && (b.category_id ?? null) === cid)
      .reduce((s, b) => s + Number(b.projected || 0), 0);
    const realized = txs.filter((t) => isInMonth(t.date, month) && (t.category_id ?? null) === cid)
      .reduce((s, t) => s + (t.direction === "in" ? 1 : -1) * Number(t.amount || 0), 0);
    return { category_id: cid, projected: round2(projected), realized: round2(realized), diff: round2(realized - projected) };
  });
}

// ── Folha: total a pagar de um colaborador (maior entre piso e base+comissão) ──
export function totalFolhaColaborador(base: number, comissao: number, piso: number): number {
  return round2(Math.max(Number(piso || 0), Number(base || 0) + Number(comissao || 0)));
}

// ── Contas a receber / a pagar (pendentes) ──
export interface ReceberPagar { aReceber: number; aPagar: number; saldoPrevisto: number; }
export function totaisReceberPagar(bills: Bill[]): ReceberPagar {
  const pend = (k: "receber" | "pagar") => bills.filter((b) => b.kind === k && b.status === "pendente")
    .reduce((s, b) => s + Number(b.amount || 0), 0);
  const aReceber = pend("receber");
  const aPagar = pend("pagar");
  return { aReceber: round2(aReceber), aPagar: round2(aPagar), saldoPrevisto: round2(aReceber - aPagar) };
}

// ── Status de vencimento de uma conta (para badges) ──
export function statusVencimento(due: string | null | undefined, status: string, hoje: string): "liquidado" | "atrasado" | "vence_hoje" | "a_vencer" | "sem_data" {
  if (status === "liquidado") return "liquidado";
  if (!due) return "sem_data";
  if (due < hoje) return "atrasado";
  if (due === hoje) return "vence_hoje";
  return "a_vencer";
}
