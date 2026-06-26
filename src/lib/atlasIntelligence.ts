/**
 * Atlas Intelligence Layer — Isolated calculation engine
 * Score 2.0 with 7 dimensions, gamification, and advisor logic
 * NOTE: The official score computation is in atlasScore.ts (computeAtlasScore).
 * simulateDecision now delegates to that engine for consistency.
 */

import { computeAtlasScore, type AtlasScoreInputs } from "@/lib/atlasScore";

// ── Score Dimensions ──
export interface ScoreDimensions {
  reservaEmergencia: number;    // 0-100
  margemFinanceira: number;     // 0-100
  disciplinaControle: number;   // 0-100
  diversificacaoInv: number;    // 0-100
  planejamentoAposent: number;  // 0-100
  organizacaoEmpresa: number;   // 0-100 (null if no business)
  evolucaoPatrimonial: number;  // 0-100
}

export interface ScoreWeights {
  reservaEmergencia: number;
  margemFinanceira: number;
  disciplinaControle: number;
  diversificacaoInv: number;
  planejamentoAposent: number;
  organizacaoEmpresa: number;
  evolucaoPatrimonial: number;
}

const DEFAULT_WEIGHTS: ScoreWeights = {
  reservaEmergencia: 0.20,
  margemFinanceira: 0.15,
  disciplinaControle: 0.10,
  diversificacaoInv: 0.15,
  planejamentoAposent: 0.20,
  organizacaoEmpresa: 0.10,
  evolucaoPatrimonial: 0.10,
};

const WEIGHTS_NO_BUSINESS: ScoreWeights = {
  reservaEmergencia: 0.22,
  margemFinanceira: 0.18,
  disciplinaControle: 0.12,
  diversificacaoInv: 0.18,
  planejamentoAposent: 0.20,
  organizacaoEmpresa: 0,
  evolucaoPatrimonial: 0.10,
};
// Note: sums to 1.00 (0.22+0.18+0.12+0.18+0.20+0.10 = 1.00) ✓

export function getWeights(hasEmpresa: boolean): ScoreWeights {
  return hasEmpresa ? DEFAULT_WEIGHTS : WEIGHTS_NO_BUSINESS;
}

export function calcAtlasScore(dims: ScoreDimensions, hasEmpresa: boolean): number {
  const w = getWeights(hasEmpresa);
  const score =
    dims.reservaEmergencia * w.reservaEmergencia +
    dims.margemFinanceira * w.margemFinanceira +
    dims.disciplinaControle * w.disciplinaControle +
    dims.diversificacaoInv * w.diversificacaoInv +
    dims.planejamentoAposent * w.planejamentoAposent +
    dims.organizacaoEmpresa * w.organizacaoEmpresa +
    dims.evolucaoPatrimonial * w.evolucaoPatrimonial;
  return Math.round(Math.max(0, Math.min(100, score)));
}

// ── Classification ──
export type ScoreLevel = "Crítico" | "Instável" | "Estruturado" | "Estratégico";

export interface ScoreClassification {
  label: ScoreLevel;
  color: string;        // tailwind class
  ringColor: string;    // hsl for SVG
  min: number;
  max: number;
}

const LEVELS: ScoreClassification[] = [
  { label: "Crítico", color: "text-destructive", ringColor: "hsl(var(--destructive))", min: 0, max: 49 },
  { label: "Instável", color: "text-warning", ringColor: "hsl(var(--warning))", min: 50, max: 69 },
  { label: "Estruturado", color: "text-success", ringColor: "hsl(var(--success))", min: 70, max: 84 },
  { label: "Estratégico", color: "text-info", ringColor: "hsl(var(--info))", min: 85, max: 100 },
];

export function getClassification(score: number): ScoreClassification {
  return LEVELS.find(l => score >= l.min && score <= l.max) || LEVELS[0];
}

export function getNextLevel(score: number): { label: ScoreLevel; pointsNeeded: number } | null {
  const current = getClassification(score);
  const idx = LEVELS.indexOf(current);
  if (idx >= LEVELS.length - 1) return null;
  const next = LEVELS[idx + 1];
  return { label: next.label, pointsNeeded: next.min - score };
}

// ── Dimension Calculators ──
export function calcReservaEmergencia(reservaAtual: number, despesasMensais: number, metaMeses: number = 8): number {
  const meta = despesasMensais * metaMeses;
  if (meta <= 0) return 0;
  return Math.min(100, (reservaAtual / meta) * 100);
}

export function calcMargemFinanceira(totalReceitas: number, totalDespesas: number): number {
  if (totalReceitas <= 0) return 0;
  const margem = ((totalReceitas - totalDespesas) / totalReceitas) * 100;
  // 30%+ margem = 100 score
  return Math.max(0, Math.min(100, (margem / 30) * 100));
}

export function calcDisciplinaControle(mesesComRegistro: number, totalMeses: number): number {
  if (totalMeses <= 0) return 0;
  return Math.min(100, (mesesComRegistro / totalMeses) * 100);
}

export function calcDiversificacaoInv(alocacaoPorClasse: Record<string, number>): number {
  const pesos = Object.values(alocacaoPorClasse).filter(w => w > 0.01);
  if (pesos.length === 0) return 0;
  // Herfindahl index: H = Σ(peso²)
  const H = pesos.reduce((sum, w) => sum + w * w, 0);
  const Hmin = 1 / pesos.length;
  // Normalize: 0 when H=1 (single class), 100 when H=Hmin (perfect)
  const diversification = Hmin < 1 ? Math.max(0, Math.min(1, (1 - H) / (1 - Hmin))) : 0;
  return Math.round(diversification * 100);
}

export function calcPlanejamentoAposent(opts: {
  temPremissas: boolean;
  patrimonioAtual: number;
  montanteNecessario: number;
  aporteMensal: number;
}): number {
  if (!opts.temPremissas) return 0;
  let score = 30; // has premissas
  if (opts.montanteNecessario > 0) {
    const coverage = Math.min(opts.patrimonioAtual / opts.montanteNecessario, 1);
    score += coverage * 50;
  }
  if (opts.aporteMensal > 0) score += 20;
  return Math.min(100, score);
}

export function calcOrganizacaoEmpresa(margem: number): number {
  // margem 20%+ = 100
  if (margem <= 0) return 0;
  return Math.min(100, (margem / 20) * 100);
}

export function calcEvolucaoPatrimonial(crescimentoPct: number): number {
  // 10%+ annual growth = 100
  return Math.max(0, Math.min(100, (crescimentoPct / 10) * 100));
}

// ── Gamification: Achievements ──
export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
}

export function checkAchievements(opts: {
  reservaCompleta: boolean;
  mesesConsecutivos: number;
  empresaMargemSaudavel: boolean;
  aposentadoriaAlinhada: boolean;
  mesesSemNegativo: number;
  hasEmpresa: boolean;
  empresaQualificada?: boolean; // ≥10 PJ entries or company_name + data
}): Achievement[] {
  const list: Achievement[] = [
    {
      id: "reserva_completa",
      icon: "🛡️",
      title: "Escudo Financeiro",
      description: "Reserva de emergência completa",
      unlocked: opts.reservaCompleta,
    },
    {
      id: "controle_6m",
      icon: "🔥",
      title: "Disciplina de Ferro",
      description: "6 meses consecutivos de controle",
      unlocked: opts.mesesConsecutivos >= 6,
    },
    {
      id: "aposentadoria",
      icon: "🎯",
      title: "Futuro Garantido",
      description: "Meta de aposentadoria alinhada",
      unlocked: opts.aposentadoriaAlinhada,
    },
    {
      id: "sem_negativo",
      icon: "💎",
      title: "Consistência de Ouro",
      description: "12 meses sem saldo negativo",
      unlocked: opts.mesesSemNegativo >= 12,
    },
  ];
  if (opts.hasEmpresa && (opts.empresaQualificada ?? false)) {
    list.splice(2, 0, {
      id: "empresa_saudavel",
      icon: "💼",
      title: "Empresário Estratégico",
      description: "Empresa com margem saudável e dados consistentes",
      unlocked: opts.empresaMargemSaudavel,
    });
  }
  return list;
}

// ── Advisor: Smart Recommendations ──
export interface Recommendation {
  icon: string;
  text: string;
  type: "success" | "warning" | "danger" | "info";
}

export function generateRecommendations(opts: {
  reservaMeses: number;      // months covered
  margemPct: number;         // profit margin %
  proLaborePct: number;      // pro-labore as % of business profit
  investimentoMensal: number;
  metaInvestMensal: number;  // required monthly for retirement
  hasEmpresa: boolean;
  scoreDims: ScoreDimensions;
}): Recommendation[] {
  const list: Recommendation[] = [];

  if (opts.reservaMeses < 3) {
    list.push({ icon: "🛡️", text: "Sua reserva cobre menos de 3 meses. O ideal é ter entre 6 e 12 meses de despesas.", type: "danger" });
  } else if (opts.reservaMeses < 6) {
    list.push({ icon: "🛡️", text: "Sua reserva cobre " + Math.floor(opts.reservaMeses) + " meses. Continue até atingir pelo menos 6 meses.", type: "warning" });
  }

  if (opts.margemPct < 10 && opts.margemPct >= 0) {
    list.push({ icon: "⚠️", text: "Sua margem financeira está em " + opts.margemPct.toFixed(0) + "%. Avalie reduzir despesas para ampliar sua folga.", type: "warning" });
  }

  if (opts.hasEmpresa && opts.proLaborePct > 50) {
    list.push({ icon: "💼", text: "Seu pró-labore representa " + opts.proLaborePct.toFixed(0) + "% do lucro. Sua empresa pode estar financiando seu padrão pessoal.", type: "warning" });
  }

  if (opts.metaInvestMensal > 0 && opts.investimentoMensal < opts.metaInvestMensal) {
    const diff = opts.metaInvestMensal - opts.investimentoMensal;
    list.push({ icon: "📉", text: `Você está investindo R$ ${diff.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} abaixo do necessário para sua aposentadoria.`, type: "danger" });
  }

  if (opts.scoreDims.diversificacaoInv < 40) {
    list.push({ icon: "🎲", text: "Seus investimentos estão concentrados. Diversificar reduz riscos e melhora o Score.", type: "info" });
  }

  if (opts.scoreDims.disciplinaControle >= 80) {
    list.push({ icon: "🔥", text: "Excelente disciplina! Seu controle financeiro está acima da média.", type: "success" });
  }

  if (list.length === 0) {
    list.push({ icon: "✅", text: "Tudo em ordem! Continue monitorando seus indicadores.", type: "success" });
  }

  return list;
}

// ── Decision Simulator ──
export interface SimulationInput {
  tipo: string;
  valor: number;
  prazoMeses: number;
}

export interface SimulationResult {
  scoreBefore: number;
  scoreAfter: number;
  reservaImpact: number;     // % change
  patrimonioImpact: number;  // absolute change in projected patrimony
  aposentImpact: number;     // months delayed/advanced
}

/**
 * Simulate a financial decision using the OFFICIAL Atlas Score engine (atlasScore.ts).
 * This ensures the simulator produces scores identical to the dashboard.
 */
export function simulateDecision(
  input: SimulationInput,
  currentScore: number,
  _currentDims: ScoreDimensions,
  hasEmpresa: boolean,
  context: {
    reservaAtual: number;
    despesasMensais: number;
    patrimonioAtual: number;
    poupancaMensal: number;
    taxaRealMensal: number;
  },
  /** Pass the real AtlasScoreInputs from useAtlasScore for full fidelity */
  baseInputs?: AtlasScoreInputs
): SimulationResult {
  const { valor, prazoMeses } = input;
  const { reservaAtual, despesasMensais, patrimonioAtual, poupancaMensal } = context;

  // Calculate impacts
  let newReserva = reservaAtual;
  let newPoupanca = poupancaMensal;
  let patrimonioChange = 0;

  switch (input.tipo) {
    case "comprar_imovel":
    case "trocar_carro":
      newReserva = Math.max(0, reservaAtual - valor * 0.3);
      patrimonioChange = -valor;
      break;
    case "aumentar_padrao":
      newPoupanca = Math.max(0, poupancaMensal - valor);
      patrimonioChange = -valor * prazoMeses;
      break;
    case "retirar_empresa":
      patrimonioChange = -valor;
      break;
    case "reduzir_renda":
      newPoupanca = Math.max(0, poupancaMensal - valor);
      patrimonioChange = -valor * prazoMeses;
      break;
    case "aumentar_investimento":
      newPoupanca = poupancaMensal + valor;
      patrimonioChange = valor * prazoMeses * (1 + context.taxaRealMensal * prazoMeses / 2);
      break;
  }

  // If we have the real inputs, use the official engine
  if (baseInputs) {
    const newInputs: AtlasScoreInputs = {
      ...baseInputs,
      reservaTotal: newReserva,
      plAtual: baseInputs.plAtual + patrimonioChange,
      aporteMensalMedio3m: newPoupanca > 0 ? newPoupanca : baseInputs.aporteMensalMedio3m,
      totalDespesas: input.tipo === "aumentar_padrao"
        ? baseInputs.totalDespesas + valor * prazoMeses
        : baseInputs.totalDespesas,
      totalReceitas: input.tipo === "reduzir_renda"
        ? Math.max(0, baseInputs.totalReceitas - valor * prazoMeses)
        : baseInputs.totalReceitas,
    };
    const afterResult = computeAtlasScore(newInputs);

    const monthsImpact = newPoupanca > 0 && poupancaMensal > 0
      ? Math.round((poupancaMensal - newPoupanca) / poupancaMensal * 12 * (prazoMeses / 12))
      : 0;

    return {
      scoreBefore: currentScore,
      scoreAfter: afterResult.score,
      reservaImpact: reservaAtual > 0 ? ((newReserva - reservaAtual) / reservaAtual) * 100 : 0,
      patrimonioImpact: patrimonioChange,
      aposentImpact: monthsImpact,
    };
  }

  // Fallback: use legacy calcAtlasScore when baseInputs not available
  const newDims = { ..._currentDims };
  const metaReserva = despesasMensais * 8;
  newDims.reservaEmergencia = metaReserva > 0 ? Math.min(100, (newReserva / metaReserva) * 100) : 0;
  const newPatrimonio = patrimonioAtual + patrimonioChange;
  const growthPct = patrimonioAtual > 0 ? ((newPatrimonio - patrimonioAtual) / patrimonioAtual) * 100 : 0;
  newDims.evolucaoPatrimonial = Math.max(0, Math.min(100, (growthPct + 10) / 10 * 100));
  const scoreAfter = calcAtlasScore(newDims, hasEmpresa);

  const monthsImpact = newPoupanca > 0 && poupancaMensal > 0
    ? Math.round((poupancaMensal - newPoupanca) / poupancaMensal * 12 * (prazoMeses / 12))
    : 0;

  return {
    scoreBefore: currentScore,
    scoreAfter,
    reservaImpact: reservaAtual > 0 ? ((newReserva - reservaAtual) / reservaAtual) * 100 : 0,
    patrimonioImpact: patrimonioChange,
    aposentImpact: monthsImpact,
  };
}
