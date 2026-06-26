/**
 * Tipos compartilhados do motor de decisão financeira
 */

export interface DecisionContext {
  reservaAtual: number;
  despesasMensais: number;
  patrimonioAtual: number;
  poupancaMensal: number;
  rendaTotal: number;
  /** Taxa real mensal derivada das premissas do usuário (Fisher) */
  taxaRealMensal: number;
}

export interface DecisionResult {
  /** Impacto mensal no fluxo de caixa (negativo = saída) */
  impactoMensal: number;
  /** Impacto total acumulado no período */
  impactoTotal: number;
  /** Variação no patrimônio líquido */
  impactoPatrimonio: number;
  /** Variação na reserva de emergência */
  impactoReserva: number;
  /** Custo de oportunidade (quanto renderia se investido) */
  custoOportunidade: number;
  /** Impacto na aposentadoria em meses (positivo = atrasa) */
  impactoAposentadoriaMeses: number;
  /** Capital potencial não acumulado por causa da decisão */
  capitalPotencialPerdido: number;
  /** Renda passiva mensal perdida (capital perdido × taxa segura / 12) */
  rendaPassivaPerdida: number;
  /** Linhas da memória de cálculo */
  memoriaCalculo: string[];
}
