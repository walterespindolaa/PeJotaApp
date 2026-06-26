export type MatchConfidence = "exact" | "fuzzy" | "none";

export type ExistingInvestimento = {
  id: string;
  nome: string;
  ticker: string | null;
  instituicao: string | null;
  tipo: string;
};

export type MatchResult = {
  match: ExistingInvestimento | null;
  confidence: MatchConfidence;
  reason: string; // pra UI explicar pra que casou
};

const norm = (s: string | null | undefined) =>
  (s || "").toLowerCase().trim()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Tenta achar um investimento existente que case com a linha sendo
 * importada. Ordem de preferência: ticker exato → nome normalizado
 * exato → fuzzy (instituição + parte do nome).
 */
export function findMatch(
  candidate: { nome: string; ticker?: string | null; instituicao?: string | null; tipo?: string | null },
  existing: ExistingInvestimento[],
): MatchResult {
  const candTicker = (candidate.ticker || "").trim().toUpperCase();
  const candNome = norm(candidate.nome);
  const candInst = norm(candidate.instituicao);

  if (candTicker) {
    const byTicker = existing.find(e =>
      (e.ticker || "").trim().toUpperCase() === candTicker
    );
    if (byTicker) return { match: byTicker, confidence: "exact", reason: `Mesmo ticker: ${candTicker}` };
  }

  if (candNome) {
    const byNome = existing.find(e => norm(e.nome) === candNome);
    if (byNome) return { match: byNome, confidence: "exact", reason: "Mesmo nome" };
  }

  // Fuzzy: instituição igual + nome compartilha 3+ palavras consecutivas
  if (candNome && candInst) {
    const candWords = candNome.split(" ").filter(w => w.length > 2);
    const fuzzy = existing.find(e => {
      if (norm(e.instituicao) !== candInst) return false;
      const eWords = norm(e.nome).split(" ");
      return candWords.length >= 3 && candWords.slice(0, 3).every(w => eWords.includes(w));
    });
    if (fuzzy) return { match: fuzzy, confidence: "fuzzy", reason: "Mesma instituição + nome similar" };
  }

  return { match: null, confidence: "none", reason: "" };
}
