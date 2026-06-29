/* ============================================================
   PeJota — Motor de decisão PJ (funções PURAS e testáveis)
   Decisões reais de empresa (não PF): contratar, comprar equipamento,
   capital de giro, marketing, estoque, abrir filial.
   Fórmulas: PMT (Price), juros compostos / custo de oportunidade,
   payback, runway (meses de caixa). Tudo testado em node.
   ============================================================ */

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// PMT (tabela Price): parcela de um financiamento de PV, juros r ao mês, n meses.
export function pmt(pv: number, rMensal: number, n: number): number {
  if (n <= 0) return 0;
  if (rMensal <= 0) return pv / n;
  const f = Math.pow(1 + rMensal, n);
  return (pv * rMensal * f) / (f - 1);
}

// Valor futuro de um montante aplicado a r ao mês por n meses.
export function fv(pv: number, rMensal: number, n: number): number {
  return pv * Math.pow(1 + rMensal, n);
}

// Custo de oportunidade: quanto o dinheiro renderia se ficasse investido.
export function custoOportunidade(pv: number, rMensal: number, n: number): number {
  return fv(pv, rMensal, n) - pv;
}

// Valor presente de uma série de n parcelas iguais (venda parcelada).
export function valorPresente(parcela: number, rMensal: number, n: number): number {
  if (n <= 0) return 0;
  if (rMensal <= 0) return parcela * n;
  return parcela * (1 - Math.pow(1 + rMensal, -n)) / rMensal;
}

// Runway: por quantos meses o caixa aguenta uma queima mensal.
export function runwayMeses(caixa: number, queimaMensal: number): number {
  if (queimaMensal <= 0) return Infinity;
  return caixa / queimaMensal;
}

export interface PJContext {
  saldoCaixa: number;       // caixa atual da empresa
  receitaMensal: number;    // média mensal
  despesaMensal: number;    // média mensal
  margem: number;           // lucro/receita (0..1)
  taxaMensal: number;       // custo de oportunidade/juros base ao mês (ex.: 0.01)
}

export interface PJResult {
  titulo: string;
  impactoCaixaImediato: number;   // saída(-)/entrada(+) de caixa hoje
  impactoLucroMensal: number;     // efeito no lucro mensal recorrente
  jurosOuOportunidade: number;    // juros pagos (financiamento) ou custo de oportunidade (à vista)
  paybackMeses: number | null;    // meses para se pagar (quando aplicável)
  runwayAntes: number;            // meses de caixa antes
  runwayDepois: number;           // meses de caixa depois
  veredito: "favoravel" | "atencao" | "arriscado";
  memoria: string[];
}

const lucroMensal = (c: PJContext) => c.receitaMensal - c.despesaMensal;
const queima = (c: PJContext) => Math.max(0, c.despesaMensal - c.receitaMensal); // queima só se opera no negativo

function vereditoPor(runwayDepois: number, payback: number | null): PJResult["veredito"] {
  if (runwayDepois < 3) return "arriscado";
  if (payback != null && payback > 24) return "atencao";
  if (runwayDepois < 6) return "atencao";
  return "favoravel";
}

// ── 1) Contratar funcionário ──
export function contratarFuncionario(salario: number, fatorEncargos: number, ctx: PJContext, ganhoReceitaMensal = 0): PJResult {
  const custoMensal = salario * (fatorEncargos || 1.7);
  const lucroDepois = lucroMensal(ctx) - custoMensal + ganhoReceitaMensal * ctx.margem;
  const impactoLucroMensal = -custoMensal + ganhoReceitaMensal * ctx.margem;
  const faturamentoNecessario = ctx.margem > 0 ? custoMensal / ctx.margem : Infinity;
  const queimaDepois = Math.max(0, -lucroDepois);
  const runwayDepois = runwayMeses(ctx.saldoCaixa, queimaDepois);
  const payback = ganhoReceitaMensal * ctx.margem - custoMensal > 0 ? null : null; // recorrente, sem payback de aporte
  return {
    titulo: "Contratar funcionário",
    impactoCaixaImediato: 0,
    impactoLucroMensal: round2(impactoLucroMensal),
    jurosOuOportunidade: 0,
    paybackMeses: payback,
    runwayAntes: runwayMeses(ctx.saldoCaixa, queima(ctx)),
    runwayDepois,
    veredito: vereditoPor(runwayDepois, null),
    memoria: [
      `Custo mensal = salário ${salario} × encargos ${(fatorEncargos || 1.7)} = ${round2(custoMensal)}`,
      `Faturamento extra p/ cobrir (margem ${(ctx.margem * 100).toFixed(0)}%) = custo / margem = ${faturamentoNecessario === Infinity ? "—" : round2(faturamentoNecessario)}`,
      ganhoReceitaMensal > 0 ? `Receita extra estimada ${ganhoReceitaMensal} × margem = +${round2(ganhoReceitaMensal * ctx.margem)} no lucro` : `Sem receita extra informada: impacto = −${round2(custoMensal)} no lucro mensal`,
      `Lucro mensal: ${round2(lucroMensal(ctx))} → ${round2(lucroDepois)}`,
    ],
  };
}

// ── 2) Comprar equipamento (à vista ou financiado) ──
export function comprarEquipamento(valor: number, ctx: PJContext, opts: { financiado?: boolean; n?: number; taxaMensal?: number; ganhoMensal?: number }): PJResult {
  const ganho = opts.ganhoMensal || 0;
  const n = opts.n || 12;
  if (opts.financiado) {
    const r = opts.taxaMensal ?? ctx.taxaMensal;
    const parcela = pmt(valor, r, n);
    const jurosTotais = parcela * n - valor;
    const impactoLucroMensal = ganho - parcela;
    const lucroDepois = lucroMensal(ctx) - parcela + ganho;
    const runwayDepois = runwayMeses(ctx.saldoCaixa, Math.max(0, -lucroDepois));
    const payback = ganho > 0 ? valor / ganho : null;
    return {
      titulo: "Comprar equipamento (financiado)",
      impactoCaixaImediato: 0, impactoLucroMensal: round2(impactoLucroMensal),
      jurosOuOportunidade: round2(jurosTotais), paybackMeses: payback ? round2(payback) : null,
      runwayAntes: runwayMeses(ctx.saldoCaixa, queima(ctx)), runwayDepois,
      veredito: vereditoPor(runwayDepois, payback),
      memoria: [
        `Parcela (PMT) = ${valor} × ${r} / (1−(1+${r})^−${n}) = ${round2(parcela)}/mês`,
        `Juros totais = parcela × ${n} − valor = ${round2(jurosTotais)}`,
        ganho > 0 ? `Payback = valor / ganho mensal = ${valor} / ${ganho} = ${round2(valor / ganho)} meses` : `Sem ganho mensal informado`,
      ],
    };
  }
  // à vista
  const op = custoOportunidade(valor, ctx.taxaMensal, n);
  const impactoLucroMensal = ganho;
  const lucroDepois = lucroMensal(ctx) + ganho;
  const caixaDepois = ctx.saldoCaixa - valor;
  const runwayDepois = runwayMeses(Math.max(0, caixaDepois), Math.max(0, -lucroDepois) || queima(ctx));
  const payback = ganho > 0 ? valor / ganho : null;
  return {
    titulo: "Comprar equipamento (à vista)",
    impactoCaixaImediato: -valor, impactoLucroMensal: round2(impactoLucroMensal),
    jurosOuOportunidade: round2(op), paybackMeses: payback ? round2(payback) : null,
    runwayAntes: runwayMeses(ctx.saldoCaixa, queima(ctx)), runwayDepois,
    veredito: caixaDepois < 0 ? "arriscado" : vereditoPor(runwayDepois, payback),
    memoria: [
      `Saída de caixa hoje = −${valor}`,
      `Custo de oportunidade (${n}m a ${(ctx.taxaMensal * 100).toFixed(2)}%/mês) = ${valor}×(1+${ctx.taxaMensal})^${n} − ${valor} = ${round2(op)}`,
      `Caixa: ${round2(ctx.saldoCaixa)} → ${round2(caixaDepois)}`,
      ganho > 0 ? `Payback = ${round2(valor / ganho)} meses` : `Sem ganho mensal informado`,
    ],
  };
}

// ── 3) Empréstimo / capital de giro ──
export function capitalDeGiro(valor: number, taxaMensal: number, n: number, ctx: PJContext): PJResult {
  const parcela = pmt(valor, taxaMensal, n);
  const jurosTotais = parcela * n - valor;
  const lucroDepois = lucroMensal(ctx) - parcela;
  const runwayDepois = runwayMeses(ctx.saldoCaixa + valor, Math.max(0, -lucroDepois));
  return {
    titulo: "Empréstimo / capital de giro",
    impactoCaixaImediato: valor, impactoLucroMensal: round2(-parcela),
    jurosOuOportunidade: round2(jurosTotais), paybackMeses: null,
    runwayAntes: runwayMeses(ctx.saldoCaixa, queima(ctx)), runwayDepois,
    veredito: vereditoPor(runwayDepois, null),
    memoria: [
      `Entra ${valor} no caixa hoje`,
      `Parcela (PMT) = ${round2(parcela)}/mês por ${n} meses a ${(taxaMensal * 100).toFixed(2)}%/mês`,
      `Custo total de juros = ${round2(jurosTotais)} (${((jurosTotais / valor) * 100).toFixed(1)}% sobre o valor)`,
      `Lucro mensal: ${round2(lucroMensal(ctx))} → ${round2(lucroDepois)}`,
    ],
  };
}

// ── 4) Investir em marketing/aquisição ──
export function investirMarketing(gastoMensal: number, n: number, receitaEsperadaMensal: number, ctx: PJContext): PJResult {
  const lucroGerado = receitaEsperadaMensal * ctx.margem - gastoMensal;
  const investimentoTotal = gastoMensal * n;
  const retornoTotal = receitaEsperadaMensal * ctx.margem * n;
  const roi = investimentoTotal > 0 ? (retornoTotal - investimentoTotal) / investimentoTotal : 0;
  const lucroDepois = lucroMensal(ctx) + lucroGerado;
  const runwayDepois = runwayMeses(ctx.saldoCaixa, Math.max(0, -lucroDepois));
  const payback = lucroGerado > 0 ? gastoMensal / lucroGerado : null; // meses p/ o gasto do mês se pagar
  return {
    titulo: "Investir em marketing",
    impactoCaixaImediato: 0, impactoLucroMensal: round2(lucroGerado),
    jurosOuOportunidade: 0, paybackMeses: payback ? round2(payback) : null,
    runwayAntes: runwayMeses(ctx.saldoCaixa, queima(ctx)), runwayDepois,
    veredito: lucroGerado <= 0 ? "arriscado" : vereditoPor(runwayDepois, payback),
    memoria: [
      `Gasto = ${gastoMensal}/mês × ${n} = ${round2(investimentoTotal)}`,
      `Lucro gerado/mês = receita esperada ${receitaEsperadaMensal} × margem ${(ctx.margem * 100).toFixed(0)}% − gasto ${gastoMensal} = ${round2(lucroGerado)}`,
      `ROI no período = (retorno ${round2(retornoTotal)} − investido ${round2(investimentoTotal)}) / investido = ${(roi * 100).toFixed(0)}%`,
    ],
  };
}

// ── 5) Aumentar estoque/produção ──
export function aumentarEstoque(valor: number, giroMeses: number, ctx: PJContext): PJResult {
  const op = custoOportunidade(valor, ctx.taxaMensal, Math.max(1, giroMeses));
  const caixaDepois = ctx.saldoCaixa - valor;
  const runwayDepois = runwayMeses(Math.max(0, caixaDepois), queima(ctx));
  return {
    titulo: "Aumentar estoque",
    impactoCaixaImediato: -valor, impactoLucroMensal: 0,
    jurosOuOportunidade: round2(op), paybackMeses: null,
    runwayAntes: runwayMeses(ctx.saldoCaixa, queima(ctx)), runwayDepois,
    veredito: caixaDepois < 0 ? "arriscado" : vereditoPor(runwayDepois, null),
    memoria: [
      `Imobiliza ${valor} em estoque (saída de caixa)`,
      `Custo de oportunidade até girar (${giroMeses}m) = ${round2(op)}`,
      `Caixa: ${round2(ctx.saldoCaixa)} → ${round2(caixaDepois)}`,
    ],
  };
}

// ── 6) Abrir filial / novo ponto ──
export function abrirFilial(investimentoInicial: number, custoFixoMensal: number, receitaEsperadaMensal: number, ctx: PJContext): PJResult {
  const lucroFilialMensal = receitaEsperadaMensal * ctx.margem - custoFixoMensal;
  const caixaDepois = ctx.saldoCaixa - investimentoInicial;
  const payback = lucroFilialMensal > 0 ? investimentoInicial / lucroFilialMensal : null;
  const lucroDepois = lucroMensal(ctx) + lucroFilialMensal;
  const runwayDepois = runwayMeses(Math.max(0, caixaDepois), Math.max(0, -lucroDepois));
  return {
    titulo: "Abrir filial / novo ponto",
    impactoCaixaImediato: -investimentoInicial, impactoLucroMensal: round2(lucroFilialMensal),
    jurosOuOportunidade: 0, paybackMeses: payback ? round2(payback) : null,
    runwayAntes: runwayMeses(ctx.saldoCaixa, queima(ctx)), runwayDepois,
    veredito: caixaDepois < 0 ? "arriscado" : lucroFilialMensal <= 0 ? "arriscado" : vereditoPor(runwayDepois, payback),
    memoria: [
      `Investimento inicial = −${investimentoInicial} (saída de caixa)`,
      `Lucro da filial/mês = receita ${receitaEsperadaMensal} × margem ${(ctx.margem * 100).toFixed(0)}% − custo fixo ${custoFixoMensal} = ${round2(lucroFilialMensal)}`,
      payback ? `Payback = investimento / lucro mensal = ${round2(payback)} meses` : `Filial não se paga com os números atuais`,
    ],
  };
}
