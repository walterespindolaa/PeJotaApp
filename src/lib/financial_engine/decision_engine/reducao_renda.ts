import { FINANCIAL_PREMISES, taxaAnualParaMensal, calcFVAnuidade } from "../financial_premises";
import type { DecisionContext, DecisionResult } from "./types";

export function calcularReducaoRenda(
  reducaoMensal: number,
  prazoMeses: number,
  ctx: DecisionContext,
): DecisionResult {
  // Usa premissa do usuario (configurada em aposentadoria) ou cai pro padrao 5% a.a. real.
  const retornoMensal = ctx.taxaRealMensal > 0
    ? ctx.taxaRealMensal
    : taxaAnualParaMensal(FINANCIAL_PREMISES.retorno_real_medio);
  const taxaSegura = FINANCIAL_PREMISES.taxa_segura_retirada;

  const novaPoup = Math.max(0, ctx.poupancaMensal - reducaoMensal);
  const novaRenda = ctx.rendaTotal - reducaoMensal;
  const deficit = novaRenda - ctx.despesasMensais;

  let mesesReserva = Infinity;
  if (deficit < 0) {
    mesesReserva = ctx.reservaAtual / Math.abs(deficit);
  }

  // Impacto real: (poupanca que deixou de ser feita) + (deficit que consome reserva)
  const perdaPoupAcumulada = Math.min(reducaoMensal, ctx.poupancaMensal) * prazoMeses;
  const mesesDeficitReal = deficit < 0 ? Math.min(prazoMeses, Math.ceil(mesesReserva)) : 0;
  const deficitAcumulado = deficit < 0 ? Math.abs(deficit) * mesesDeficitReal : 0;
  const impactoTotal = perdaPoupAcumulada + deficitAcumulado;
  const perdaPoup = ctx.poupancaMensal - novaPoup;
  const mesesAtraso = 0;

  // Custo de oportunidade da poupança perdida
  const custoOp = perdaPoup > 0
    ? calcFVAnuidade(perdaPoup, retornoMensal, prazoMeses) - perdaPoup * prazoMeses
    : 0;

  const capitalPotencialPerdido = custoOp;
  const rendaPassivaPerdida = capitalPotencialPerdido * taxaSegura / 12;

  const memoria: string[] = [
    `📉 REDUÇÃO DE RENDA`,
    `Redução mensal: R$ ${reducaoMensal.toLocaleString("pt-BR")}`,
    `Prazo: ${prazoMeses} meses`,
    ``,
    `📊 SITUAÇÃO FINANCEIRA`,
    `Renda atual: R$ ${ctx.rendaTotal.toLocaleString("pt-BR")}`,
    `Nova renda: R$ ${novaRenda.toLocaleString("pt-BR")}`,
    `Despesas mensais: R$ ${ctx.despesasMensais.toLocaleString("pt-BR")}`,
    `Novo saldo mensal: R$ ${deficit.toLocaleString("pt-BR")}`,
    ``,
  ];

  if (deficit < 0) {
    memoria.push(
      `⚠️ ATENÇÃO: Saldo mensal NEGATIVO`,
      `Deficit mensal: R$ ${Math.abs(deficit).toLocaleString("pt-BR")}`,
      `Reserva atual: R$ ${ctx.reservaAtual.toLocaleString("pt-BR")}`,
      `Meses até esgotar reserva: ${mesesReserva.toFixed(1)}`,
      ``,
    );
  }

  memoria.push(
    `⏳ IMPACTO NA APOSENTADORIA`,
    `Poupança atual: R$ ${ctx.poupancaMensal.toLocaleString("pt-BR")}`,
    `Nova poupança: R$ ${novaPoup.toLocaleString("pt-BR")}`,
    `Perda de poupança acumulada: R$ ${perdaPoupAcumulada.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Deficit consumindo reserva: R$ ${deficitAcumulado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Impacto total real: R$ ${impactoTotal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Capital potencial não acumulado: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Renda passiva perdida: R$ ${rendaPassivaPerdida.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`,
  );

  return {
    impactoMensal: -reducaoMensal,
    impactoTotal: -impactoTotal,
    impactoPatrimonio: -custoOp,
    impactoReserva: deficit < 0 ? Math.max(-ctx.reservaAtual, deficit * Math.min(prazoMeses, mesesReserva)) : 0,
    custoOportunidade: custoOp,
    impactoAposentadoriaMeses: mesesAtraso,
    capitalPotencialPerdido,
    rendaPassivaPerdida,
    memoriaCalculo: memoria,
  };
}
