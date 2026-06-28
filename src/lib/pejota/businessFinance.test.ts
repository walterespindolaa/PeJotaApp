import { describe, it, expect } from "vitest";
import {
  resumoMes, saldoCaixa, dreDoMes, projetadoVsRealizado,
  totalFolhaColaborador, totaisReceberPagar, statusVencimento, round2,
  type Tx, type Categoria, type BudgetRow, type Bill,
} from "./businessFinance";

const cats: Categoria[] = [
  { id: "r", grupo: "Receita" }, { id: "d", grupo: "Deduções" },
  { id: "cf", grupo: "Custos Fixos" }, { id: "fo", grupo: "Folha" }, { id: "di", grupo: "Dispensável" },
];
const txs: Tx[] = [
  { date: "2026-05-03", amount: 10000, direction: "in", category_id: "r" },
  { date: "2026-05-10", amount: 2000, direction: "in", category_id: "r" },
  { date: "2026-05-12", amount: 1500, direction: "out", category_id: "d" },
  { date: "2026-05-15", amount: 3000, direction: "out", category_id: "cf" },
  { date: "2026-05-20", amount: 2500, direction: "out", category_id: "fo" },
  { date: "2026-05-25", amount: 1000, direction: "out", category_id: "di" },
  { date: "2026-04-30", amount: 9999, direction: "in", category_id: "r" },
];

describe("resumoMes", () => {
  it("soma receita/despesa/resultado/margem do mês", () => {
    expect(resumoMes(txs, "2026-05")).toEqual({ receita: 12000, despesa: 8000, resultado: 4000, margem: 4000 / 12000 });
  });
});

describe("saldoCaixa", () => {
  it("acumulado total", () => expect(saldoCaixa(txs)).toBe(13999));
  it("acumulado até data", () => expect(saldoCaixa(txs, "2026-04-30")).toBe(9999));
});

describe("dreDoMes", () => {
  const dre = dreDoMes(txs, cats, "2026-05");
  it("receita bruta", () => expect(dre.receitaBruta).toBe(12000));
  it("deduções", () => expect(dre.deducoes).toBe(1500));
  it("receita líquida", () => expect(dre.receitaLiquida).toBe(10500));
  it("lucro líquido", () => expect(dre.lucroLiquido).toBe(4000));
});

describe("projetadoVsRealizado", () => {
  it("realizado de saída é negativo e diff = real - proj", () => {
    const budget: BudgetRow[] = [{ ref_month: "2026-05-01", category_id: "cf", grupo: "Custos Fixos", projected: 2500 }];
    const pr = projetadoVsRealizado(budget, txs, "2026-05").find((r) => r.category_id === "cf");
    expect(pr).toEqual({ category_id: "cf", projected: 2500, realized: -3000, diff: -5500 });
  });
});

describe("totalFolhaColaborador", () => {
  it("piso vence quando maior", () => expect(totalFolhaColaborador(1000, 200, 2000)).toBe(2000));
  it("base+comissão vence quando maior", () => expect(totalFolhaColaborador(3000, 500, 2000)).toBe(3500));
});

describe("totaisReceberPagar", () => {
  it("só conta pendentes", () => {
    const bills: Bill[] = [
      { kind: "receber", amount: 5000, status: "pendente" },
      { kind: "receber", amount: 1000, status: "liquidado" },
      { kind: "pagar", amount: 2000, status: "pendente" },
    ];
    expect(totaisReceberPagar(bills)).toEqual({ aReceber: 5000, aPagar: 2000, saldoPrevisto: 3000 });
  });
});

describe("statusVencimento", () => {
  it("atrasado / hoje / liquidado", () => {
    expect(statusVencimento("2026-06-01", "pendente", "2026-06-28")).toBe("atrasado");
    expect(statusVencimento("2026-06-28", "pendente", "2026-06-28")).toBe("vence_hoje");
    expect(statusVencimento("2026-06-01", "liquidado", "2026-06-28")).toBe("liquidado");
  });
});
