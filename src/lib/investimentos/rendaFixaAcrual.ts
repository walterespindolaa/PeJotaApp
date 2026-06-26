// Acrual de juros para renda fixa.
// Baseline: usa SELIC mensal histórica como proxy de CDI (diferença <0,1% a.a.).
// IPCA mensal histórica vem da mesma EF get-macro-data.
//
// Fórmulas:
// - Pós-fixado (CDI/Selic): valor_t = valor_0 × Π(1 + selic_mensal × pct/100)
// - Prefixado: valor_t = valor_0 × (1 + taxa/100) ^ (anos)
// - Híbrido (IPCA+): valor_t = valor_0 × Π(1 + ipca_mensal) × (1 + taxa/100) ^ (anos)
//
// Para "estimar valor aplicado" dado o valor_atual: divide pelo fator de acumulação.

import type { MacroData } from "./types";

export type AcrualInput = {
  valorAtual: number;
  dataInicio: string;       // ISO "YYYY-MM-DD"
  indexador: string;        // "CDI" | "Selic" | "IPCA+" | "Prefixado" | ""
  taxaContratada: number;   // % do indexador (pra CDI/Selic) ou taxa anual (pra prefixado/híbrido)
  macroData: MacroData;     // { selic: [{date, value}], ipca: [{date, value}] }
  hoje?: Date;              // opcional pra testes; default = new Date()
};

export type AcrualResult = {
  valorAplicadoEstimado: number;
  fatorAcumulado: number;
  mesesDecorridos: number;
  metodo: "pos_fixado" | "prefixado" | "hibrido_ipca" | "fallback";
  warnings: string[];
};

const anualToMensal = (anualPct: number): number =>
  Math.pow(1 + anualPct / 100, 1 / 12) - 1;

const countMonthsBetween = (start: Date, end: Date): number => {
  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  return Math.max(0, years * 12 + months);
};

const parseMacroDate = (s: string): { y: number; m: number } | null => {
  const iso = s.match(/^(\d{4})-(\d{2})-/);
  if (iso) return { y: +iso[1], m: +iso[2] };
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return { y: +br[3], m: +br[2] };
  return null;
};

const getMacroValueForMonth = (
  series: { date: string; value: number }[],
  year: number,
  month: number
): number | null => {
  for (const point of series) {
    const parsed = parseMacroDate(point.date);
    if (parsed && parsed.y === year && parsed.m === month) {
      return point.value;
    }
  }
  return null;
};

const getLastKnownValue = (series: { date: string; value: number }[]): number => {
  if (!series.length) return 0;
  return series[series.length - 1].value;
};

export function calcularAcrualValorAplicado(input: AcrualInput): AcrualResult {
  const warnings: string[] = [];
  const hoje = input.hoje || new Date();
  const start = new Date(input.dataInicio + "T12:00:00");

  if (isNaN(start.getTime())) {
    return {
      valorAplicadoEstimado: input.valorAtual,
      fatorAcumulado: 1,
      mesesDecorridos: 0,
      metodo: "fallback",
      warnings: ["Data de início inválida — usando valor atual como aplicado."],
    };
  }

  const meses = countMonthsBetween(start, hoje);
  if (meses <= 0) {
    return {
      valorAplicadoEstimado: input.valorAtual,
      fatorAcumulado: 1,
      mesesDecorridos: 0,
      metodo: "fallback",
      warnings: ["Data de início no futuro ou hoje — sem acrual aplicável."],
    };
  }

  const idx = input.indexador.toUpperCase().trim();
  const taxa = input.taxaContratada || 0;

  // --- Pós-fixado: CDI ou Selic ---
  if (idx === "CDI" || idx === "SELIC") {
    if (taxa <= 0) {
      warnings.push("Taxa contratada não preenchida — assumindo 100% do indexador.");
    }
    const pct = taxa > 0 ? taxa : 100;
    let fator = 1;
    let mesesProcessados = 0;
    let mesesSemDado = 0;

    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    while (cursor < fim) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      let selicAnual = getMacroValueForMonth(input.macroData.selic, y, m);

      if (selicAnual == null) {
        selicAnual = getLastKnownValue(input.macroData.selic);
        mesesSemDado++;
      }

      const selicMensal = anualToMensal(selicAnual);
      fator *= 1 + selicMensal * (pct / 100);
      cursor.setMonth(cursor.getMonth() + 1);
      mesesProcessados++;
    }

    if (idx === "CDI") {
      warnings.push("CDI calculado usando Selic como proxy (diferença ~0,1% a.a.).");
    }
    if (mesesSemDado > 0) {
      warnings.push(`${mesesSemDado} mês(es) sem dado histórico — usado última taxa conhecida.`);
    }

    const valorAplicadoEstimado = fator > 0 ? input.valorAtual / fator : input.valorAtual;
    return {
      valorAplicadoEstimado,
      fatorAcumulado: fator,
      mesesDecorridos: mesesProcessados,
      metodo: "pos_fixado",
      warnings,
    };
  }

  // --- Prefixado ---
  if (idx === "PREFIXADO" || idx === "PRE" || idx === "PRÉ") {
    if (taxa <= 0) {
      return {
        valorAplicadoEstimado: input.valorAtual,
        fatorAcumulado: 1,
        mesesDecorridos: meses,
        metodo: "fallback",
        warnings: ["Prefixado sem taxa contratada — não é possível calcular acrual."],
      };
    }
    const taxaMensal = anualToMensal(taxa);
    const fator = Math.pow(1 + taxaMensal, meses);
    const valorAplicadoEstimado = input.valorAtual / fator;
    return {
      valorAplicadoEstimado,
      fatorAcumulado: fator,
      mesesDecorridos: meses,
      metodo: "prefixado",
      warnings,
    };
  }

  // --- Híbrido (IPCA+) ---
  if (idx === "IPCA+" || idx === "IPCA") {
    if (taxa < 0) {
      warnings.push("Taxa real negativa — verifique.");
    }
    let fatorIpca = 1;
    let mesesSemDado = 0;
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    while (cursor < fim) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth() + 1;
      let ipcaAnual = getMacroValueForMonth(input.macroData.ipca, y, m);
      if (ipcaAnual == null) {
        ipcaAnual = getLastKnownValue(input.macroData.ipca);
        mesesSemDado++;
      }
      const ipcaMensal = anualToMensal(ipcaAnual);
      fatorIpca *= 1 + ipcaMensal;
      cursor.setMonth(cursor.getMonth() + 1);
    }

    const taxaMensal = anualToMensal(taxa || 0);
    const fatorReal = Math.pow(1 + taxaMensal, meses);
    const fator = fatorIpca * fatorReal;

    if (mesesSemDado > 0) {
      warnings.push(`${mesesSemDado} mês(es) sem dado de IPCA — usada última taxa conhecida.`);
    }

    const valorAplicadoEstimado = fator > 0 ? input.valorAtual / fator : input.valorAtual;
    return {
      valorAplicadoEstimado,
      fatorAcumulado: fator,
      mesesDecorridos: meses,
      metodo: "hibrido_ipca",
      warnings,
    };
  }

  return {
    valorAplicadoEstimado: input.valorAtual,
    fatorAcumulado: 1,
    mesesDecorridos: meses,
    metodo: "fallback",
    warnings: [`Indexador "${input.indexador || "vazio"}" não suportado — usando valor atual.`],
  };
}
