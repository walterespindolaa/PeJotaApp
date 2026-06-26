/**
 * Premissas econômicas globais para o motor financeiro do Atlas.
 * Valores padrão que podem ser sobrepostos por premissas do usuário.
 */

export const FINANCIAL_PREMISES = {
  /** Retorno real médio anual (após inflação) */
  retorno_real_medio: 0.05,
  /** Inflação média anual */
  inflacao_media: 0.04,
  /** Taxa segura de retirada anual (regra dos 4%) */
  taxa_segura_retirada: 0.04,
  /** Depreciação média anual de veículos */
  depreciacao_carro: 0.12,
  /** Taxa de financiamento imobiliário padrão (anual) */
  taxa_financiamento_imovel: 0.10,
  /** Percentual padrão de entrada para imóvel */
  percentual_entrada_imovel: 0.30,
  /** Percentual padrão de entrada para carro */
  percentual_entrada_carro: 0.30,
  /** Prazo padrão de dependência financeira de um filho (anos) */
  anos_dependencia_filho: 18,
};

/** Converte taxa anual para mensal */
export function taxaAnualParaMensal(anual: number): number {
  return Math.pow(1 + anual, 1 / 12) - 1;
}

/** Calcula PMT (parcela) de financiamento com juros compostos */
export function calcPMT(pv: number, taxaMensal: number, nMeses: number): number {
  if (taxaMensal <= 0 || nMeses <= 0) return pv / Math.max(nMeses, 1);
  return pv * taxaMensal / (1 - Math.pow(1 + taxaMensal, -nMeses));
}

/** Calcula Valor Futuro (FV) de um montante presente */
export function calcFV(pv: number, taxaMensal: number, nMeses: number): number {
  return pv * Math.pow(1 + taxaMensal, nMeses);
}

/** Calcula Valor Futuro de uma série de aportes (anuidade) */
export function calcFVAnuidade(pmt: number, taxaMensal: number, nMeses: number): number {
  if (taxaMensal <= 0) return pmt * nMeses;
  return pmt * (Math.pow(1 + taxaMensal, nMeses) - 1) / taxaMensal;
}

/** Saldo devedor após k parcelas pagas */
export function saldoDevedor(pv: number, taxaMensal: number, nMeses: number, kPago: number): number {
  if (taxaMensal <= 0) return pv * (1 - kPago / nMeses);
  const fator = Math.pow(1 + taxaMensal, kPago);
  const pmt = calcPMT(pv, taxaMensal, nMeses);
  return pv * fator - pmt * (fator - 1) / taxaMensal;
}
