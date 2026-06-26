import { FINANCIAL_PREMISES, taxaAnualParaMensal, calcFVAnuidade } from "../financial_premises";
import type { DecisionContext, DecisionResult } from "./types";

export function calcularAumentoPadrao(
  aumentoMensal: number,
  prazoMeses: number,
  ctx: DecisionContext,
): DecisionResult {
  // Usa premissa do usuario (configurada em aposentadoria) ou cai pro padrao 5% a.a. real.
  const retornoMensal = ctx.taxaRealMensal > 0
    ? ctx.taxaRealMensal
    : taxaAnualParaMensal(FINANCIAL_PREMISES.retorno_real_medio);
  const taxaSegura = FINANCIAL_PREMISES.taxa_segura_retirada;

  const impactoLinear = aumentoMensal * prazoMeses;
  const custoOp = calcFVAnuidade(aumentoMensal, retornoMensal, prazoMeses) - impactoLinear;

  const novaPoup = Math.max(0, ctx.poupancaMensal - aumentoMensal);
  const mesesAtraso = 0;

  const capitalPotencialPerdido = custoOp;
  const rendaPassivaPerdida = capitalPotencialPerdido * taxaSegura / 12;

  const memoria: string[] = [
    `📈 AUMENTO DE PADRÃO DE VIDA`,
    `Aumento mensal: R$ ${aumentoMensal.toLocaleString("pt-BR")}`,
    `Prazo: ${prazoMeses} meses`,
    ``,
    `📊 IMPACTO LINEAR`,
    `Impacto total: R$ ${aumentoMensal.toLocaleString("pt-BR")} × ${prazoMeses} = R$ ${impactoLinear.toLocaleString("pt-BR")}`,
    ``,
    `💰 CUSTO DE OPORTUNIDADE (juros compostos)`,
    `Fórmula: FV = PMT × ((1+r)^n − 1) / r`,
    `Valor futuro se investido: R$ ${(impactoLinear + custoOp).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Custo de oportunidade: R$ ${custoOp.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `⏳ IMPACTO NA APOSENTADORIA`,
    `Poupança mensal atual: R$ ${ctx.poupancaMensal.toLocaleString("pt-BR")}`,
    `Nova poupança: R$ ${novaPoup.toLocaleString("pt-BR")}`,
    `Capital potencial não acumulado: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Renda passiva perdida: R$ ${rendaPassivaPerdida.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`,
  ];

  return {
    impactoMensal: -aumentoMensal,
    impactoTotal: -impactoLinear,
    impactoPatrimonio: -custoOp,
    impactoReserva: 0,
    custoOportunidade: custoOp,
    impactoAposentadoriaMeses: mesesAtraso,
    capitalPotencialPerdido,
    rendaPassivaPerdida,
    memoriaCalculo: memoria,
  };
}
