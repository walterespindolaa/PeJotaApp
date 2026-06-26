import { describe, it, expect } from "vitest";

/**
 * Testes de validação das fórmulas do Organiza 2026
 * Simulam os cálculos sem depender do hook/banco
 */

// Helpers que replicam a lógica do useOrganiza
const calcSaldoPrevisto = (
  receitaPrevista: number,
  despesasPrevistas: number,
  parcelas: number,
  dividas: number,
  economiasPlanejadas: number
) => receitaPrevista - despesasPrevistas - parcelas - dividas - economiasPlanejadas;

const calcSaldoReal = (
  receitaRecebida: number,
  despesasPagas: number,
  parcelas: number,
  dividas: number,
  economiasRealizadas: number
) => receitaRecebida - despesasPagas - parcelas - dividas - economiasRealizadas;

const calcTaxaPoupanca = (economias: number, receita: number) =>
  receita > 0 ? (economias / receita) * 100 : 0;

const calcGrauCompromisso = (
  despesas: number,
  parcelas: number,
  dividas: number,
  economias: number,
  receita: number
) => receita > 0 ? ((despesas + parcelas + dividas + economias) / receita) * 100 : 0;

// Simula getParcelaForMonth
const getParcelaForMonth = (
  parcelaAtualOriginal: number,
  totalParcelas: number,
  valorParcela: number,
  startMesAno: string,
  targetMesAno: string
): number | null => {
  const [startY, startM] = startMesAno.split("-").map(Number);
  const [targetY, targetM] = targetMesAno.split("-").map(Number);
  const monthOffset = (targetY - startY) * 12 + (targetM - startM);
  const parcelaNestesMes = parcelaAtualOriginal + monthOffset;
  if (parcelaNestesMes < 1 || parcelaNestesMes > totalParcelas) return null;
  return valorParcela;
};

describe("Cenário A — Receita 28k, Despesas 9.620, nenhuma paga", () => {
  const receitaPrevista = 28000;
  const receitaRecebida = 15000;
  const despesasPrevistas = 9620;
  const despesasPagas = 0; // nenhuma paga
  const parcelas = 0;
  const dividas = 0;
  // 10% do salário como economia planejada
  const economiasPlanejadas = receitaPrevista * 0.10; // 2800
  const economiasRealizadas = 0; // nada separado ainda

  it("Saldo Previsto = 28000 - 9620 - 0 - 0 - 2800 = 15580", () => {
    const saldoPrev = calcSaldoPrevisto(receitaPrevista, despesasPrevistas, parcelas, dividas, economiasPlanejadas);
    expect(saldoPrev).toBe(15580);
  });

  it("Saldo Real = 15000 - 0 - 0 - 0 - 0 = 15000 (nada pago)", () => {
    const saldoReal = calcSaldoReal(receitaRecebida, despesasPagas, parcelas, dividas, economiasRealizadas);
    expect(saldoReal).toBe(15000);
  });

  it("Taxa Poupança Prevista = 2800/28000 = 10%", () => {
    expect(calcTaxaPoupanca(economiasPlanejadas, receitaPrevista)).toBe(10);
  });

  it("Taxa Poupança Real = 0% (nada separado)", () => {
    expect(calcTaxaPoupanca(economiasRealizadas, receitaRecebida)).toBe(0);
  });

  it("Grau Compromisso Previsto = (9620+0+0+2800)/28000 ≈ 44.36%", () => {
    const gc = calcGrauCompromisso(despesasPrevistas, parcelas, dividas, economiasPlanejadas, receitaPrevista);
    expect(gc).toBeCloseTo(44.36, 1);
  });

  it("Grau Compromisso Real = 0% (nada pago, nada separado)", () => {
    const gc = calcGrauCompromisso(despesasPagas, parcelas, dividas, economiasRealizadas, receitaRecebida);
    expect(gc).toBe(0);
  });
});

describe("Cenário B — Parcela iPhone 12x de 833.33 começando março", () => {
  const valorParcela = 10000 / 12; // ≈833.33
  const startMes = "2026-03";

  it("Fevereiro: parcela = null (antes do início)", () => {
    expect(getParcelaForMonth(1, 12, valorParcela, startMes, "2026-02")).toBeNull();
  });

  it("Março: parcela = 833.33", () => {
    expect(getParcelaForMonth(1, 12, valorParcela, startMes, "2026-03")).toBeCloseTo(833.33, 1);
  });

  it("Abril: parcela = 833.33", () => {
    expect(getParcelaForMonth(1, 12, valorParcela, startMes, "2026-04")).toBeCloseTo(833.33, 1);
  });

  it("Fevereiro 2027 (mês 12): parcela = 833.33", () => {
    expect(getParcelaForMonth(1, 12, valorParcela, startMes, "2027-02")).toBeCloseTo(833.33, 1);
  });

  it("Março 2027 (mês 13): parcela = null (acabou)", () => {
    expect(getParcelaForMonth(1, 12, valorParcela, startMes, "2027-03")).toBeNull();
  });

  it("Aparece em todos os 12 meses", () => {
    let count = 0;
    for (let i = 0; i < 24; i++) {
      const m = ((3 - 1 + i) % 12) + 1;
      const y = 2026 + Math.floor((3 - 1 + i) / 12);
      const target = `${y}-${String(m).padStart(2, "0")}`;
      if (getParcelaForMonth(1, 12, valorParcela, startMes, target) !== null) count++;
    }
    expect(count).toBe(12);
  });
});

describe("Cenário C — Despesa atrasada não entra no Real até ser paga", () => {
  it("Despesa pendente/atrasada não entra em despesasPagas", () => {
    const despesas = [
      { valor: 500, status: "a_pagar" },
      { valor: 300, status: "em_atraso" },
      { valor: 200, status: "pago" },
    ];
    const pagas = despesas.filter(d => d.status === "pago").reduce((s, d) => s + d.valor, 0);
    expect(pagas).toBe(200);
  });

  it("Saldo Real só desconta despesas pagas", () => {
    const recebido = 10000;
    const pagas = 200;
    const saldoReal = calcSaldoReal(recebido, pagas, 0, 0, 0);
    expect(saldoReal).toBe(9800);
  });

  it("Saldo Previsto desconta todas as despesas", () => {
    const prevista = 10000;
    const totalDesp = 500 + 300 + 200; // todas
    const saldoPrev = calcSaldoPrevisto(prevista, totalDesp, 0, 0, 0);
    expect(saldoPrev).toBe(9000);
  });
});

describe("Separação Parcelas vs Dívidas", () => {
  it("tipo_parcelamento 'compra_parcelada' vai para parcelas, não dívidas", () => {
    const items = [
      { tipo_parcelamento: "compra_parcelada", is_parcelada: true, valor: 500 },
      { tipo_parcelamento: "divida", is_parcelada: true, valor: 1000 },
      { tipo_parcelamento: "compra_parcelada", is_parcelada: true, valor: 300 },
    ];
    const parcelas = items.filter(d => d.is_parcelada && d.tipo_parcelamento !== "divida");
    const dividas = items.filter(d => d.is_parcelada && d.tipo_parcelamento === "divida");
    expect(parcelas.reduce((s, d) => s + d.valor, 0)).toBe(800);
    expect(dividas.reduce((s, d) => s + d.valor, 0)).toBe(1000);
  });
});
