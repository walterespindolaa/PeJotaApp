/**
 * Cálculo unificado de totais financeiros do mês.
 *
 * Centraliza a regra de negócio de "o que conta como despesa", "o que conta como pago", etc.
 * Função pura: recebe dados já carregados, retorna totais computados.
 *
 * Usado por useOrganiza, DashboardHome e VisaoFutura no frontend.
 * (Edge Function atlas-chat tem cópia paralela própria — runtimes diferentes.)
 *
 * REGRAS:
 *   - Dívidas (is_parcelada=true && tipo_parcelamento="divida") ENTRAM em totalDespesas
 *     e despesasPagas. Os campos totalDividas e dividasPagas continuam disponíveis para
 *     breakdown de UI.
 *   - Todas as parcelas (comuns e dívidas) entram em totalDespesas.
 *   - Itens com _skipped=true são ignorados em todos os totais.
 *   - Quando "instances" é fornecido (DashboardHome/VisaoFutura), o total de parcelas vem dele
 *     em vez do array de despesas (instances tem o valor do mês corrente, despesas tem o template).
 *
 * SEMÂNTICA DOS TOTAIS (Opção B):
 *   - totalDespesas / despesasPagas        = SAÍDAS (incluem dívida) → cálculos de saldo, reserva, compromisso.
 *   - despesaCorrente / despesaCorrentePaga = SEM dívida (fixas + variáveis + parcelas) → rótulo "Despesas" na UI.
 *   - totalDividas / dividasPagas          = dívida isolada → card "Dívidas".
 */

export type DespesaInput = {
  valor: number | string;
  is_parcelada?: boolean;
  tipo_parcelamento?: string | null;
  status?: string | null;
  _skipped?: boolean;
  tipo?: string;
  data?: string;
};

export type ReceitaInput = {
  valor: number | string;
  status?: string | null;
};

export type EconomiaInput = {
  valor: number | string;
};

/**
 * Instance de installment_instances. Pode ter "tipo_parcelamento" embedado via:
 *   .select("amount,status,despesas(tipo_parcelamento)")
 */
export type InstanceInput = {
  amount: number | string;
  status?: string | null;
  tipo_parcelamento?: string | null;
  despesas?: { tipo_parcelamento?: string | null } | null;
};

export type MonthTotals = {
  fixas: DespesaInput[];
  variaveis: DespesaInput[];
  parcelas: DespesaInput[];
  dividas: DespesaInput[];

  totalFixas: number;
  totalVariaveis: number;
  totalParcelas: number;
  totalDividas: number;

  totalDespesas: number;
  despesasPagas: number;
  dividasPagas: number;

  despesaCorrente: number;       // fixas + variáveis + parcelas (SEM dívida) — para o rótulo "Despesas"
  despesaCorrentePaga: number;   // pago de despesa corrente (sem dívidas pagas)

  totalReceitas: number;
  receitasRecebidas: number;
  totalEconomias: number;
};

const num = (v: unknown): number => Number(v ?? 0) || 0;

const getInstanceTipoParcelamento = (i: InstanceInput): string | null => {
  return i.tipo_parcelamento ?? i.despesas?.tipo_parcelamento ?? null;
};

export function computeMonthTotals(input: {
  despesas: DespesaInput[];
  instances?: InstanceInput[];
  receitas?: ReceitaInput[];
  economias?: EconomiaInput[];
}): MonthTotals {
  const { despesas, instances, receitas = [], economias = [] } = input;

  const fixas = despesas.filter(d => d.tipo === "fixa" && !d.is_parcelada);
  const variaveis = despesas.filter(d => d.tipo === "variavel" && !d.is_parcelada);
  const parcelas = despesas.filter(d => d.is_parcelada && d.tipo_parcelamento !== "divida");
  const dividas = despesas.filter(d => d.is_parcelada && d.tipo_parcelamento === "divida");

  const totalFixas = fixas.filter(d => !d._skipped).reduce((s, d) => s + num(d.valor), 0);
  const totalVariaveis = variaveis.filter(d => !d._skipped).reduce((s, d) => s + num(d.valor), 0);

  const totalParcelas = instances
    ? instances
        .filter(i => getInstanceTipoParcelamento(i) !== "divida")
        .reduce((s, i) => s + num(i.amount), 0)
    : parcelas.reduce((s, d) => s + num(d.valor), 0);

  const totalDividas = instances
    ? instances
        .filter(i => getInstanceTipoParcelamento(i) === "divida")
        .reduce((s, i) => s + num(i.amount), 0)
    : dividas.reduce((s, d) => s + num(d.valor), 0);

  const totalDespesas = totalFixas + totalVariaveis + totalParcelas + totalDividas;

  const pagosFixasVar = [...fixas, ...variaveis]
    .filter(d => !d._skipped && d.status === "pago")
    .reduce((s, d) => s + num(d.valor), 0);

  const pagosParcelas = instances
    ? instances
        .filter(i =>
          getInstanceTipoParcelamento(i) !== "divida" &&
          (i.status === "pago" || i.status === "paid"),
        )
        .reduce((s, i) => s + num(i.amount), 0)
    : parcelas
        .filter(p => p.status === "pago")
        .reduce((s, p) => s + num(p.valor), 0);

  const dividasPagas = instances
    ? instances
        .filter(i =>
          getInstanceTipoParcelamento(i) === "divida" &&
          (i.status === "pago" || i.status === "paid"),
        )
        .reduce((s, i) => s + num(i.amount), 0)
    : dividas
        .filter(d => d.status === "pago")
        .reduce((s, d) => s + num(d.valor), 0);

  const despesasPagas = pagosFixasVar + pagosParcelas + dividasPagas;

  const despesaCorrente = totalFixas + totalVariaveis + totalParcelas;
  const despesaCorrentePaga = pagosFixasVar + pagosParcelas;

  const totalReceitas = receitas.reduce((s, r) => s + num(r.valor), 0);
  const receitasRecebidas = receitas
    .filter(r => r.status === "recebido")
    .reduce((s, r) => s + num(r.valor), 0);

  const totalEconomias = economias.reduce((s, e) => s + num(e.valor), 0);

  return {
    fixas, variaveis, parcelas, dividas,
    totalFixas, totalVariaveis, totalParcelas, totalDividas,
    totalDespesas, despesasPagas, dividasPagas,
    despesaCorrente, despesaCorrentePaga,
    totalReceitas, receitasRecebidas, totalEconomias,
  };
}
