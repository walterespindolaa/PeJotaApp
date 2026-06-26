/**
 * Life Projection Engine — Mapa da Vida Financeira
 * Projects patrimony month-by-month with compound interest and life events.
 */

import { FINANCIAL_PREMISES, taxaAnualParaMensal } from "./financial_premises";

// ── Types ──

export interface LifeEvent {
  id: string;
  name: string;
  emoji: string;
  year: number;
  /** Lump-sum cost (positive = expense, negative = income) */
  impactValue: number;
  /** Monthly recurring cost change (positive = expense increase) */
  monthlyImpact?: number;
  /** Duration in months for monthly impact (0 = permanent) */
  durationMonths?: number;
  type: "imovel" | "filho" | "educacao" | "viagem" | "carro" | "aposentadoria" | "negocio" | "outro";
}

export interface ProjectionInputs {
  patrimonioInicial: number;
  rendaMensal: number;
  poupancaMensal: number;
  taxaRetornoAnual: number;
  inflacaoAnual: number;
  idadeAtual: number;
  idadeAposentadoria: number;
  expectativaVida?: number;
  events: LifeEvent[];
}

export interface ProjectionPoint {
  year: number;
  age: number;
  patrimonio: number;
  /** Events that occur in this year */
  events: LifeEvent[];
}

export interface ProjectionResult {
  series: ProjectionPoint[];
  patrimonioAposentadoria: number;
  rendaPassivaAposentadoria: number;
  patrimonioFinal: number;
  anosProjecao: number;
}

// ── Engine ──

export function runLifeProjection(inputs: ProjectionInputs): ProjectionResult {
  const {
    patrimonioInicial,
    rendaMensal,
    poupancaMensal,
    taxaRetornoAnual,
    inflacaoAnual,
    idadeAtual,
    idadeAposentadoria,
    expectativaVida = 90,
    events,
  } = inputs;

  // Real return rate (Fisher equation) — allow negative for high-inflation scenarios
  const taxaRealAnual = ((1 + taxaRetornoAnual) / (1 + inflacaoAnual)) - 1;
  const taxaMensal = taxaAnualParaMensal(taxaRealAnual);

  const anoInicial = new Date().getFullYear();
  const anosProjecao = Math.max(expectativaVida - idadeAtual, 1);
  
  let patrimonio = patrimonioInicial;
  const series: ProjectionPoint[] = [];
  let patrimonioAposentadoria = 0;
  let aposentado = false;

  // Retirement withdrawal = padrão de vida (maintain lifestyle)
  // saque = padrão de vida (renda - poupança)
  // Already in real terms since we use real return rate
  const saqueMensalAposentadoria = Math.max(0, rendaMensal - poupancaMensal);

  // Track active monthly impacts
  const activeImpacts: { endMonth: number; amount: number }[] = [];
  let globalMonth = 0;

  for (let y = 0; y <= anosProjecao; y++) {
    const year = anoInicial + y;
    const age = idadeAtual + y;
    const yearEvents = events.filter(e => e.year === year);

    if (y > 0) {
      for (let m = 0; m < 12; m++) {
        globalMonth++;

        // Check if retiring this year
        if (age >= idadeAposentadoria && !aposentado) {
          aposentado = true;
          patrimonioAposentadoria = patrimonio;
        }

        // Monthly growth
        patrimonio *= (1 + taxaMensal);

        // Accumulation: add savings | Retirement: withdraw living expenses
        if (!aposentado) {
          patrimonio += poupancaMensal;
        } else {
          patrimonio -= saqueMensalAposentadoria;
        }

        // Active monthly impacts (life events)
        let totalMonthlyImpact = 0;
        for (let i = activeImpacts.length - 1; i >= 0; i--) {
          const imp = activeImpacts[i];
          totalMonthlyImpact += imp.amount;
          if (imp.endMonth > 0 && globalMonth >= imp.endMonth) {
            activeImpacts.splice(i, 1);
          }
        }
        patrimonio -= totalMonthlyImpact;

        // Apply lump-sum events in the first month of the event year
        if (m === 0) {
          for (const ev of yearEvents) {
            patrimonio -= ev.impactValue;

            if (ev.monthlyImpact && ev.monthlyImpact > 0) {
              const duration = ev.durationMonths || 0;
              activeImpacts.push({
                amount: ev.monthlyImpact,
                endMonth: duration > 0 ? globalMonth + duration : 0,
              });
            }

            if (ev.type === "aposentadoria" && !aposentado) {
              aposentado = true;
              patrimonioAposentadoria = patrimonio;
            }
          }
        }

        patrimonio = Math.max(0, patrimonio);
      }
    }

    series.push({
      year,
      age,
      patrimonio: Math.round(patrimonio),
      events: yearEvents,
    });
  }

  const rendaPassivaAposentadoria = saqueMensalAposentadoria;

  return {
    series,
    patrimonioAposentadoria: Math.round(patrimonioAposentadoria),
    rendaPassivaAposentadoria: Math.round(rendaPassivaAposentadoria),
    patrimonioFinal: Math.round(patrimonio),
    anosProjecao,
  };
}

// ── Default events templates ──

export const EVENT_TEMPLATES: Omit<LifeEvent, "id" | "year">[] = [
  { name: "Comprar Imóvel", emoji: "🏠", impactValue: 400000, type: "imovel" },
  { name: "Nascimento de Filho", emoji: "👶", impactValue: 5000, monthlyImpact: 2000, durationMonths: 216, type: "filho" },
  { name: "Faculdade", emoji: "🎓", impactValue: 0, monthlyImpact: 3000, durationMonths: 48, type: "educacao" },
  { name: "Viagem Relevante", emoji: "✈️", impactValue: 30000, type: "viagem" },
  { name: "Trocar Carro", emoji: "🚗", impactValue: 120000, type: "carro" },
  { name: "Aposentadoria", emoji: "🏖️", impactValue: 0, type: "aposentadoria" },
  { name: "Abrir Negócio", emoji: "💼", impactValue: 100000, type: "negocio" },
  { name: "Outro Evento", emoji: "📌", impactValue: 0, type: "outro" },
];
