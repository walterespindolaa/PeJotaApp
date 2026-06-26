/**
 * Atlas Score 2.0 — Real mathematical calculation engine
 * Score 0–100 with 7 weighted pillars, weight redistribution for missing data,
 * drivers analysis, and detailed breakdown.
 * 5 Official Levels: Sobrevivência, Estabilização, Organização, Estrutura, Estratégico
 */

// ── Helpers ──
export const clip = (x: number, min: number, max: number) => Math.max(min, Math.min(max, x));
export const safeDiv = (a: number, b: number): number | null => (b === 0 ? null : a / b);

// ── Types ──
export type PillarStatus = "ok" | "sem_dados";

export interface PillarResult {
  key: string;
  label: string;
  icon: string;
  score: number;          // 0–100
  weight: number;         // effective weight after redistribution
  baseWeight: number;     // original weight
  status: PillarStatus;
  contribution: number;   // w * S
  inputs: Record<string, number | string | null>;
  tip: string;            // improvement hint
  formula: string;        // simplified formula description
}

export type AtlasLevel = "Sobrevivência" | "Estabilização" | "Organização" | "Estrutura" | "Estratégico";

export interface AtlasLevelDef {
  label: AtlasLevel;
  emoji: string;
  min: number;
  max: number;
  color: string;        // tailwind text class
  ringColor: string;    // hsl for SVG
  bgColor: string;      // tailwind bg class
  description: string;
}

export const ATLAS_LEVELS: AtlasLevelDef[] = [
  { label: "Sobrevivência", emoji: "🔴", min: 0, max: 39, color: "text-destructive", ringColor: "hsl(var(--destructive))", bgColor: "bg-destructive", description: "Vida financeira reativa. Falta estrutura básica." },
  { label: "Estabilização", emoji: "🟠", min: 40, max: 59, color: "text-warning", ringColor: "hsl(var(--warning))", bgColor: "bg-warning", description: "Controle iniciado, mas vulnerável." },
  { label: "Organização", emoji: "🟡", min: 60, max: 74, color: "text-amber-500", ringColor: "hsl(45 93% 47%)", bgColor: "bg-amber-500", description: "Base construída, ainda com ajustes." },
  { label: "Estrutura", emoji: "🟢", min: 75, max: 89, color: "text-success", ringColor: "hsl(var(--success))", bgColor: "bg-success", description: "Disciplina consistente e visão clara." },
  { label: "Estratégico", emoji: "🔵", min: 90, max: 100, color: "text-info", ringColor: "hsl(var(--info))", bgColor: "bg-info", description: "Tomada de decisão consciente e sustentável." },
];

export function getAtlasLevel(score: number): AtlasLevelDef {
  return ATLAS_LEVELS.find(l => score >= l.min && score <= l.max) || ATLAS_LEVELS[0];
}

export function getAtlasLevelIndex(score: number): number {
  return ATLAS_LEVELS.findIndex(l => score >= l.min && score <= l.max);
}

export interface AtlasScoreResult {
  score: number;
  label: AtlasLevel;
  color: string;
  ringColor: string;
  level: AtlasLevelDef;
  levelIndex: number;
  pillars: PillarResult[];
  driversUp: PillarResult[];
  driversDown: PillarResult[];
}

// ── Level requirements ──
export interface LevelRequirement {
  key: string;
  label: string;
  icon: string;
  target: string;
  met: boolean;
  progress: string; // e.g. "2.1 / 6 meses"
}

export function getNextLevelRequirements(
  score: number,
  pillars: PillarResult[],
  inputs: AtlasScoreInputs
): { nextLevel: AtlasLevelDef | null; requirements: LevelRequirement[] } {
  const idx = getAtlasLevelIndex(score);
  if (idx >= ATLAS_LEVELS.length - 1) return { nextLevel: null, requirements: [] };

  const next = ATLAS_LEVELS[idx + 1];
  const requirements: LevelRequirement[] = [];

  const reserva = pillars.find(p => p.key === "reserva");
  const meses = inputs.gastoMensalMedio3m > 0 ? inputs.reservaTotal / inputs.gastoMensalMedio3m : 0;
  const reservaTarget = next.min >= 75 ? 6 : next.min >= 60 ? 4 : next.min >= 40 ? 2 : 1;
  requirements.push({
    key: "reserva", label: "Reserva de emergência", icon: "🛡️",
    target: `≥ ${reservaTarget} meses`,
    met: meses >= reservaTarget,
    progress: `${meses.toFixed(1)} / ${reservaTarget} meses`,
  });

  const margem = inputs.totalReceitas > 0 ? ((inputs.totalReceitas - inputs.totalDespesas) / inputs.totalReceitas) * 100 : 0;
  const margemTarget = next.min >= 90 ? 20 : next.min >= 75 ? 15 : next.min >= 60 ? 10 : 5;
  requirements.push({
    key: "margem", label: "Margem financeira", icon: "💰",
    target: `≥ ${margemTarget}%`,
    met: margem >= margemTarget,
    progress: `${margem.toFixed(0)}% / ${margemTarget}%`,
  });

  const aporteTarget = next.min >= 75 ? 15 : next.min >= 60 ? 10 : 5;
  const aportePct = inputs.receitaMensalMedia > 0 ? (inputs.aporteMensalMedio3m / inputs.receitaMensalMedia) * 100 : 0;
  requirements.push({
    key: "aportes", label: "Aportes sobre renda", icon: "📈",
    target: `≥ ${aporteTarget}%`,
    met: aportePct >= aporteTarget,
    progress: `${aportePct.toFixed(0)}% / ${aporteTarget}%`,
  });

  if (next.min >= 75) {
    const classes = Object.values(inputs.alocacaoPorClasse);
    const pmax = classes.length > 0 ? Math.max(...classes) * 100 : 100;
    const pmaxTarget = next.min >= 90 ? 35 : 40;
    requirements.push({
      key: "diversificacao", label: "Concentração máxima", icon: "🎲",
      target: `≤ ${pmaxTarget}%`,
      met: pmax <= pmaxTarget,
      progress: `${pmax.toFixed(0)}% / ≤${pmaxTarget}%`,
    });
  }

  if (next.min >= 75) {
    const evolScore = pillars.find(p => p.key === "evolucao")?.score ?? 0;
    requirements.push({
      key: "evolucao", label: "Evolução patrimonial positiva", icon: "📈",
      target: "Crescimento 6m",
      met: evolScore >= 50,
      progress: evolScore >= 50 ? "Positiva" : "Insuficiente",
    });
  }

  return { nextLevel: next, requirements };
}

// ── Weight definitions ──
interface WeightDef { key: string; label: string; icon: string; w: number; wBiz: number }

const PILLAR_DEFS: WeightDef[] = [
  { key: "reserva",        label: "Reserva de Emergência",       icon: "🛡️", w: 0.20, wBiz: 0.20 },
  { key: "margem",         label: "Margem Financeira",           icon: "💰", w: 0.15, wBiz: 0.15 },
  { key: "disciplina",     label: "Disciplina de Controle",      icon: "📊", w: 0.10, wBiz: 0.10 },
  { key: "alocacao",       label: "Diversificação / Alocação",   icon: "🎲", w: 0.15, wBiz: 0.15 },
  { key: "aposentadoria",  label: "Aposentadoria / Futuro",      icon: "🏖️", w: 0.25, wBiz: 0.20 },
  { key: "evolucao",       label: "Evolução Patrimonial",        icon: "📈", w: 0.15, wBiz: 0.10 },
  { key: "empresa",        label: "Saúde da Empresa",            icon: "💼", w: 0.00, wBiz: 0.10 },
];

// ── Input types ──
export interface AtlasScoreInputs {
  reservaTotal: number;
  gastoMensalMedio3m: number;
  mesesDespesaDisp: number;
  totalReceitas: number;
  totalDespesas: number;
  diasComLancamento: number;
  diasPeriodo: number;
  pctComCategoria: number;
  alocacaoPorClasse: Record<string, number>;
  aposentModuloPreenchido: boolean;
  rendaProjetada: number;
  rendaObjetivo: number;
  aporteMensalMedio3m: number;
  receitaMensalMedia: number;
  plAtual: number;
  plBase: number;
  plBaseMonths: number;
  hasEmpresa: boolean;
  empresaReceita: number;
  empresaDespesa: number;
  empresaCaixa: number;
  empresaDespMensalMedia: number;
  empresaMesesComLucro: number;
}

// ── Pillar calculators ──

function calcReserva(inputs: AtlasScoreInputs) {
  if (inputs.gastoMensalMedio3m <= 0 || inputs.mesesDespesaDisp === 0) {
    return { score: 0, status: "sem_dados" as PillarStatus, inputsMap: {}, tip: "Registre despesas para calcular." };
  }
  const m = safeDiv(inputs.reservaTotal, inputs.gastoMensalMedio3m)!;
  const s = 100 * Math.pow(clip(m / 6, 0, 1), 0.7);
  return {
    score: Math.round(s), status: "ok" as PillarStatus,
    inputsMap: { reserva: inputs.reservaTotal, gastoMensal: inputs.gastoMensalMedio3m, mesesCobertura: +m.toFixed(1) },
    tip: m < 6 ? `Sua reserva cobre ${m.toFixed(1)} meses. Meta: 6 meses.` : "Reserva completa! Acima de 6 meses.",
  };
}

function calcMargem(inputs: AtlasScoreInputs) {
  if (inputs.totalReceitas <= 0) {
    return { score: 0, status: "sem_dados" as PillarStatus, inputsMap: {}, tip: "Registre receitas para calcular." };
  }
  const margem = (inputs.totalReceitas - inputs.totalDespesas) / inputs.totalReceitas;
  const s = 100 * Math.pow(clip(margem / 0.20, 0, 1), 0.8);
  return {
    score: Math.round(s), status: "ok" as PillarStatus,
    inputsMap: { receita: inputs.totalReceitas, despesa: inputs.totalDespesas, margemPct: +(margem * 100).toFixed(1) },
    tip: margem < 0.20 ? `Margem em ${(margem * 100).toFixed(0)}%. Meta: 20%+.` : "Margem saudável!",
  };
}

function calcDisciplina(inputs: AtlasScoreInputs) {
  if (inputs.diasPeriodo <= 0 || inputs.diasComLancamento === 0) {
    return { score: 0, status: "sem_dados" as PillarStatus, inputsMap: {}, tip: "Registre lançamentos para calcular." };
  }
  const c = clip(inputs.diasComLancamento / inputs.diasPeriodo, 0, 1);
  const r = clip(inputs.pctComCategoria, 0, 1);
  const s = 100 * (0.7 * c + 0.3 * r);
  return {
    score: Math.round(s), status: "ok" as PillarStatus,
    inputsMap: { diasRegistrados: inputs.diasComLancamento, diasTotal: inputs.diasPeriodo, pctCategoria: +(r * 100).toFixed(0) },
    tip: c < 0.7 ? "Registre lançamentos com mais frequência." : "Boa disciplina de registro!",
  };
}

function calcAlocacao(inputs: AtlasScoreInputs) {
  const classes = Object.values(inputs.alocacaoPorClasse);
  if (classes.length === 0) {
    return { score: 0, status: "sem_dados" as PillarStatus, inputsMap: {}, tip: "Cadastre investimentos para calcular." };
  }
  // Herfindahl index: H = Σ(peso²), where peso is fractional (0-1)
  const H = classes.reduce((sum, w) => sum + w * w, 0);
  // Diversification = 1 - H, normalized to 0-100
  // H=1 means 100% concentrated (score 0), H=1/n means perfectly diversified
  // Normalize: min H is 1/n (perfect), max H is 1 (single class)
  const nClasses = classes.filter(c => c > 0.01).length;
  const Hmin = nClasses > 0 ? 1 / nClasses : 1;
  // Normalized diversification: 0 when H=1, 100 when H=Hmin
  const diversification = Hmin < 1 ? clip((1 - H) / (1 - Hmin), 0, 1) : 0;
  const s = Math.round(diversification * 100);
  const pmax = Math.max(...classes);
  return {
    score: s, status: "ok" as PillarStatus,
    inputsMap: { herfindahl: +(H * 100).toFixed(1), diversificacao: +((1 - H) * 100).toFixed(1), maiorConcentracao: +(pmax * 100).toFixed(0), numClasses: nClasses },
    tip: s < 40 ? `Índice Herfindahl alto (${(H * 100).toFixed(0)}%). Diversifique entre mais classes.` : s < 70 ? `Diversificação moderada (H=${(H * 100).toFixed(0)}%). Continue diversificando.` : "Boa diversificação entre classes de ativos!",
  };
}

function calcAposentadoria(inputs: AtlasScoreInputs) {
  if (inputs.aposentModuloPreenchido && inputs.rendaObjetivo > 0) {
    const ratio = safeDiv(inputs.rendaProjetada, inputs.rendaObjetivo);
    if (ratio !== null) {
      const s = 100 * Math.pow(clip(ratio, 0, 1), 0.7);
      return {
        score: Math.round(s), status: "ok" as PillarStatus,
        inputsMap: { rendaProjetada: inputs.rendaProjetada, rendaObjetivo: inputs.rendaObjetivo, ratio: +(ratio * 100).toFixed(0) },
        tip: ratio < 1 ? `Renda projetada cobre ${(ratio * 100).toFixed(0)}% da meta.` : "Meta de aposentadoria alinhada!",
      };
    }
  }
  if (inputs.receitaMensalMedia <= 0) {
    return { score: 0, status: "sem_dados" as PillarStatus, inputsMap: {}, tip: "Registre receitas para calcular." };
  }
  const iStar = inputs.receitaMensalMedia * 0.15;
  const ratio = safeDiv(inputs.aporteMensalMedio3m, iStar);
  if (ratio === null) {
    return { score: 0, status: "sem_dados" as PillarStatus, inputsMap: {}, tip: "Registre aportes para calcular." };
  }
  const s = 100 * Math.pow(clip(ratio, 0, 1), 0.9);
  return {
    score: Math.round(s), status: "ok" as PillarStatus,
    inputsMap: { aporteMensal: inputs.aporteMensalMedio3m, metaSugerida: +iStar.toFixed(0), ratio: +(ratio * 100).toFixed(0) },
    tip: ratio < 1 ? `Investindo ${(ratio * 100).toFixed(0)}% do ideal (15% da receita).` : "Aportes acima do ideal!",
  };
}

function calcEvolucao(inputs: AtlasScoreInputs) {
  if (inputs.plBase <= 0 || inputs.plBaseMonths === 0) {
    return { score: 0, status: "sem_dados" as PillarStatus, inputsMap: {}, tip: "Dados patrimoniais insuficientes." };
  }
  const g = (inputs.plAtual - inputs.plBase) / inputs.plBase;
  const divisor = inputs.plBaseMonths >= 6 ? 0.15 : 0.08;
  const s = 100 * Math.pow(clip(g / divisor, 0, 1), 0.8);
  return {
    score: Math.round(s), status: "ok" as PillarStatus,
    inputsMap: { plAtual: inputs.plAtual, plBase: inputs.plBase, crescimentoPct: +(g * 100).toFixed(1), periodoMeses: inputs.plBaseMonths },
    tip: g < 0 ? "Patrimônio em queda. Revise suas estratégias." : g < divisor ? `Crescimento de ${(g * 100).toFixed(1)}%. Meta: ${(divisor * 100).toFixed(0)}%.` : "Excelente evolução patrimonial!",
  };
}

function calcEmpresa(inputs: AtlasScoreInputs) {
  if (!inputs.hasEmpresa || inputs.empresaReceita <= 0) {
    return { score: 0, status: "sem_dados" as PillarStatus, inputsMap: {}, tip: "Sem dados de empresa no período." };
  }
  const mb = (inputs.empresaReceita - inputs.empresaDespesa) / inputs.empresaReceita;
  const k = inputs.empresaDespMensalMedia > 0 ? inputs.empresaCaixa / inputs.empresaDespMensalMedia : 0;
  const consist = clip(inputs.empresaMesesComLucro, 0, 1);
  const fMb = Math.pow(clip(mb / 0.20, 0, 1), 0.8);
  const fK = Math.pow(clip(k / 3, 0, 1), 0.8);
  const s = 100 * (0.5 * fMb + 0.3 * fK + 0.2 * consist);
  return {
    score: Math.round(s), status: "ok" as PillarStatus,
    inputsMap: { margemEmpresa: +(mb * 100).toFixed(1), mesesCaixa: +k.toFixed(1), consistencia: +(consist * 100).toFixed(0) },
    tip: mb < 0.20 ? `Margem empresarial em ${(mb * 100).toFixed(0)}%. Meta: 20%.` : "Empresa com margem saudável!",
  };
}

// ── Pillar formulas descriptions ──
const FORMULAS: Record<string, string> = {
  reserva: "S = 100 × (meses_reserva / 6)^0.7",
  margem: "S = 100 × (margem% / 20%)^0.8",
  disciplina: "S = 100 × (0.7×frequência + 0.3×categorização)",
  alocacao: "H = Σ(peso²); S = 100 × (1−H)/(1−1/n) [Herfindahl normalizado]",
  aposentadoria: "S = 100 × (aporte / meta_15%)^0.9",
  evolucao: "S = 100 × (crescimento / meta)^0.8",
  empresa: "S = 100 × (0.5×margem + 0.3×caixa + 0.2×consistência)",
};

// ── Main computation ──
const CALCULATORS: Record<string, (i: AtlasScoreInputs) => { score: number; status: PillarStatus; inputsMap: Record<string, any>; tip: string }> = {
  reserva: calcReserva, margem: calcMargem, disciplina: calcDisciplina,
  alocacao: calcAlocacao, aposentadoria: calcAposentadoria, evolucao: calcEvolucao, empresa: calcEmpresa,
};

export function computeAtlasScore(inputs: AtlasScoreInputs): AtlasScoreResult {
  const hasEmpresa = inputs.hasEmpresa;

  const rawPillars = PILLAR_DEFS
    .filter(d => d.key !== "empresa" || hasEmpresa)
    .map(d => {
      const calc = CALCULATORS[d.key](inputs);
      const baseWeight = hasEmpresa ? d.wBiz : d.w;
      return {
        key: d.key, label: d.label, icon: d.icon,
        score: calc.score, baseWeight, status: calc.status,
        inputs: calc.inputsMap, tip: calc.tip, formula: FORMULAS[d.key] || "",
      };
    });

  const validPillars = rawPillars.filter(p => p.status === "ok");
  const totalValidWeight = validPillars.reduce((s, p) => s + p.baseWeight, 0);

  const pillars: PillarResult[] = rawPillars.map(p => {
    let effectiveWeight = 0;
    if (p.status === "ok" && totalValidWeight > 0) {
      effectiveWeight = p.baseWeight / totalValidWeight;
    }
    const contribution = effectiveWeight * p.score;
    return { ...p, weight: effectiveWeight, contribution };
  });

  const score = validPillars.length > 0
    ? Math.round(pillars.reduce((s, p) => s + p.contribution, 0))
    : 0;
  const clampedScore = clip(score, 0, 100);

  const level = getAtlasLevel(clampedScore);
  const levelIndex = getAtlasLevelIndex(clampedScore);

  const okPillars = pillars.filter(p => p.status === "ok").sort((a, b) => b.contribution - a.contribution);
  const driversUp = okPillars.slice(0, 2);
  const driversDown = [...okPillars].sort((a, b) => a.contribution - b.contribution).slice(0, 2);

  return {
    score: clampedScore,
    label: level.label,
    color: level.color,
    ringColor: level.ringColor,
    level,
    levelIndex,
    pillars,
    driversUp,
    driversDown,
  };
}

// ── Next level helper (legacy compat) ──
export function getNextLevel(score: number): { label: string; pointsNeeded: number } | null {
  const idx = getAtlasLevelIndex(score);
  if (idx >= ATLAS_LEVELS.length - 1) return null;
  const next = ATLAS_LEVELS[idx + 1];
  return { label: next.label, pointsNeeded: next.min - score };
}
