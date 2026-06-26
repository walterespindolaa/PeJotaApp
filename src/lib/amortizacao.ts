// Cálculo de tabelas de amortização para financiamentos (Price e SAC).
// Usado no modo "detalhado" de dívidas/financiamento imobiliário.

export type SistemaAmortizacao = "price" | "sac";

export interface LinhaAmortizacao {
  n: number;          // número da parcela (1..N) a partir do saldo atual
  juros: number;
  amortizacao: number;
  parcela: number;
  saldo: number;      // saldo devedor após pagar esta parcela
}

/** Converte taxa anual efetiva (em %) para taxa mensal efetiva (fração). */
export function taxaMensalDeAnual(taxaAnualPct: number): number {
  if (!taxaAnualPct || taxaAnualPct <= 0) return 0;
  return Math.pow(1 + taxaAnualPct / 100, 1 / 12) - 1;
}

/**
 * Gera a tabela de amortização projetando para frente a partir do
 * saldo devedor ATUAL, ao longo das parcelas restantes.
 * - SAC: amortização constante, parcela decrescente.
 * - Price: parcela fixa.
 * A primeira linha (n=1) corresponde à próxima parcela a vencer.
 */
export function gerarTabelaAmortizacao(
  sistema: SistemaAmortizacao,
  saldoInicial: number,
  taxaMensal: number,
  parcelasRestantes: number
): LinhaAmortizacao[] {
  const linhas: LinhaAmortizacao[] = [];
  const n = Math.floor(parcelasRestantes);
  if (saldoInicial <= 0 || n <= 0) return linhas;

  let saldo = saldoInicial;

  if (sistema === "sac") {
    const amort = saldoInicial / n;
    for (let k = 1; k <= n; k++) {
      const juros = saldo * taxaMensal;
      const parcela = amort + juros;
      saldo = Math.max(saldo - amort, 0);
      linhas.push({ n: k, juros, amortizacao: amort, parcela, saldo });
    }
  } else {
    // Price — parcela fixa (PMT). Se taxa 0, vira parcela linear.
    const i = taxaMensal;
    const pmt = i > 0 ? (saldoInicial * i) / (1 - Math.pow(1 + i, -n)) : saldoInicial / n;
    for (let k = 1; k <= n; k++) {
      const juros = saldo * i;
      const amort = pmt - juros;
      saldo = Math.max(saldo - amort, 0);
      linhas.push({ n: k, juros, amortizacao: amort, parcela: pmt, saldo });
    }
  }
  return linhas;
}

/** Soma total de juros e do que ainda será pago, dada a tabela. */
export function totaisTabela(linhas: LinhaAmortizacao[]) {
  return linhas.reduce(
    (acc, l) => ({ totalJuros: acc.totalJuros + l.juros, totalPago: acc.totalPago + l.parcela }),
    { totalJuros: 0, totalPago: 0 }
  );
}
