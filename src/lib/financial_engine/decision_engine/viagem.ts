import { FINANCIAL_PREMISES, taxaAnualParaMensal, calcFV, calcPMT } from "../financial_premises";
import type { DecisionContext, DecisionResult } from "./types";

export function calcularViagem(
  valorViagem: number,
  prazoMeses: number,
  ctx: DecisionContext,
): DecisionResult {
  // Usa premissa do usuario (configurada em aposentadoria) ou cai pro padrao 5% a.a. real.
  const retornoMensal = ctx.taxaRealMensal > 0
    ? ctx.taxaRealMensal
    : taxaAnualParaMensal(FINANCIAL_PREMISES.retorno_real_medio);
  const taxaSegura = FINANCIAL_PREMISES.taxa_segura_retirada;

  const horizonte = Math.max(prazoMeses, 60);
  const custoOp = calcFV(valorViagem, retornoMensal, horizonte) - valorViagem;

  // Reserva so e impactada se for pagamento a vista (prazo = 1).
  // Se for parcelado, premissa: paga do fluxo mensal, nao da reserva.
  const isParcelado = prazoMeses > 1;
  const novaReserva = isParcelado ? ctx.reservaAtual : Math.max(0, ctx.reservaAtual - valorViagem);

  // Parcelamento curto (ate 12 meses) presumido sem juros (cartao). Acima disso, juros de cartao (~20% a.a.).
  const TAXA_CARTAO_ANUAL = 0.20;
  const taxaCartaoMensal = taxaAnualParaMensal(TAXA_CARTAO_ANUAL);
  const parcelaMensal = !isParcelado
    ? 0
    : prazoMeses <= 12
      ? valorViagem / prazoMeses
      : calcPMT(valorViagem, taxaCartaoMensal, prazoMeses);
  const mesesAtraso = 0;

  const capitalPotencialPerdido = custoOp;
  const rendaPassivaPerdida = capitalPotencialPerdido * taxaSegura / 12;

  const memoria: string[] = [
    `✈️ VIAGEM`,
    `Custo total: R$ ${valorViagem.toLocaleString("pt-BR")}`,
    isParcelado
      ? prazoMeses <= 12
        ? `Parcelado em ${prazoMeses} meses (sem juros): R$ ${parcelaMensal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}/mês`
        : `Parcelado em ${prazoMeses} meses (juros cartao ${(TAXA_CARTAO_ANUAL * 100).toFixed(0)}% a.a.): R$ ${parcelaMensal.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}/mês`
      : `Pagamento à vista (sai da reserva)`,
    ``,
    `📊 IMPACTO`,
    `Reserva atual: R$ ${ctx.reservaAtual.toLocaleString("pt-BR")}`,
    `Nova reserva: R$ ${novaReserva.toLocaleString("pt-BR")}`,
    ``,
    `💰 CUSTO DE OPORTUNIDADE (${horizonte} meses)`,
    `Se investido renderia: R$ ${(valorViagem + custoOp).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Custo de oportunidade: R$ ${custoOp.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `⏳ IMPACTO NA APOSENTADORIA`,
    `Capital potencial não acumulado: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Renda passiva perdida: R$ ${rendaPassivaPerdida.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`,
  ];

  return {
    impactoMensal: -parcelaMensal,
    // Parcelamento > 12m tem juros de cartao: o custo real e o total parcelado, nao o valor a vista.
    impactoTotal: (isParcelado && prazoMeses > 12) ? -(parcelaMensal * prazoMeses) : -valorViagem,
    impactoPatrimonio: -custoOp,
    impactoReserva: novaReserva - ctx.reservaAtual,
    custoOportunidade: custoOp,
    impactoAposentadoriaMeses: mesesAtraso,
    capitalPotencialPerdido,
    rendaPassivaPerdida,
    memoriaCalculo: memoria,
  };
}
