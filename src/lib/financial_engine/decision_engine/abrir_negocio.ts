import { FINANCIAL_PREMISES, taxaAnualParaMensal, calcFV, calcFVAnuidade } from "../financial_premises";
import type { DecisionContext, DecisionResult } from "./types";

export function calcularAbrirNegocio(
  investimentoInicial: number,
  mesesMaturacao: number,
  ctx: DecisionContext,
  aporteMensal = 0,
): DecisionResult {
  const retornoMensal = ctx.taxaRealMensal > 0
    ? ctx.taxaRealMensal
    : taxaAnualParaMensal(FINANCIAL_PREMISES.retorno_real_medio);
  const taxaSegura = FINANCIAL_PREMISES.taxa_segura_retirada;

  const novaReserva = Math.max(0, ctx.reservaAtual - investimentoInicial);
  const custoOpInicial = calcFV(investimentoInicial, retornoMensal, mesesMaturacao) - investimentoInicial;
  const custoOpAporte = aporteMensal > 0
    ? calcFVAnuidade(aporteMensal, retornoMensal, mesesMaturacao) - aporteMensal * mesesMaturacao
    : 0;
  const custoOp = custoOpInicial + custoOpAporte;

  const reservaNecessaria = ctx.despesasMensais * mesesMaturacao;
  const aporteAcumulado = aporteMensal * mesesMaturacao;
  const capitalTotal = investimentoInicial + reservaNecessaria + aporteAcumulado;

  const mesesAtraso = ctx.poupancaMensal > 0
    ? Math.round((investimentoInicial + aporteAcumulado) / ctx.poupancaMensal)
    : mesesMaturacao;

  const capitalPotencialPerdido = custoOp;
  const rendaPassivaPerdida = capitalPotencialPerdido * taxaSegura / 12;

  const memoria: string[] = [
    `💼 ABRIR NEGÓCIO / EMPREENDER`,
    `Investimento inicial: R$ ${investimentoInicial.toLocaleString("pt-BR")}`,
    `Aporte mensal durante maturação: R$ ${aporteMensal.toLocaleString("pt-BR")}`,
    `Tempo de maturação: ${mesesMaturacao} meses`,
    ``,
    `📊 IMPACTO NA RESERVA`,
    `Reserva atual: R$ ${ctx.reservaAtual.toLocaleString("pt-BR")}`,
    `Nova reserva (após investimento inicial): R$ ${novaReserva.toLocaleString("pt-BR")}`,
    ``,
    `⚠️ CAPITAL NECESSÁRIO`,
    `Investimento + reserva pessoal (${mesesMaturacao} meses) + aportes:`,
    `R$ ${investimentoInicial.toLocaleString("pt-BR")} + R$ ${reservaNecessaria.toLocaleString("pt-BR")} + R$ ${aporteAcumulado.toLocaleString("pt-BR")} = R$ ${capitalTotal.toLocaleString("pt-BR")}`,
    ``,
    `💰 CUSTO DE OPORTUNIDADE`,
    `Investimento inicial parado: R$ ${custoOpInicial.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Aportes mensais: R$ ${custoOpAporte.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Total: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `⏳ IMPACTO NA APOSENTADORIA`,
    `Meses equivalentes de poupança: ${mesesAtraso}`,
    `Capital potencial não acumulado: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Renda passiva perdida: R$ ${rendaPassivaPerdida.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`,
  ];

  return {
    impactoMensal: -aporteMensal,
    impactoTotal: -(investimentoInicial + aporteAcumulado),
    impactoPatrimonio: -custoOp,
    impactoReserva: novaReserva - ctx.reservaAtual,
    custoOportunidade: custoOp,
    impactoAposentadoriaMeses: mesesAtraso,
    capitalPotencialPerdido,
    rendaPassivaPerdida,
    memoriaCalculo: memoria,
  };
}
