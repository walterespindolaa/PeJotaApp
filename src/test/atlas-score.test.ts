import { describe, it, expect } from "vitest";
import { computeAtlasScore, getAtlasLevel, type AtlasScoreInputs } from "@/lib/atlasScore";

/**
 * Testes do motor de cálculo do PeJota Score (src/lib/atlasScore.ts).
 * Cobre: 0 dados, dados máximos, valores negativos, e um caso realista
 * com score calculado à mão (pesos × score de cada pilar).
 */

// Input "vazio" — todos os pilares caem em "sem_dados".
const zeroInputs = (): AtlasScoreInputs => ({
  reservaTotal: 0,
  gastoMensalMedio3m: 0,
  mesesDespesaDisp: 0,
  totalReceitas: 0,
  totalDespesas: 0,
  diasComLancamento: 0,
  diasPeriodo: 0,
  pctComCategoria: 0,
  alocacaoPorClasse: {},
  aposentModuloPreenchido: false,
  rendaProjetada: 0,
  rendaObjetivo: 0,
  aporteMensalMedio3m: 0,
  receitaMensalMedia: 0,
  plAtual: 0,
  plBase: 0,
  plBaseMonths: 0,
  hasEmpresa: false,
  empresaReceita: 0,
  empresaDespesa: 0,
  empresaCaixa: 0,
  empresaDespMensalMedia: 0,
  empresaMesesComLucro: 0,
});

describe("PeJota Score — casos de borda", () => {
  it("0 dados → score 0, nível Sobrevivência, todos pilares sem_dados", () => {
    const r = computeAtlasScore(zeroInputs());
    expect(r.score).toBe(0);
    expect(r.label).toBe("Sobrevivência");
    expect(r.levelIndex).toBe(0);
    // Nenhum pilar válido → peso efetivo 0 em todos
    expect(r.pillars.every(p => p.status === "sem_dados")).toBe(true);
    expect(r.pillars.every(p => p.weight === 0)).toBe(true);
    expect(r.driversUp).toHaveLength(0);
    expect(r.driversDown).toHaveLength(0);
  });

  it("dados máximos → score 100, nível Estratégico", () => {
    const r = computeAtlasScore({
      ...zeroInputs(),
      reservaTotal: 60000, gastoMensalMedio3m: 10000, mesesDespesaDisp: 6, // m=6 → S=100
      totalReceitas: 10000, totalDespesas: 8000,                            // margem 20% → S=100
      diasComLancamento: 30, diasPeriodo: 30, pctComCategoria: 1,           // disciplina → S=100
      alocacaoPorClasse: { a: 0.5, b: 0.5 },                                // Herfindahl mínimo → S=100
      aposentModuloPreenchido: true, rendaObjetivo: 5000, rendaProjetada: 5000, // ratio 1 → S=100
      plAtual: 11500, plBase: 10000, plBaseMonths: 6,                       // g=15% = meta → S=100
    });
    expect(r.score).toBe(100);
    expect(r.label).toBe("Estratégico");
    expect(r.levelIndex).toBe(4);
  });

  it("valores negativos (despesas > receitas, patrimônio em queda) não quebram e dão score válido", () => {
    const r = computeAtlasScore({
      ...zeroInputs(),
      reservaTotal: 30000, gastoMensalMedio3m: 10000, mesesDespesaDisp: 3, // reserva ok
      totalReceitas: 5000, totalDespesas: 8000,                            // margem negativa → clip 0
      plAtual: 8000, plBase: 10000, plBaseMonths: 6,                       // evolução negativa → clip 0
    });
    expect(Number.isFinite(r.score)).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.pillars.find(p => p.key === "margem")?.score).toBe(0);
    expect(r.pillars.find(p => p.key === "evolucao")?.score).toBe(0);
  });
});

describe("PeJota Score — caso realista (verificado à mão)", () => {
  // Pilares (sem empresa, pesos base somam 1.0):
  //   reserva 0.20, margem 0.15, disciplina 0.10, alocação 0.15, aposentadoria 0.25, evolução 0.15
  // Scores esperados:
  //   reserva:      m=3  → 100·(0.5)^0.7 = 61.56 → 62
  //   margem:       10%  → 100·(0.5)^0.8 = 57.43 → 57
  //   disciplina:   c=0.7,r=1 → 100·(0.7·0.7+0.3) = 79
  //   alocação:     50/50 → 100
  //   aposentadoria ratio=1 → 100
  //   evolução      g=15% = meta → 100
  // Score = 0.20·62 + 0.15·57 + 0.10·79 + 0.15·100 + 0.25·100 + 0.15·100
  //       = 12.4 + 8.55 + 7.9 + 15 + 25 + 15 = 83.85 → 84
  const inputs: AtlasScoreInputs = {
    ...zeroInputs(),
    reservaTotal: 30000, gastoMensalMedio3m: 10000, mesesDespesaDisp: 3,
    totalReceitas: 10000, totalDespesas: 9000,
    diasComLancamento: 21, diasPeriodo: 30, pctComCategoria: 1,
    alocacaoPorClasse: { a: 0.5, b: 0.5 },
    aposentModuloPreenchido: true, rendaObjetivo: 5000, rendaProjetada: 5000,
    plAtual: 11500, plBase: 10000, plBaseMonths: 6,
  };

  it("scores individuais dos pilares batem com o cálculo manual", () => {
    const r = computeAtlasScore(inputs);
    expect(r.pillars.find(p => p.key === "reserva")?.score).toBe(62);
    expect(r.pillars.find(p => p.key === "margem")?.score).toBe(57);
    expect(r.pillars.find(p => p.key === "disciplina")?.score).toBe(79);
    expect(r.pillars.find(p => p.key === "alocacao")?.score).toBe(100);
    expect(r.pillars.find(p => p.key === "aposentadoria")?.score).toBe(100);
    expect(r.pillars.find(p => p.key === "evolucao")?.score).toBe(100);
  });

  it("score final = 84, nível Estrutura", () => {
    const r = computeAtlasScore(inputs);
    expect(r.score).toBe(84);
    expect(r.label).toBe("Estrutura");
    expect(getAtlasLevel(84).label).toBe("Estrutura");
  });
});
