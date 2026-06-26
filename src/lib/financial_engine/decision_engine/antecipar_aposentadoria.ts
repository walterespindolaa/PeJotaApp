import { FINANCIAL_PREMISES } from "../financial_premises";
import type { DecisionContext, DecisionResult } from "./types";

export function calcularAnteciparAposentadoria(
  rendaMensalDesejada: number,
  anosAntecipacao: number,
  ctx: DecisionContext,
): DecisionResult {
  const mesesAntecipacao = anosAntecipacao * 12;
  const rendaAnual = rendaMensalDesejada * 12;
  const taxaRetirada = FINANCIAL_PREMISES.taxa_segura_retirada;

  const patrimonioNecessario = rendaAnual / taxaRetirada;
  const rendaPassivelAtual = ctx.patrimonioAtual * taxaRetirada / 12;

  const gapPatrimonio = patrimonioNecessario - ctx.patrimonioAtual;
  const gapMensal = rendaMensalDesejada - rendaPassivelAtual;

  // Calculate years needed using compound interest: FV = PV(1+r)^n + PMT×((1+r)^n-1)/r
  // Solve for n iteratively
  let anosAdicionais = 0;
  if (gapPatrimonio > 0 && ctx.poupancaMensal > 0) {
    const r = ctx.taxaRealMensal > 0 ? ctx.taxaRealMensal : 0.004;
    let meses = 0;
    let acumulado = ctx.patrimonioAtual;
    while (acumulado < patrimonioNecessario && meses < 600) { // max 50 years
      acumulado = acumulado * (1 + r) + ctx.poupancaMensal;
      meses++;
    }
    anosAdicionais = meses / 12;
  }

  // For early retirement, the "lost capital" is the gap itself
  const capitalPotencialPerdido = Math.max(0, gapPatrimonio);
  const rendaPassivaPerdida = gapMensal > 0 ? gapMensal : 0;

  const memoria: string[] = [
    `🏖️ ANTECIPAR APOSENTADORIA`,
    `Renda mensal desejada: R$ ${rendaMensalDesejada.toLocaleString("pt-BR")}`,
    `Antecipar em: ${anosAntecipacao} anos (${mesesAntecipacao} meses)`,
    ``,
    `📊 CÁLCULO PELA REGRA DOS 4%`,
    `Renda anual necessária: R$ ${rendaAnual.toLocaleString("pt-BR")}`,
    `Patrimônio necessário: R$ ${patrimonioNecessario.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
    `📍 SITUAÇÃO ATUAL`,
    `Patrimônio atual: R$ ${ctx.patrimonioAtual.toLocaleString("pt-BR")}`,
    `Renda passiva possível hoje: R$ ${rendaPassivelAtual.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`,
    `Gap mensal: R$ ${gapMensal.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Gap patrimonial: R$ ${gapPatrimonio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    ``,
  ];

  if (gapPatrimonio > 0) {
    memoria.push(
      `⚠️ Patrimônio INSUFICIENTE`,
      `Faltam: R$ ${gapPatrimonio.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
      `Anos adicionais necessários (a poupança atual): ${anosAdicionais.toFixed(1)} anos`,
      ``,
    );
  } else {
    memoria.push(`✅ Patrimônio SUFICIENTE para a renda desejada.`, ``);
  }

  memoria.push(
    `⏳ IMPACTO NA APOSENTADORIA`,
    `Capital potencial não acumulado: R$ ${capitalPotencialPerdido.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`,
    `Renda passiva perdida (gap): R$ ${rendaPassivaPerdida.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}/mês`,
  );

  return {
    impactoMensal: -gapMensal,
    impactoTotal: -gapPatrimonio,
    impactoPatrimonio: -gapPatrimonio,
    impactoReserva: 0,
    custoOportunidade: 0,
    // Nao calculamos atraso aqui (precisaria de idadeAtual no contexto, que nao esta sempre disponivel).
    // A info de viabilidade esta em capitalPotencialPerdido e na memoria de calculo (anosAdicionais).
    impactoAposentadoriaMeses: 0,
    capitalPotencialPerdido,
    rendaPassivaPerdida,
    memoriaCalculo: memoria,
  };
}
