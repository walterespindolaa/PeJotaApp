/**
 * Inferência automática de classificação de ativos de Renda Fixa
 * a partir do nome do ativo. Usado no form de edição e na importação
 * de planilhas/extratos B3.
 */

export type InferenceResult = {
  categoria_titulo: string | null; // Bancário, Crédito Privado, Tesouro Direto, Fundo de Investimento, Outro
  indexador: string | null;        // CDI, IPCA+, Prefixado, Selic
  taxa_contratada: number | null;  // %
};

const CATEGORIA_PATTERNS: { regex: RegExp; categoria: string }[] = [
  { regex: /\b(CDB|LCA|LCI|RDB|LF|Letra Financeira|LIG)\b/i, categoria: "Bancário" },
  { regex: /\b(CRA|CRI|Deb[eê]nture|DEB|FIDC|FIAGRO)\b/i, categoria: "Crédito Privado" },
  { regex: /\b(Tesouro|NTN-?B|NTN-?F|LFT|LTN|SELIC|IPCA Inflação|Pre[fF]ixado Tesouro)\b/i, categoria: "Tesouro Direto" },
  { regex: /\b(Fundo|FII|ETF|FIA|FIM|FIE)\b/i, categoria: "Fundo de Investimento" },
];

const INDEXADOR_PATTERNS: { regex: RegExp; indexador: string }[] = [
  { regex: /\b(IPCA|NTN-?B|inflac[aã]o)/i, indexador: "IPCA+" },
  { regex: /\b(SELIC|LFT)\b/i, indexador: "Selic" },
  { regex: /\b(pr[eé][- ]?fix(ado|a)?|LTN|NTN-?F)\b/i, indexador: "Prefixado" },
  { regex: /\b(CDI|p[oó]s[- ]?fix|DI)\b/i, indexador: "CDI" },
];

/**
 * Extrai uma taxa do nome quando aparece no formato "14%", "14,5%", "121%CDI".
 * Retorna null se não conseguir extrair com confiança.
 */
function extractTaxa(nome: string): number | null {
  const match = nome.match(/(\d{1,3}(?:[.,]\d{1,2})?)\s*%/);
  if (!match) return null;
  const num = parseFloat(match[1].replace(",", "."));
  if (!Number.isFinite(num) || num <= 0 || num > 1000) return null;
  return num;
}

/**
 * Aplica inferência sobre o nome do ativo.
 * NÃO sobrescreve campos que já vieram preenchidos pelo usuário —
 * o caller decide se deve usar o resultado.
 */
export function inferFromName(nome: string): InferenceResult {
  if (!nome || typeof nome !== "string") {
    return { categoria_titulo: null, indexador: null, taxa_contratada: null };
  }

  let categoria: string | null = null;
  for (const p of CATEGORIA_PATTERNS) {
    if (p.regex.test(nome)) { categoria = p.categoria; break; }
  }

  let indexador: string | null = null;
  for (const p of INDEXADOR_PATTERNS) {
    if (p.regex.test(nome)) { indexador = p.indexador; break; }
  }

  const taxa = extractTaxa(nome);

  return {
    categoria_titulo: categoria,
    indexador: indexador,
    taxa_contratada: taxa,
  };
}

/**
 * Aplica inferência APENAS aos campos que estão vazios no objeto base.
 * Útil pra import: respeita dados que já vieram preenchidos no Excel.
 */
export function inferAndMerge<T extends Record<string, any>>(
  base: T,
  nome: string,
): T {
  const inf = inferFromName(nome);
  return {
    ...base,
    categoria_titulo: base.categoria_titulo || inf.categoria_titulo || null,
    indexador: base.indexador || inf.indexador || "",
    taxa_contratada: base.taxa_contratada || inf.taxa_contratada || 0,
  };
}
