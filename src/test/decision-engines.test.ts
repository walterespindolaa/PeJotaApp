import { describe, it, expect } from "vitest";
import type { DecisionContext } from "@/lib/financial_engine/decision_engine/types";
import { calcularComprarImovel } from "@/lib/financial_engine/decision_engine/comprar_imovel";
import { calcularTrocarCarro } from "@/lib/financial_engine/decision_engine/trocar_carro";
import { calcularAumentoPadrao } from "@/lib/financial_engine/decision_engine/aumento_padrao";
import { calcularViagem } from "@/lib/financial_engine/decision_engine/viagem";
import { calcularNovoFilho } from "@/lib/financial_engine/decision_engine/novo_filho";
import { calcularAbrirNegocio } from "@/lib/financial_engine/decision_engine/abrir_negocio";
import { calcularReducaoRenda } from "@/lib/financial_engine/decision_engine/reducao_renda";
import { calcularAnteciparAposentadoria } from "@/lib/financial_engine/decision_engine/antecipar_aposentadoria";

/**
 * Testes dos 8 motores de decisão (src/lib/financial_engine/decision_engine/).
 * Foco na correção das fórmulas (PMT, FV-anuidade/juros compostos, depreciação).
 *
 * Constantes de juros compostos usadas (verificáveis):
 *   1.01^12 = 1.1268250301   → FV-anuidade(1000, 1%, 12) = 1000·(1.01^12−1)/0.01 = 12682.5030
 *   1.01^60 = 1.8166696990
 * Taxa segura de retirada (regra 4%) = 0.04. retornoMensal = ctx.taxaRealMensal (1%/mês).
 */

const baseCtx = (over: Partial<DecisionContext> = {}): DecisionContext => ({
  reservaAtual: 50000,
  despesasMensais: 3000,
  patrimonioAtual: 100000,
  poupancaMensal: 2000,
  rendaTotal: 5000,
  taxaRealMensal: 0.01, // 1% a.m. → mantém os juros compostos verificáveis à mão
  ...over,
});

// FV-anuidade(1000, 1%, 12) − 1000·12 = 12682.5030 − 12000 = 682.5030
const FVANN_1000_1PCT_12 = 682.5030;

describe("Motor: aumento_padrao (FV-anuidade / juros compostos)", () => {
  it("aumento 1000/mês por 12m a 1% a.m. → custo de oportunidade ≈ 682.50", () => {
    const r = calcularAumentoPadrao(1000, 12, baseCtx());
    expect(r.impactoMensal).toBe(-1000);
    expect(r.impactoTotal).toBe(-12000); // impacto linear = 1000 × 12
    expect(r.custoOportunidade).toBeCloseTo(FVANN_1000_1PCT_12, 1);
    expect(r.capitalPotencialPerdido).toBeCloseTo(FVANN_1000_1PCT_12, 1);
    expect(r.impactoPatrimonio).toBeCloseTo(-FVANN_1000_1PCT_12, 1);
    // renda passiva perdida = custoOp × 4% / 12
    expect(r.rendaPassivaPerdida).toBeCloseTo((FVANN_1000_1PCT_12 * 0.04) / 12, 2);
  });
});

describe("Motor: novo_filho (FV-anuidade / juros compostos)", () => {
  it("custo 1000/mês por 12m a 1% a.m. → mesmo padrão do aumento de padrão", () => {
    const r = calcularNovoFilho(1000, 12, baseCtx());
    expect(r.impactoMensal).toBe(-1000);
    expect(r.impactoTotal).toBe(-12000);
    expect(r.custoOportunidade).toBeCloseTo(FVANN_1000_1PCT_12, 1);
    expect(r.impactoReserva).toBe(0); // não toca reserva
  });
});

describe("Motor: viagem (FV de montante único + parcelamento)", () => {
  it("parcelada em 12m (sem juros) → parcela = valor/12; custoOp sobre horizonte 60m", () => {
    const r = calcularViagem(12000, 12, baseCtx());
    // Parcelado ≤12m sem juros: 12000/12 = 1000/mês
    expect(r.impactoMensal).toBe(-1000);
    expect(r.impactoTotal).toBe(-12000);
    expect(r.impactoReserva).toBe(0); // parcelado não sai da reserva
    // horizonte = max(12, 60) = 60 → custoOp = 12000·(1.01^60 − 1) = 9800.04
    expect(r.custoOportunidade).toBeCloseTo(9800.04, 0);
  });

  it("à vista (prazo=1) → sai da reserva, sem parcela", () => {
    const r = calcularViagem(10000, 1, baseCtx({ reservaAtual: 20000 }));
    expect(r.impactoMensal).toBeCloseTo(0, 10); // à vista → sem parcela (evita comparação -0/+0)
    expect(r.impactoReserva).toBe(-10000); // reserva 20000 → 10000
  });
});

describe("Motor: reducao_renda (poupança perdida + déficit)", () => {
  it("redução 1000/mês com saldo ainda positivo → custoOp da poupança perdida ≈ 682.50", () => {
    // renda 5000 − 1000 = 4000; despesas 3000 → déficit +1000 (sem consumo de reserva)
    const r = calcularReducaoRenda(1000, 12, baseCtx());
    expect(r.impactoMensal).toBe(-1000);
    expect(r.impactoTotal).toBe(-12000); // perda de poupança acumulada = min(1000,2000)×12
    expect(r.custoOportunidade).toBeCloseTo(FVANN_1000_1PCT_12, 1);
    expect(r.impactoReserva).toBe(0); // sem déficit
  });
});

describe("Motor: abrir_negocio (FV inicial + FV-anuidade dos aportes)", () => {
  it("investimento 10k + aporte 1000/mês por 12m a 1% a.m.", () => {
    const r = calcularAbrirNegocio(10000, 12, baseCtx(), 1000);
    expect(r.impactoMensal).toBe(-1000); // = -aporteMensal
    expect(r.impactoTotal).toBe(-22000); // -(10000 + 1000×12)
    expect(r.impactoReserva).toBe(-10000); // reserva 50000 → 40000
    // custoOp = [10000·(1.01^12−1)] + [FV-anuidade(1000,1%,12) − 12000]
    //         = 1268.2503 + 682.5030 = 1950.75
    expect(r.custoOportunidade).toBeCloseTo(1950.75, 1);
    // meses equivalentes = round((10000 + 12000) / poupança 2000) = 11
    expect(r.impactoAposentadoriaMeses).toBe(11);
  });
});

describe("Motor: comprar_imovel (PMT de financiamento)", () => {
  it("PMT sem juros (taxa=0) → parcela = financiado/prazo (verificação exata da fórmula)", () => {
    // imóvel 100k, entrada 30% = 30k, financiado 70k, prazo 70, taxa 0% → parcela 1000
    const r = calcularComprarImovel(100000, 70, baseCtx(), 0.30, 0);
    expect(r.impactoMensal).toBe(-1000);
    expect(r.impactoTotal).toBe(-100000); // -(entrada 30k + parcelas 70k)
    expect(r.impactoReserva).toBe(-30000); // reserva 50k − entrada 30k
    expect(r.impactoPatrimonio).toBeCloseTo(0, 5); // juros = parcela×n − financiado = 0
    expect(r.custoOportunidade).toBeGreaterThan(55000); // custo de oportunidade (entrada + parcelas investidas)
    expect(r.custoOportunidade).toBeLessThan(66000);
  });
});

describe("Motor: trocar_carro (depreciação + financiamento)", () => {
  it("depreciação 12%/ano em 1 ano → valor residual 88% (verificação exata)", () => {
    // carro 50k, entrada 30% = 15k, financiado 35k, prazo 12, taxa 0% → parcela 35000/12
    const r = calcularTrocarCarro(50000, 12, baseCtx({ reservaAtual: 40000 }), 0.30, 0);
    // valor futuro = 50000 × (1−0.12)^1 = 44000 → impacto patrimônio = 44000 − 50000 = -6000
    expect(r.impactoPatrimonio).toBe(-6000);
    // custo líquido = total pago (15000 + 35000) − residual 44000 = 6000
    expect(r.impactoTotal).toBe(-6000);
    expect(r.impactoReserva).toBe(-15000); // reserva 40k − entrada 15k
    expect(r.impactoMensal).toBeCloseTo(-35000 / 12, 1); // parcela = financiado/prazo
  });
});

describe("Motor: antecipar_aposentadoria (regra dos 4%)", () => {
  it("patrimônio INSUFICIENTE → gap patrimonial e gap de renda exatos", () => {
    // renda desejada 5000/mês → patrimônio necessário = 5000×12/0.04 = 1.5M
    // patrimônio atual 600k → renda passiva possível = 600k×0.04/12 = 2000/mês
    const r = calcularAnteciparAposentadoria(5000, 5, baseCtx({ patrimonioAtual: 600000 }));
    expect(r.impactoTotal).toBe(-900000); // -(1.5M − 600k)
    expect(r.impactoPatrimonio).toBe(-900000);
    expect(r.impactoMensal).toBe(-3000); // -(5000 − 2000)
    expect(r.capitalPotencialPerdido).toBe(900000);
    expect(r.rendaPassivaPerdida).toBe(3000);
  });

  it("patrimônio SUFICIENTE → capital perdido = 0", () => {
    // patrimônio 2M > necessário 1.5M
    const r = calcularAnteciparAposentadoria(5000, 5, baseCtx({ patrimonioAtual: 2000000 }));
    expect(r.capitalPotencialPerdido).toBe(0);
    expect(r.rendaPassivaPerdida).toBe(0); // gap mensal negativo → 0
  });
});
