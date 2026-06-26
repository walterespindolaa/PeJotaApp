import { FINANCIAL_PREMISES, taxaAnualParaMensal, calcPMT, calcFV } from "../financial_premises";
import type { DecisionContext, DecisionResult } from "./types";

export function calcularTrocarCarro(
  valorCarro: number,
  prazoMeses: number,
  ctx: DecisionContext,
  percentualEntrada = FINANCIAL_PREMISES.percentual_entrada_carro,
  taxaFinanciamentoAnual = 0.18, // Taxa média de financiamento veicular (~18% a.a.)
): DecisionResult {
  const entrada = valorCarro * percentualEntrada;
  const valorFinanciado = valorCarro - entrada;
  const taxaMensal = taxaAnualParaMensal(taxaFinanciamentoAnual);
  const parcela = valorFinanciado > 0 ? calcPMT(valorFinanciado, taxaMensal, prazoMeses) : 0;
  // Usa premissa do usuario (configurada em aposentadoria) ou cai pro padrao 5% a.a. real.
  const retornoMensal = ctx.taxaRealMensal > 0
    ? ctx.taxaRealMensal
    : taxaAnualParaMensal(FINANCIAL_PREMISES.retorno_real_medio);
  const depAnual = FINANCIAL_PREMISES.depreciacao_carro;
  const taxaSegura = FINANCIAL_PREMISES.taxa_segura_retirada;

  const anos = prazoMeses / 12;
  const valorFuturoCarro = valorCarro * Math.pow(1 - depAnual, anos);
  const perdaDepreciacao = valorCarro - valorFuturoCarro;

  // Custo de oportunidade
  const custoOpEntrada = calcFV(entrada, retornoMensal, prazoMeses) - entrada;
  const custoOpParcelas = parcela > 0
    ? parcela * (Math.pow(1 + retornoMensal, prazoMeses) - 1) / retornoMensal - parcela * prazoMeses
    : 0;

  const novaReserva = Math.max(0, ctx.reservaAtual - entrada);
  const impactoPatrimonio = valorFuturoCarro - valorCarro;

  // mesesAtraso descartado: heuristica sem fundamento.
  const mesesAtraso = 0;

  const capitalPotencialPerdido = custoOpEntrada + custoOpParcelas;
  const rendaPassivaPerdida = capitalPotencialPerdido * taxaSegura / 12;

  // Custo liquido real = total pago - valor residual do bem
  const totalPago = entrada + parcela * prazoMeses;
  const custoLiquido = totalPago - valorFuturoCarro;

  const memoria: string[] = [
    `🚗 TROCAR CARRO`,
    `Valor do veículo: R$ ${valorCarro.toLocaleString("pt-BR")}`,
    `Entrada (${(percentualEntrada * 100).toFixed(0)}%): R$ ${entrada.toLocaleString("pt-BR")}`,
    `Valor financiado: R$ ${valorFinanciado.toLocaleString("pt-BR")}`,
    `Prazo: ${prazoMeses} meses`,
    ``,
    `📉 DEPRECIAÇÃO`,
    `Taxa: ${(depAnual * 100).toFixed(0)}% ao ano`,
    `Valor em ${anos.toFixed(1)} anos: R$ ${valorFuturoCarro.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Perda por depreciação: R$ ${perdaDepreciacao.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `📊 FINANCIAMENTO`,
    `Parcela mensal: R$ ${parcela.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`,
    `Total pago: R$ ${totalPago.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Valor residual do bem: R$ ${valorFuturoCarro.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Custo liquido: R$ ${custoLiquido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `💰 CUSTO DE OPORTUNIDADE`,
    `Entrada investida: R$ ${custoOpEntrada.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Parcelas investidas: R$ ${custoOpParcelas.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Total: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `⏳ IMPACTO NA APOSENTADORIA`,
    `Capital potencial não acumulado: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Renda passiva perdida: R$ ${rendaPassivaPerdida.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`,
  ];

  return {
    impactoMensal: -parcela,
    impactoTotal: -custoLiquido,
    impactoPatrimonio,
    impactoReserva: novaReserva - ctx.reservaAtual,
    custoOportunidade: custoOpEntrada + custoOpParcelas,
    impactoAposentadoriaMeses: mesesAtraso,
    capitalPotencialPerdido,
    rendaPassivaPerdida,
    memoriaCalculo: memoria,
  };
}
