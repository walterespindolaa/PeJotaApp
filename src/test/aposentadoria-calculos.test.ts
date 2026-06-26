import { describe, it, expect } from "vitest";
import { FV, PV, PMT } from "@/lib/financial";

describe("Aposentadoria — fórmulas idênticas à planilha", () => {
  const monthlyRate = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;

  // Reference case: E10=30, E11=60, E12=90, L8=10%, L9=5%
  const L8 = 0.10;
  const L9 = 0.05;
  const L10 = ((1 + L8) / (1 + L9)) - 1; // taxa real anual
  const L11 = monthlyRate(L10); // taxa real mensal ~0.003891

  const E10 = 30, E11 = 60, E12 = 90;
  const nperAcum = (E11 - E10) * 12; // 360
  const nperApos = (E12 - E11) * 12; // 360

  it("taxa real mensal ~0.39%", () => {
    expect(L11).toBeCloseTo(0.003891, 4);
  });

  // ─── Caso A: sem bens (incluirBens=false) ───
  describe("Caso A: gap=10000, patrimonio=40000 (sem bens)", () => {
    const E17 = 15000; // rendaDesejada
    const rendaPassivaAtual = 5000;
    const rendaPassivaBens = 5000; // existe mas toggle OFF
    const incluirBens = false;
    const rendaPassivaTotal = rendaPassivaAtual + (incluirBens ? rendaPassivaBens : 0);
    const gap = Math.max(0, E17 - rendaPassivaTotal); // 10000
    const E18 = 40000; // patrimonioFinanceiro

    it("rendaPassivaTotal = 5000 (bens ignorados)", () => {
      expect(rendaPassivaTotal).toBe(5000);
    });

    it("gap = 10000", () => {
      expect(gap).toBe(10000);
    });

    it("L23 (Viver de Renda) ≈ 2.564.102", () => {
      const L23 = gap / L11;
      expect(L23).toBeGreaterThan(2_550_000);
      expect(L23).toBeLessThan(2_580_000);
    });

    it("Independência = E18/L23 ≈ 1.56%", () => {
      const L23 = gap / L11;
      const pct = (E18 / L23) * 100;
      expect(pct).toBeGreaterThan(1.4);
      expect(pct).toBeLessThan(1.7);
    });

    it("Consumo H23 = -PV(L11, 360, gap, 0)", () => {
      const H23 = -PV(L11, nperApos, gap, 0);
      expect(H23).toBeGreaterThan(1_900_000);
      expect(H23).toBeLessThan(2_000_000);
    });

    it("Poupança Viver de Renda = -PMT(L11, 360, -E18, L23)", () => {
      const L23 = gap / L11;
      const poup = -PMT(L11, nperAcum, -E18, L23);
      expect(poup).toBeGreaterThan(2800);
      expect(poup).toBeLessThan(3300);
    });

    it("Poupança Consumo = -PMT(L11, 360, -E18, H23)", () => {
      const H23 = -PV(L11, nperApos, gap, 0);
      const poup = -PMT(L11, nperAcum, -E18, H23);
      expect(poup).toBeGreaterThan(2000);
      expect(poup).toBeLessThan(2500);
    });
  });

  // ─── Caso B: com bens (incluirBens=true) ───
  describe("Caso B: gap=5000, patrimonio=540000 (com bens)", () => {
    const E17 = 15000;
    const rendaPassivaAtual = 5000;
    const rendaPassivaBens = 5000;
    const incluirBens = true;
    const rendaPassivaTotal = rendaPassivaAtual + (incluirBens ? rendaPassivaBens : 0);
    const gap = Math.max(0, E17 - rendaPassivaTotal); // 5000
    const E18 = 540000; // patrimônio financeiro + bens

    it("rendaPassivaTotal = 10000 (bens incluídos)", () => {
      expect(rendaPassivaTotal).toBe(10000);
    });

    it("gap = 5000", () => {
      expect(gap).toBe(5000);
    });

    it("L23 ≈ 1.282.051 (metade do Caso A)", () => {
      const L23 = gap / L11;
      expect(L23).toBeGreaterThan(1_275_000);
      expect(L23).toBeLessThan(1_290_000);
    });

    it("Independência ≈ 42%", () => {
      const L23 = gap / L11;
      const pct = (E18 / L23) * 100;
      expect(pct).toBeGreaterThan(41);
      expect(pct).toBeLessThan(43);
    });
  });

  // ─── Consumo line reaches ~0 at expectativaVida ───
  it("Consumo line reaches ~0 at expectativa_vida", () => {
    const gap = 10000;
    const H23 = -PV(L11, nperApos, gap, 0);
    const finalConsumo = FV(L11, nperApos, gap, -H23);
    expect(Math.abs(finalConsumo)).toBeLessThan(1);
  });

  // ─── Viver de Renda stays ~stable post-retirement ───
  it("Viver de Renda stays approximately stable post-retirement", () => {
    const gap = 10000;
    const L23 = gap / L11;
    // After 360 months of withdrawing gap, balance should stay ~L23
    const final = FV(L11, nperApos, gap, -L23);
    // Should be very close to L23 (perpetuity definition)
    expect(Math.abs(final - L23)).toBeLessThan(1);
  });

  // ─── Chart: all 3 series withdraw gapMensal post-retirement ───
  it("Chart: Realidade also withdraws gapMensal post-retirement", () => {
    const E18 = 40000, gap = 10000, poupMensal = 2000;
    const startReal = FV(L11, nperAcum, -poupMensal, -E18);
    // After 10 years of withdrawals
    const t = 120;
    const real10 = FV(L11, t, gap, -startReal);
    // Should be less than startReal because of withdrawals
    expect(real10).toBeLessThan(startReal);
  });

  // ─── Chart series are different ───
  it("Chart: Consumo and Viver de Renda produce different series post-retirement", () => {
    const E18 = 40000, gap = 10000;
    const L23 = gap / L11;
    const H23 = -PV(L11, nperApos, gap, 0);
    const poupConsumo = -PMT(L11, nperAcum, -E18, H23);
    const poupViver = -PMT(L11, nperAcum, -E18, L23);

    // At retirement
    const startCons = FV(L11, nperAcum, -Math.max(0, poupConsumo), -E18);
    const startViver = FV(L11, nperAcum, -Math.max(0, poupViver), -E18);

    // 10 years post-retirement
    const t = 120;
    const cons10 = FV(L11, t, gap, -startCons);
    const viver10 = FV(L11, t, gap, -startViver);

    // They must be different
    expect(Math.abs(cons10 - viver10)).toBeGreaterThan(10000);
    // Consumo should decrease
    expect(cons10).toBeLessThan(startCons);
  });

  // ─── Chart: Consumo series is not empty ───
  it("Chart: Consumo series has positive values during accumulation", () => {
    const E18 = 40000, gap = 10000;
    const H23 = -PV(L11, nperApos, gap, 0);
    const poupConsumo = Math.max(0, -PMT(L11, nperAcum, -E18, H23));
    // Mid-accumulation (15 years in)
    const midValue = FV(L11, 180, -poupConsumo, -E18);
    expect(midValue).toBeGreaterThan(0);
  });

  // ─── Gap=0 edge case ───
  it("renda passiva >= renda desejada → gap=0, montantes=0", () => {
    const gapZero = Math.max(0, 5000 - 6000);
    expect(gapZero).toBe(0);
  });
});
