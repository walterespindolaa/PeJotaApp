// Fórmula pura do gap de renda da aposentadoria — fonte única compartilhada
// entre a página Aposentadoria e o resumo do dashboard (não recalcular por fora).
export function computeAposentadoriaGap(p: {
  rendaDesejada: number;
  rendaPassivaAtual: number;
  rendaPassivaBens: number;
  incluirBens: boolean;
}): { rendaPassivaTotal: number; gapMensal: number } {
  const rendaPassivaTotal = p.rendaPassivaAtual + (p.incluirBens ? p.rendaPassivaBens : 0);
  const gapMensal = Math.max(0, p.rendaDesejada - rendaPassivaTotal);
  return { rendaPassivaTotal, gapMensal };
}
