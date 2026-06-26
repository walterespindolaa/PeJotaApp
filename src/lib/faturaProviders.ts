/**
 * PDF Statement Provider System
 * 3-layer extraction pipeline: Providers → Generic → AI fallback
 * Supports both text-based and row-based (hybrid) parsing.
 */

import type { ExtractedRow } from "./pdfTextLayout";

export interface RawTransaction {
  date: string;       // YYYY-MM-DD
  description: string;
  amount: number;
  installment_current?: number;
  installment_total?: number;
  currency?: string;
  section?: string; // "compras" | "encargos" | "internacional"
}

export interface ProviderResult {
  provider: string;
  score: number;
  bank?: string;
  transactions: RawTransaction[];
  statementTotal?: number;
  dueDate?: string;
  partial?: boolean;
  parserConfidence?: number; // 0-1
}

interface Provider {
  name: string;
  bank: string;
  detect: (text: string) => number;
  parse: (text: string, statementMonth?: string) => { transactions: RawTransaction[]; statementTotal?: number; dueDate?: string };
  parseFromRows?: (rows: ExtractedRow[], statementMonth?: string) => { transactions: RawTransaction[]; statementTotal?: number; dueDate?: string };
}

// ── Helpers ──────────────────────────────────────────────────

function normDate(raw: string, fallbackYear: string): string {
  // Remove leading "@" from online purchase dates
  const cleaned = raw.replace(/^@/, "");
  const parts = cleaned.split("/");
  const d = parts[0].padStart(2, "0");
  const m = parts[1].padStart(2, "0");
  if (parts.length === 2) return `${fallbackYear}-${m}-${d}`;
  const y = parts[2].length === 2 ? `20${parts[2]}` : parts[2];
  return `${y}-${m}-${d}`;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/\s/g, "");
  if (cleaned.includes(",")) {
    return parseFloat(cleaned.replace(/\./g, "").replace(",", "."));
  }
  return parseFloat(cleaned);
}

function extractYear(text: string): string {
  const m = text.match(/(?:20\d{2})/);
  return m ? m[0] : new Date().getFullYear().toString();
}

// Lines to skip (headers, titles, footers)
const SKIP_LINE_PATTERNS = [
  /^DATA\s+ESTABELECIMENTO/i,
  /^DATA\s+DESCRI/i,
  /^VALOR\s+EM\s+R\$/i,
  /0800[\s-]/,
  /central\s+de\s+atendimento/i,
  /sac\s+ita[úu]/i,
  /www\./i,
  /ouvidoria/i,
  /deficientes?\s+auditivos/i,
  /^\s*p[áa]gina\s+\d/i,
  /^\s*\d+\s*\/\s*\d+\s*$/,
  /^resumo\s+da\s+fatura/i,
  /^previs[ãa]o\s+pr[oó]x/i,
  /limite\s+de\s+cr[ée]dito/i,
  /limite\s+dispon[ií]vel/i,
  /pagamento\s+m[ií]nimo/i,
  /parcelamento\s+de\s+fatura/i,
  /rotativo/i,
  /simula[çc][ãa]o/i,
  /teto\s+de\s+juros/i,
  /CET\s+/i,
  /encargos\s+financeiros/i,
  /instru[çc][õo]es\s+ao/i,
  /boleto\s+banc[áa]rio/i,
];

function shouldSkipLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length < 3) return true;
  return SKIP_LINE_PATTERNS.some(p => p.test(trimmed));
}

// ── Heuristic Categorization ────────────────────────────────

const HEURISTIC_CATEGORIES: [RegExp, string][] = [
  [/UBER|99\s*POP|99APP|VELOE|ZONA\s*AZUL|ESTACION|SEM\s*PARAR|MOVE\s*PARK|CONECTCAR/i, "Transporte"],
  [/SUPERMERC|MERCADO|FAST\s*FOOD|IFOOD|RAPPI|BURGER|MC\s*DONALD|SUBWAY|STARBUCKS|PADARIA|RESTAUR|LANCHE|CANTINA|PIZZA|SUSHI|ACOUGUE|HORTIFRUTI/i, "Alimentação"],
  [/SPOTIFY|NETFLIX|PRIME\s*VIDEO|AMAZON\s*PRIME|DISNEY|HBO|ICLOUD|APPLE\.COM|GOOGLE\s*(STORAGE|ONE)|MICROSOFT|ADOBE|DROPBOX|YOUTUBE|DEEZER|GLOBOPLAY|PARAMOUNT|STAR\+|CRUNCHYROLL|CHATGPT|OPENAI|NOTION|FIGMA|CANVA/i, "Assinaturas"],
  [/FARMACIA|FARMA|DROGA|DROGARIA|DROGASIL|RAIA|PANVEL|HOSP|CLINICA|LABORAT|SAUDE|UNIMED|AMIL/i, "Saúde"],
  [/ACADEMIA|SMART\s*FIT|BLU\s*FIT|GYM|FITNESS/i, "Saúde"],
  [/POSTO|SHELL|IPIRANGA|BR\s*DISTRIBUIDORA|PETROB|COMBUST|GAS\s*STATION/i, "Transporte"],
  [/SHEIN|RENNER|C&A|ZARA|RIACHUELO|MARISA|HERING|LOJAS\s*AMERICANAS|MAGAZINE|MAGALU|CASAS\s*BAHIA|SHOPEE|MERCADO\s*LIVRE|AMAZON/i, "Compras"],
  [/SEGURO|PORTO\s*SEGURO|LIBERTY|SULAMERICA|BRADESCO\s*SEG|ZURICH/i, "Seguros"],
  [/LUZ|ELET|ENERGIA|CPFL|ENEL|COPEL|CEMIG|SABESP|AGUA|SANEPAR|COMGAS|GAS\s*NATURAL|INTERNET|CLARO|VIVO|TIM|OI\s|NET\s|TELEFON/i, "Moradia"],
  [/ESCOLA|FACULDADE|UNIVERSID|CURSO|EDUCACAO|LIVRAR|SARAIVA|CULTURA/i, "Educação"],
  [/PET\s*SHOP|PETZ|COBASI|VETERIN/i, "Pets"],
];

export function heuristicCategorize(description: string): string | null {
  const upper = description.toUpperCase();
  for (const [pattern, category] of HEURISTIC_CATEGORIES) {
    if (pattern.test(upper)) return category;
  }
  return null;
}

// ── Regex helpers for row-based parsing ─────────────────────

const DATE_RE = /^@?\d{2}\/\d{2}$/;
const MONEY_CELL_RE = /^\d{1,3}(?:\.\d{3})*,\d{2}$/;

// ── ITAÚ PERSONALITÉ ────────────────────────────────────────

const provider_itau_personnalite: Provider = {
  name: "provider_itau_personnalite",
  bank: "Itaú Personalité",
  detect(text) {
    let score = 0;
    if (/personnalit[ée]/i.test(text)) score += 40;
    if (/personalit[ée]/i.test(text)) score += 40;
    if (/resumo\s+da\s+fatura\s+em\s+R\$/i.test(text)) score += 30;
    if (/lan[çc]amentos.*compras\s+e\s+saques/i.test(text)) score += 20;
    if (/total\s+desta\s+fatura/i.test(text)) score += 20;
    if (/previs[ãa]o\s+pr[oó]x.*fechamento/i.test(text)) score += 10;
    if (/ita[úu]\s+unibanco|itaucard/i.test(text)) score += 15;
    if (/mastercard.*ita[úu]|ita[úu].*mastercard|visa.*ita[úu]/i.test(text)) score += 10;
    return score;
  },

  /**
   * ROW-BASED PARSER for Itaú Personalité.
   * Uses column-aware extraction: find date cell, money cell, description between.
   */
  parseFromRows(rows, statementMonth) {
    const year = statementMonth ? statementMonth.split("-")[0] : new Date().getFullYear().toString();
    const results: RawTransaction[] = [];
    let statementTotal: number | undefined;
    let dueDate: string | undefined;
    let section: "compras" | "encargos" | "internacional" | "skip" = "compras";

    for (const row of rows) {
      const lineText = row.cells.map(c => c.text).join(" ");

      // Section detection
      if (/lan[çc]amentos.*compras|compras\s+e\s+saques/i.test(lineText)) {
        section = "compras"; continue;
      }
      if (/encargos|juros\s+rotat|IOF|tarifas\s+cobradas/i.test(lineText)) {
        section = "encargos"; continue;
      }
      if (/internacionais/i.test(lineText)) {
        section = "internacional"; continue;
      }
      if (/boleto\s+banc[áa]rio|instru[çc][õo]es|c[óo]digo\s+de\s+barras/i.test(lineText)) {
        section = "skip"; continue;
      }

      // Extract statement total
      if (!statementTotal) {
        const totalMatch = lineText.match(/total\s+desta\s+fatura\s+(?:R\$\s?)?([\d.,]+)/i)
          || lineText.match(/total\s+da\s+fatura\s+(?:R\$\s?)?([\d.,]+)/i);
        if (totalMatch) {
          statementTotal = parseAmount(totalMatch[1]);
          continue;
        }
        // Also try: row has "total desta fatura" in one cell and money in another
        const hasTotalLabel = row.cells.some(c => /total\s+desta\s+fatura/i.test(c.text));
        if (hasTotalLabel) {
          const moneyCell = [...row.cells].reverse().find(c => MONEY_CELL_RE.test(c.text.trim()));
          if (moneyCell) {
            statementTotal = parseAmount(moneyCell.text.trim());
            continue;
          }
        }
      }

      // Extract due date
      if (!dueDate) {
        const dueMatch = lineText.match(/(?:vencimento|com\s+vencimento\s+em)\s+(\d{2}\/\d{2}\/\d{2,4})/i);
        if (dueMatch) {
          dueDate = normDate(dueMatch[1], year);
        }
      }

      if (section === "skip" || section === "encargos") continue;
      if (shouldSkipLine(lineText)) continue;

      // Column-aware transaction extraction:
      // Find first cell matching date pattern, last cell matching money pattern.
      const cells = row.cells.map(c => ({ ...c, text: c.text.trim() })).filter(c => c.text.length > 0);
      if (cells.length < 2) continue;

      // Find date cell (first cell that looks like DD/MM or @DD/MM)
      const dateIdx = cells.findIndex(c => DATE_RE.test(c.text));
      if (dateIdx < 0) continue;

      // Find money cell (last cell that looks like a monetary value)
      let moneyIdx = -1;
      for (let i = cells.length - 1; i > dateIdx; i--) {
        if (MONEY_CELL_RE.test(cells[i].text)) {
          moneyIdx = i;
          break;
        }
      }
      if (moneyIdx < 0) continue;

      const dateStr = cells[dateIdx].text.replace(/^@/, "");
      const amount = parseAmount(cells[moneyIdx].text);
      if (isNaN(amount) || amount <= 0) continue;

      // Everything between date and money is description
      const descCells = cells.slice(dateIdx + 1, moneyIdx);
      let description = descCells.map(c => c.text).join(" ").trim();
      if (!description) continue;

      // Detect installments at end of description: "02/10", "3/12"
      let installment_current: number | undefined;
      let installment_total: number | undefined;
      const instMatch = description.match(/\s+(\d{1,2})\/(\d{1,2})\s*$/);
      if (instMatch) {
        const pA = parseInt(instMatch[1]);
        const pT = parseInt(instMatch[2]);
        if (pT >= 2 && pT <= 72 && pA >= 1 && pA <= pT) {
          installment_current = pA;
          installment_total = pT;
          description = description.replace(/\s+\d{1,2}\/\d{1,2}\s*$/, "").trim();
        }
      }

      results.push({
        date: normDate(dateStr, year),
        description,
        amount,
        installment_current,
        installment_total,
        section,
      });
    }

    return { transactions: results, statementTotal, dueDate };
  },

  parse(text, statementMonth) {
    const year = statementMonth ? statementMonth.split("-")[0] : extractYear(text);
    const results: RawTransaction[] = [];

    // Extract statement total
    let statementTotal: number | undefined;
    const totalPatterns = [
      /total\s+desta\s+fatura\s+(?:R\$\s?)?([\d.,]+)/i,
      /total\s+da\s+fatura\s+(?:R\$\s?)?([\d.,]+)/i,
      /total\s+desta\s+fatura\s*[\s:]+(?:R\$\s?)?([\d.,]+)/i,
    ];
    for (const p of totalPatterns) {
      const m = text.match(p);
      if (m) { statementTotal = parseAmount(m[1]); break; }
    }

    // Extract due date
    let dueDate: string | undefined;
    const duePatterns = [
      /(?:vencimento|com\s+vencimento\s+em)\s+(\d{2}\/\d{2}\/\d{2,4})/i,
      /vencimento\s+(\d{2}\/\d{2}\/\d{2,4})/i,
    ];
    for (const p of duePatterns) {
      const m = text.match(p);
      if (m) { dueDate = normDate(m[1], year); break; }
    }

    const lines = text.split("\n");
    let section: "compras" | "encargos" | "internacional" | "skip" = "compras";
    let inTransactionSection = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx].trim();
      if (!line || line.length < 3) continue;

      const hasDate = /^\d{2}\/\d{2}/.test(line);
      if (!hasDate) {
        if (/lan[çc]amentos.*compras|compras\s+e\s+saques/i.test(line)) {
          section = "compras"; inTransactionSection = true; continue;
        }
        if (/encargos|juros\s+rotat|IOF|tarifas\s+cobradas/i.test(line)) {
          section = "encargos"; continue;
        }
        if (/internacionais/i.test(line)) {
          section = "internacional"; continue;
        }
        if (/boleto\s+banc[áa]rio|instru[çc][õo]es|c[óo]digo\s+de\s+barras/i.test(line)) {
          section = "skip"; continue;
        }
        if (/resumo\s+da\s+fatura|previs[ãa]o/i.test(line)) continue;
      }

      if (section === "skip" || section === "encargos") continue;
      if (shouldSkipLine(line)) continue;

      // Pattern 1: Parcelado
      const mParc = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+(\d{2})\/(\d{2})\s+([\d]{1,3}(?:\.\d{3})*,\d{2})\s*$/);
      if (mParc) {
        const amount = parseAmount(mParc[5]);
        const parcAtual = parseInt(mParc[3]);
        const parcTotal = parseInt(mParc[4]);
        if (!isNaN(amount) && amount > 0 && parcTotal >= 2 && parcTotal <= 72 && parcAtual >= 1 && parcAtual <= parcTotal) {
          results.push({
            date: normDate(mParc[1], year), description: mParc[2].trim(), amount,
            installment_current: parcAtual, installment_total: parcTotal, section,
          });
          continue;
        }
      }

      // Pattern 2: Normal
      const mNorm = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+([\d]{1,3}(?:\.\d{3})*,\d{2})\s*$/);
      if (mNorm) {
        const amount = parseAmount(mNorm[3]);
        if (!isNaN(amount) && amount > 0) {
          const descInst = mNorm[2].match(/^(.+?)\s+(\d{2})\/(\d{2})\s*$/);
          if (descInst) {
            const pA = parseInt(descInst[2]);
            const pT = parseInt(descInst[3]);
            if (pT >= 2 && pT <= 72 && pA >= 1 && pA <= pT) {
              results.push({
                date: normDate(mNorm[1], year), description: descInst[1].trim(), amount,
                installment_current: pA, installment_total: pT, section,
              });
              continue;
            }
          }
          results.push({
            date: normDate(mNorm[1], year), description: mNorm[2].trim(), amount, section,
          });
          continue;
        }
      }

      // Pattern 3: With R$ prefix
      const mR$ = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+R\$\s*([\d.,]+)\s*$/);
      if (mR$) {
        const amount = parseAmount(mR$[3]);
        if (!isNaN(amount) && amount > 0) {
          results.push({
            date: normDate(mR$[1], year), description: mR$[2].trim(), amount, section,
          });
          continue;
        }
      }

      // Pattern 4: Multi-line merchant
      const mDateOnly = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s*$/);
      if (mDateOnly && !mNorm && !mParc && !mR$) {
        const nextLine = (lineIdx + 1 < lines.length) ? lines[lineIdx + 1].trim() : "";
        const mNextVal = nextLine.match(/^(.+?)\s+([\d]{1,3}(?:\.\d{3})*,\d{2})\s*$/);
        if (mNextVal && !/^\d{2}\/\d{2}/.test(nextLine)) {
          const amount = parseAmount(mNextVal[2]);
          if (!isNaN(amount) && amount > 0) {
            const fullDesc = mDateOnly[2].trim() + " " + mNextVal[1].trim();
            const instMatch = fullDesc.match(/(\d{2})\/(\d{2})\s*$/);
            if (instMatch) {
              const pA = parseInt(instMatch[1]);
              const pT = parseInt(instMatch[2]);
              if (pT >= 2 && pT <= 72 && pA >= 1 && pA <= pT) {
                results.push({
                  date: normDate(mDateOnly[1], year),
                  description: fullDesc.replace(/\d{2}\/\d{2}\s*$/, "").trim(),
                  amount, installment_current: pA, installment_total: pT, section,
                });
              } else {
                results.push({ date: normDate(mDateOnly[1], year), description: fullDesc, amount, section });
              }
            } else {
              results.push({ date: normDate(mDateOnly[1], year), description: fullDesc, amount, section });
            }
            lineIdx++;
            continue;
          }
        }
      }

      // Pattern 5: Loose match — double-space gap
      const mLoose = line.match(/^(.{10,}?)\s{2,}([\d]{1,3}(?:\.\d{3})*,\d{2})\s*$/);
      if (mLoose && section === "compras") {
        const descWithDate = mLoose[1].match(/^(\d{2}\/\d{2})\s+(.+)/);
        if (descWithDate) {
          const amount = parseAmount(mLoose[2]);
          if (!isNaN(amount) && amount > 0 && amount < 500000) {
            results.push({
              date: normDate(descWithDate[1], year), description: descWithDate[2].trim(), amount, section,
            });
            continue;
          }
        }
      }
    }

    return { transactions: results, statementTotal, dueDate };
  }
};

// ── NUBANK ──────────────────────────────────────────────────

const provider_nubank: Provider = {
  name: "provider_nubank",
  bank: "Nubank",
  detect(text) {
    let score = 0;
    if (/nubank|nu pagamentos/i.test(text)) score += 50;
    if (/roxinho|mastercard.*nubank|nubank.*mastercard/i.test(text)) score += 20;
    if (/compras\s+nacionais|compras\s+internacionais/i.test(text)) score += 15;
    if (/anu[ií]da/i.test(text)) score += 5;
    return score;
  },
  parse(text, statementMonth) {
    const year = statementMonth ? statementMonth.split("-")[0] : extractYear(text);
    const results: RawTransaction[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      if (shouldSkipLine(line)) continue;
      const m = line.match(/(\d{2}\/\d{2})\s+(.+?)\s+([\d.,]+)\s*$/);
      if (m) {
        const amount = parseAmount(m[3]);
        if (!isNaN(amount) && amount > 0) {
          results.push({ date: normDate(m[1], year), description: m[2].trim(), amount });
        }
      }
    }
    return { transactions: results };
  }
};

// ── ITAÚ GENÉRICO ───────────────────────────────────────────

const provider_itau: Provider = {
  name: "provider_itau",
  bank: "Itaú",
  detect(text) {
    let score = 0;
    if (/ita[úu]\s+unibanco|itaucard/i.test(text)) score += 50;
    if (/visa.*ita[úu]|ita[úu].*visa|mastercard.*ita[úu]/i.test(text)) score += 20;
    if (/lan[çc]amentos|transa[çc][õo]es/i.test(text)) score += 10;
    if (/total\s+da\s+fatura/i.test(text)) score += 10;
    if (/personnalit[ée]|personalit[ée]/i.test(text)) score -= 30;
    return score;
  },
  parse(text, statementMonth) {
    const year = statementMonth ? statementMonth.split("-")[0] : extractYear(text);
    const results: RawTransaction[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      if (shouldSkipLine(line)) continue;
      const mP = line.match(/^(\d{2}\/\d{2})\s+(.+?)\s+(\d{2})\/(\d{2})\s+([\d.,]+)\s*$/);
      if (mP) {
        const amount = parseAmount(mP[5]);
        if (!isNaN(amount) && amount > 0) {
          results.push({ date: normDate(mP[1], year), description: mP[2].trim(), amount, installment_current: parseInt(mP[3]), installment_total: parseInt(mP[4]) });
          continue;
        }
      }
      const m = line.match(/(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+(?:R\$\s?)?([\d.,]+)\s*$/);
      if (m) {
        const amount = parseAmount(m[3]);
        if (!isNaN(amount) && amount > 0) {
          results.push({ date: normDate(m[1], year), description: m[2].trim(), amount });
        }
      }
    }
    return { transactions: results };
  }
};

// ── MERCADO PAGO ────────────────────────────────────────────

const provider_mercadopago: Provider = {
  name: "provider_mercadopago",
  bank: "Mercado Pago",
  detect(text) {
    let score = 0;
    if (/mercado\s*pago|mercadolivre|mercado\s*livre/i.test(text)) score += 50;
    if (/meli|ml\s+\*/i.test(text)) score += 20;
    if (/cart[ãa]o\s+mercado\s*pago/i.test(text)) score += 20;
    return score;
  },
  parse(text, statementMonth) {
    const year = statementMonth ? statementMonth.split("-")[0] : extractYear(text);
    const results: RawTransaction[] = [];
    const lines = text.split("\n");
    for (const line of lines) {
      if (shouldSkipLine(line)) continue;
      const m = line.match(/(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+(?:R\$\s?)?([\d.,]+)\s*$/);
      if (m) {
        const amount = parseAmount(m[3]);
        if (!isNaN(amount) && amount > 0) {
          results.push({ date: normDate(m[1], year), description: m[2].trim(), amount });
        }
      }
    }
    return { transactions: results };
  }
};

// ── GENERIC (Layer B — table heuristic) ─────────────────────

const provider_generic: Provider = {
  name: "provider_generic",
  bank: "Não identificado",
  detect() { return 1; },
  parse(text, statementMonth) {
    const year = statementMonth ? statementMonth.split("-")[0] : extractYear(text);
    const results: RawTransaction[] = [];
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

    let inTable = false;
    for (const line of lines) {
      if (/DATA\s+.*ESTABELECIMENTO.*VALOR|DATA\s+.*DESCRI.*VALOR/i.test(line)) {
        inTable = true; continue;
      }
      if (inTable && /^(total|subtotal|resumo)/i.test(line)) {
        inTable = false; continue;
      }

      if (shouldSkipLine(line)) continue;

      const m1 = line.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+([\d.,]+)\s*$/);
      if (m1) {
        const amount = parseAmount(m1[3]);
        if (!isNaN(amount) && amount > 0) {
          results.push({ date: normDate(m1[1], year), description: m1[2].trim(), amount });
          continue;
        }
      }
      const m2 = line.match(/^(\d{2}\/\d{2}(?:\/\d{2,4})?)\s+(.+?)\s+R\$\s*([\d.,]+)\s*$/);
      if (m2) {
        const amount = parseAmount(m2[3]);
        if (!isNaN(amount) && amount > 0) {
          results.push({ date: normDate(m2[1], year), description: m2[2].trim(), amount });
          continue;
        }
      }
    }

    // CSV fallback
    if (results.length === 0) {
      for (const line of lines) {
        if (/date|descri[çc][ãa]o|description/i.test(line)) continue;
        const parts = line.includes(";") ? line.split(";") : line.split(",");
        if (parts.length >= 3) {
          const date = parts[0].trim();
          const amount = parseAmount(parts[parts.length - 1].trim());
          const description = parts.slice(1, -1).join(",").trim();
          if (date && description && !isNaN(amount) && amount > 0) {
            results.push({ date, description, amount: Math.abs(amount) });
          }
        }
      }
    }

    return { transactions: results };
  }
};

// ── Provider Engine ─────────────────────────────────────────

const PROVIDERS: Provider[] = [provider_itau_personnalite, provider_nubank, provider_itau, provider_mercadopago];
const MIN_PROVIDER_SCORE = 30;
const MIN_TRANSACTIONS_FOR_SUCCESS = 3;

/**
 * Detect provider from text and parse using text-based parser.
 */
export function detectAndParse(pdfText: string, statementMonth?: string): ProviderResult {
  const scored = PROVIDERS.map(p => ({ provider: p, score: p.detect(pdfText) }))
    .sort((a, b) => b.score - a.score);

  if (scored[0].score >= MIN_PROVIDER_SCORE) {
    const best = scored[0].provider;
    const result = best.parse(pdfText, statementMonth);
    const confidence = result.transactions.length >= 10 ? 0.9 :
                       result.transactions.length >= 5 ? 0.6 : 0.3;
    if (result.transactions.length >= MIN_TRANSACTIONS_FOR_SUCCESS) {
      return {
        provider: best.name, score: scored[0].score, bank: best.bank,
        transactions: result.transactions, statementTotal: result.statementTotal,
        dueDate: result.dueDate, parserConfidence: confidence,
      };
    }
    if (result.transactions.length > 0) {
      return {
        provider: best.name, score: scored[0].score, bank: best.bank,
        transactions: result.transactions, statementTotal: result.statementTotal,
        dueDate: result.dueDate, partial: true, parserConfidence: confidence,
      };
    }
  }

  const genericResult = provider_generic.parse(pdfText, statementMonth);
  return {
    provider: "provider_generic", score: 1,
    bank: scored[0].score >= 20 ? scored[0].provider.bank : undefined,
    transactions: genericResult.transactions,
    parserConfidence: genericResult.transactions.length >= 5 ? 0.5 : 0.2,
  };
}

/**
 * Detect provider from text and parse using row-based parser (hybrid extraction).
 * Falls back to text-based if no row parser exists for the detected provider.
 */
export function detectAndParseFromRows(rows: ExtractedRow[], textForDetection: string, statementMonth?: string): ProviderResult {
  const scored = PROVIDERS.map(p => ({ provider: p, score: p.detect(textForDetection) }))
    .sort((a, b) => b.score - a.score);

  // Try row-based parser for best provider
  const best = scored[0].provider;
  const parseFromRows = best.parseFromRows;
  if (scored[0].score >= MIN_PROVIDER_SCORE && parseFromRows) {
    const result = parseFromRows(rows, statementMonth);
    const confidence = result.transactions.length >= 10 ? 0.9 :
                       result.transactions.length >= 5 ? 0.6 : 0.3;
    if (result.transactions.length >= MIN_TRANSACTIONS_FOR_SUCCESS) {
      return {
        provider: best.name + "_rows", score: scored[0].score, bank: best.bank,
        transactions: result.transactions, statementTotal: result.statementTotal,
        dueDate: result.dueDate, parserConfidence: confidence,
      };
    }
    if (result.transactions.length > 0) {
      return {
        provider: best.name + "_rows", score: scored[0].score, bank: best.bank,
        transactions: result.transactions, statementTotal: result.statementTotal,
        dueDate: result.dueDate, partial: true, parserConfidence: confidence,
      };
    }
  }

  // No row parser or it returned nothing — caller should fallback to text-based
  return {
    provider: "no_row_parser", score: 0,
    transactions: [], parserConfidence: 0,
  };
}

// ── 3-Layer Sanity Check ────────────────────────────────────

export type SanityLevel = "ok" | "low_confidence" | "blocked";

export interface SanityResult {
  valid: boolean;
  level: SanityLevel;
  reason?: string;
  reasonCode?: string;
  suspiciousLines: number[];
  details?: {
    transactionsFound: number;
    totalFound?: number;
    totalSum: number;
    mismatchPct: number;
  };
}

export function sanityCheckStatement(
  lines: { amount: number }[],
  statementTotal: number | undefined
): SanityResult {
  const suspiciousLines: number[] = [];
  const sum = lines.reduce((s, l) => s + l.amount, 0);

  if (lines.length < 3) {
    return {
      valid: false, level: "blocked",
      reason: `Apenas ${lines.length} transação(ões) extraída(s). O PDF pode não ter sido lido corretamente.`,
      reasonCode: "too_few_transactions", suspiciousLines: [],
      details: { transactionsFound: lines.length, totalFound: statementTotal, totalSum: sum, mismatchPct: 0 },
    };
  }

  if (!statementTotal || statementTotal <= 0) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].amount > 200000) {
        return {
          valid: false, level: "blocked",
          reason: `Valor absurdo detectado: R$ ${lines[i].amount.toFixed(2)}.`,
          reasonCode: "absurd_single_value", suspiciousLines: [i],
          details: { transactionsFound: lines.length, totalSum: sum, mismatchPct: 0 },
        };
      }
    }
    return { valid: true, level: "ok", suspiciousLines };
  }

  const mismatchPct = Math.abs(sum - statementTotal) / statementTotal;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].amount > statementTotal * 0.3) suspiciousLines.push(i);
    if (statementTotal < 100 && lines[i].amount > 5000) {
      return {
        valid: false, level: "blocked",
        reason: `Valor absurdo: linha com R$ ${lines[i].amount.toFixed(2)} em fatura de R$ ${statementTotal.toFixed(2)}.`,
        reasonCode: "absurd_value_vs_total", suspiciousLines: [i],
        details: { transactionsFound: lines.length, totalFound: statementTotal, totalSum: sum, mismatchPct },
      };
    }
  }

  if (mismatchPct <= 0.05) {
    return {
      valid: true, level: "ok", suspiciousLines,
      details: { transactionsFound: lines.length, totalFound: statementTotal, totalSum: sum, mismatchPct },
    };
  }

  if (mismatchPct <= 0.20) {
    return {
      valid: true, level: "low_confidence",
      reason: `Leitura parcial detectada: soma (R$ ${sum.toFixed(2)}) difere ${(mismatchPct * 100).toFixed(1)}% do total (R$ ${statementTotal.toFixed(2)}). Revise antes de aplicar.`,
      reasonCode: "total_mismatch_low", suspiciousLines,
      details: { transactionsFound: lines.length, totalFound: statementTotal, totalSum: sum, mismatchPct },
    };
  }

  if (lines.length >= 15) {
    return {
      valid: true, level: "low_confidence",
      reason: `Leitura parcial detectada: soma (R$ ${sum.toFixed(2)}) difere ${(mismatchPct * 100).toFixed(1)}% do total (R$ ${statementTotal.toFixed(2)}). ${lines.length} transações encontradas — revise antes de aplicar.`,
      reasonCode: "total_mismatch_many_tx", suspiciousLines,
      details: { transactionsFound: lines.length, totalFound: statementTotal, totalSum: sum, mismatchPct },
    };
  }

  return {
    valid: false, level: "blocked",
    reason: `Soma das transações (R$ ${sum.toFixed(2)}) difere ${(mismatchPct * 100).toFixed(1)}% do total (R$ ${statementTotal.toFixed(2)}). Tentando extração alternativa...`,
    reasonCode: "total_mismatch_high", suspiciousLines,
    details: { transactionsFound: lines.length, totalFound: statementTotal, totalSum: sum, mismatchPct },
  };
}

// ── Merchant utilities ──────────────────────────────────────

export function normalizeMerchant(description: string): string {
  return description
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/\d{2}\/\d{2,}/g, "")
    .replace(/PARC\s*\d*/gi, "")
    .replace(/\s*-\s*/g, " ")
    .replace(/\*+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function generateInstallmentFingerprint(merchantNorm: string, amount: number, totalInstallments: number | null): string {
  const amountBucket = Math.round(amount * 100);
  const total = totalInstallments || 0;
  return `${merchantNorm}|${amountBucket}|${total}`;
}

export function generateCacheFingerprint(merchantNorm: string, amount: number, descriptionNorm: string): string {
  const amountBucket = Math.round(amount / 5) * 5;
  return `${merchantNorm}|${amountBucket}|${descriptionNorm.slice(0, 30)}`;
}
