import { FINANCIAL_PREMISES, taxaAnualParaMensal, calcPMT, calcFV, saldoDevedor } from "../financial_premises";
import type { DecisionContext, DecisionResult } from "./types";

export function calcularComprarImovel(
  valorImovel: number,
  prazoMeses: number,
  ctx: DecisionContext,
  percentualEntrada = FINANCIAL_PREMISES.percentual_entrada_imovel,
  taxaFinanciamentoAnual = FINANCIAL_PREMISES.taxa_financiamento_imovel,
): DecisionResult {
  const entrada = valorImovel * percentualEntrada;
  const valorFinanciado = valorImovel - entrada;
  const taxaMensal = taxaAnualParaMensal(taxaFinanciamentoAnual);
  const parcela = calcPMT(valorFinanciado, taxaMensal, prazoMeses);
  // Usa premissa do usuario (configurada em aposentadoria) ou cai pro padrao 5% a.a. real.
  const retornoMensal = ctx.taxaRealMensal > 0
    ? ctx.taxaRealMensal
    : taxaAnualParaMensal(FINANCIAL_PREMISES.retorno_real_medio);
  const taxaSegura = FINANCIAL_PREMISES.taxa_segura_retirada;

  // Custo de oportunidade da entrada
  const custoOpEntrada = calcFV(entrada, retornoMensal, prazoMeses) - entrada;
  // Custo de oportunidade das parcelas (se investisse a parcela todo mês)
  const fvParcelas = parcela * (Math.pow(1 + retornoMensal, prazoMeses) - 1) / retornoMensal;
  const custoOpParcelas = fvParcelas - parcela * prazoMeses;

  const novaReserva = Math.max(0, ctx.reservaAtual - entrada);
  // Impacto patrimonial real = juros totais pagos no financiamento (premissa: imovel preserva valor real).
  // Esse e o "custo do credito" que sai do PL futuro.
  const jurosTotaisPagos = parcela * prazoMeses - valorFinanciado;
  const impactoPatrimonio = -jurosTotaisPagos;

  // Impacto aposentadoria: parcela reduz poupança
  const novaPoup = Math.max(0, ctx.poupancaMensal - parcela);
  // mesesAtraso descartado: heuristica sem fundamento. Info real esta em capitalPotencialPerdido.
  const mesesAtraso = 0;

  // Impacto aposentadoria via custo de oportunidade
  const capitalPotencialPerdido = custoOpEntrada + custoOpParcelas;
  const rendaPassivaPerdida = capitalPotencialPerdido * taxaSegura / 12;

  const memoria: string[] = [
    `🏠 COMPRAR IMÓVEL`,
    `Valor do imóvel: R$ ${valorImovel.toLocaleString("pt-BR")}`,
    `Entrada (${(percentualEntrada * 100).toFixed(0)}%): R$ ${entrada.toLocaleString("pt-BR")}`,
    `Valor financiado: R$ ${valorFinanciado.toLocaleString("pt-BR")}`,
    `Taxa de financiamento: ${(taxaFinanciamentoAnual * 100).toFixed(1)}% a.a. → ${(taxaMensal * 100).toFixed(4)}% a.m.`,
    `Prazo: ${prazoMeses} meses`,
    ``,
    `📊 RESULTADOS`,
    `Parcela mensal (PMT): R$ ${parcela.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`,
    `Fórmula: PMT = PV × i / (1 − (1+i)^−n)`,
    `Total pago no prazo: R$ ${(parcela * prazoMeses).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Juros totais pagos: R$ ${jurosTotaisPagos.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `Reserva atual: R$ ${ctx.reservaAtual.toLocaleString("pt-BR")}`,
    `Nova reserva (após entrada): R$ ${novaReserva.toLocaleString("pt-BR")}`,
    ``,
    `💰 CUSTO DE OPORTUNIDADE`,
    `Custo de oportunidade da entrada: R$ ${custoOpEntrada.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Custo de oportunidade das parcelas: R$ ${custoOpParcelas.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Custo de oportunidade total: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `⏳ IMPACTO NA APOSENTADORIA`,
    `Poupança mensal atual: R$ ${ctx.poupancaMensal.toLocaleString("pt-BR")}`,
    `Nova poupança (após parcela): R$ ${novaPoup.toLocaleString("pt-BR")}`,
    `Capital potencial não acumulado: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Renda passiva perdida: R$ ${rendaPassivaPerdida.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`,
    `Fórmula: capital_perdido × ${(taxaSegura * 100).toFixed(0)}% / 12`,
  ];

  return {
    impactoMensal: -parcela,
    impactoTotal: -(entrada + parcela * prazoMeses),
    impactoPatrimonio,
    impactoReserva: novaReserva - ctx.reservaAtual,
    custoOportunidade: custoOpEntrada + custoOpParcelas,
    impactoAposentadoriaMeses: mesesAtraso,
    capitalPotencialPerdido,
    rendaPassivaPerdida,
    memoriaCalculo: memoria,
  };
}
