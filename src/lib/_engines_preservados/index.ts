/* ============================================================
   PeJota — Fórmulas e engines de cálculo PRESERVADAS
   ------------------------------------------------------------
   REGRA DE OURO: nenhuma fórmula/estrutura de cálculo do Atlas
   é apagada. Mesmo quando a TELA é removida (ex.: aposentadoria,
   carteira de investimentos), o motor de cálculo continua aqui,
   pronto para reaproveitar/adaptar ao contexto PJ.

   Reexporta os módulos originais por namespace (sem movê-los,
   para não quebrar imports existentes). Conforme cada engine for
   adaptada para PJ, atualizamos a origem aqui.
   ============================================================ */

// Motor de decisão financeira (adaptar para decisões PJ: abrir filial,
// financiar equipamento, queda de faturamento, etc.)
export * as decisionEngine from "../financial_engine/decision_engine";
export * as lifeProjection from "../financial_engine/life_projection";
export * as financialPremises from "../financial_engine/financial_premises";

// Cálculos de aposentadoria/previdência (uso futuro: pró-labore, retirada de sócios)
export * as aposentadoria from "../aposentadoria";

// Amortização (financiamento/consórcio — reusar p/ equipamento e veículo PJ)
export * as amortizacao from "../amortizacao";

// Score / inteligência (referência p/ BusinessHealthScore)
export * as atlasScore from "../atlasScore";

// Totais mensais, recorrências e parcelas (núcleo do fluxo de caixa)
export * as computeMonthTotals from "../computeMonthTotals";
export * as parcelaProjector from "../parcelaProjector";
export * as projectRecurring from "../projectRecurring";
export * as mergeRecurring from "../mergeRecurring";

// Renda fixa / acrual (preservado da carteira de investimentos)
export * as rendaFixaAcrual from "../investimentos/rendaFixaAcrual";
