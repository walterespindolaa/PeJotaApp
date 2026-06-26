import * as XLSX from "xlsx";
import type { Investimento } from "./types";

// ===== Institution normalization =====

const B3_INSTITUTION_MAP: Array<{ pattern: string; normalized: string }> = [
  // XP group
  { pattern: "XP INVESTIMENTOS", normalized: "XP" },
  { pattern: "RICO INVESTIMENTOS", normalized: "Rico" },
  { pattern: "CLEAR CORRETORA", normalized: "Clear" },
  // BTG
  { pattern: "BTG PACTUAL", normalized: "BTG" },
  // Bancos
  { pattern: "ITAU UNIBANCO", normalized: "Itaú" },
  { pattern: "ITAU CORRETORA", normalized: "Itaú" },
  { pattern: "ITAU CV", normalized: "Itaú" },
  { pattern: "ITAU DTVM", normalized: "Itaú" },
  { pattern: "BANCO INTER", normalized: "Inter" },
  { pattern: "INTER DTVM", normalized: "Inter" },
  { pattern: "INTER CTVM", normalized: "Inter" },
  { pattern: "NU INVEST", normalized: "NuInvest" },
  { pattern: "NU PAGAMENTOS", normalized: "NuInvest" },
  { pattern: "NUBANK", normalized: "NuInvest" },
  { pattern: "BANCO SANTANDER", normalized: "Santander" },
  { pattern: "SANTANDER CCVM", normalized: "Santander" },
  { pattern: "BANCO BRADESCO", normalized: "Bradesco" },
  { pattern: "BRADESCO S.A. CTVM", normalized: "Bradesco" },
  { pattern: "BB BANCO DE INVESTIMENTO", normalized: "Banco do Brasil" },
  { pattern: "BANCO DO BRASIL", normalized: "Banco do Brasil" },
  { pattern: "CAIXA ECONOMICA", normalized: "Caixa" },
  { pattern: "BANCO SAFRA", normalized: "Safra" },
  { pattern: "J. SAFRA", normalized: "Safra" },
  { pattern: "J SAFRA", normalized: "Safra" },
  // Outras corretoras
  { pattern: "TORO CTVM", normalized: "Toro" },
  { pattern: "TORO INVESTIMENTOS", normalized: "Toro" },
  { pattern: "GENIAL INVESTIMENTOS", normalized: "Genial" },
  { pattern: "MODAL DTVM", normalized: "Modal" },
  { pattern: "NECTON INVESTIMENTOS", normalized: "Necton" },
  { pattern: "ORAMA DTVM", normalized: "Órama" },
  { pattern: "EQI INVESTIMENTOS", normalized: "EQI" },
  // Internacional
  { pattern: "AVENUE SECURITIES", normalized: "Avenue" },
  { pattern: "NOMAD", normalized: "Nomad" },
  // Cripto (não vem na B3, mas mapeamos por completude)
  { pattern: "BINANCE", normalized: "Binance" },
  { pattern: "MERCADO BITCOIN", normalized: "Mercado Bitcoin" },
  // Cooperativas
  { pattern: "SICOOB", normalized: "Sicoob" },
  { pattern: "SICREDI", normalized: "Sicredi" },
];

export function normalizeInstitution(b3Name: string | null | undefined): string {
  if (!b3Name) return "Outros";
  const upper = String(b3Name).toUpperCase().trim();
  for (const { pattern, normalized } of B3_INSTITUTION_MAP) {
    if (upper.includes(pattern)) return normalized;
  }
  return "Outros";
}

// ===== Candidate type =====

export type B3Candidate = {
  id: string; // local UUID for table key
  source_aba: string;
  tipo: string; // Atlas tipo
  classe: string;
  nome: string;
  ticker: string | null;
  instituicao: string;
  instituicao_original: string;
  quantidade: number;
  valor_atual: number;
  preco_medio: number; // = valor_atual / quantidade by default
  indexador?: string;
  taxa_contratada?: number;
  vencimento_data?: string | null;
  categoria_titulo?: string | null;
  data_emissao?: string | null;
  data_compra?: string | null;
  is_selected: boolean;
  dup_status: "new" | "duplicate_match" | "duplicate_qty_diff";
  existing_id?: string;
};

// ===== Helpers =====

const num = (v: any): number => {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/[R$\s.]/g, "").replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// Parse "DD/MM/YYYY" → "YYYY-MM-DD". Returns null on invalid.
const parseDateBR = (v: any): string | null => {
  if (!v) return null;
  const s = String(v).trim();
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
};

// "PETR4 - PETROLEO BRASILEIRO S.A.   " → "PETR4"
// Already-trimmed ticker → "PETR4" itself.
const extractTicker = (codigoNeg: any, produto: any): string | null => {
  const direct = String(codigoNeg || "").trim().toUpperCase();
  if (direct && /^[A-Z0-9]{4,10}$/.test(direct)) return direct;
  // Try parse from "TICKER - NOME"
  const fromProduto = String(produto || "").trim().split(" - ")[0].trim().toUpperCase();
  if (/^[A-Z0-9]{4,10}$/.test(fromProduto)) return fromProduto;
  return null;
};

const cleanName = (produto: any): string => {
  const s = String(produto || "").trim();
  if (s.includes(" - ")) {
    const parts = s.split(" - ");
    return parts.slice(1).join(" - ").trim();
  }
  return s;
};

const genId = (): string => {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `b3-${Math.random().toString(36).slice(2)}-${Date.now()}`;
};

// ===== Indexador derivation =====

const deriveIndexadorFromTesouro = (nome: string): string => {
  const upper = nome.toUpperCase();
  if (upper.includes("SELIC")) return "Selic";
  if (upper.includes("IPCA")) return "IPCA+";
  if (upper.includes("PREFIXADO")) return "Prefixado";
  return "";
};

const normalizeIndexadorRendaFixa = (raw: any): string => {
  if (!raw) return "";
  const s = String(raw).toUpperCase().trim();
  if (s === "-" || s === "") return "";
  if (s.includes("CDI")) return "CDI";
  if (s.includes("IPCA")) return "IPCA+";
  if (s.includes("SELIC")) return "Selic";
  if (s.includes("PRE") || s.includes("PRÉ")) return "Prefixado";
  return "";
};

// CDB → Bancário; LCI/LCA → Bancário; CRA/CRI/Debênture → Crédito Privado; outros → Outro
const deriveCategoriaTituloRendaFixa = (produto: string): string => {
  const upper = produto.toUpperCase();
  if (upper.startsWith("CDB")) return "Bancário";
  if (upper.startsWith("LCI") || upper.startsWith("LCA")) return "Bancário";
  if (upper.startsWith("CRA") || upper.startsWith("CRI") || upper.includes("DEBENTURE") || upper.includes("DEBÊNTURE")) {
    return "Crédito Privado";
  }
  return "Outro";
};

// ===== Per-sheet parsers =====

type Row = Record<string, any>;

const parseSheet = (wb: XLSX.WorkBook, sheetName: string): Row[] => {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: null });
};

const isEmptyRow = (row: Row): boolean => {
  const produto = row["Produto"];
  return !produto || String(produto).trim() === "";
};

// ----- Acoes -----
const parseAcoes = (rows: Row[]): B3Candidate[] => {
  return rows
    .filter(r => !isEmptyRow(r))
    .map(r => {
      const ticker = extractTicker(r["Código de Negociação"], r["Produto"]);
      const nome = cleanName(r["Produto"]);
      const quantidade = num(r["Quantidade"]);
      const valorAtual = num(r["Valor Atualizado"]);
      const precoMedio = num(r["Preço de Fechamento"]) || (quantidade > 0 ? valorAtual / quantidade : 0);
      return {
        id: genId(),
        source_aba: "Acoes",
        tipo: "Ação",
        classe: "Variável",
        nome,
        ticker,
        instituicao: normalizeInstitution(r["Instituição"]),
        instituicao_original: String(r["Instituição"] || "").trim(),
        quantidade,
        valor_atual: valorAtual,
        preco_medio: precoMedio,
        is_selected: true,
        dup_status: "new" as const,
      };
    });
};

// ----- ETF -----
const parseETF = (rows: Row[]): B3Candidate[] => {
  return rows
    .filter(r => !isEmptyRow(r))
    .map(r => {
      const ticker = extractTicker(r["Código de Negociação"], r["Produto"]);
      const nome = cleanName(r["Produto"]);
      const quantidade = num(r["Quantidade"]);
      const valorAtual = num(r["Valor Atualizado"]);
      const precoMedio = num(r["Preço de Fechamento"]) || (quantidade > 0 ? valorAtual / quantidade : 0);
      // ETF tipo "Criptoativo" → mapear como Cripto
      const isCripto = String(r["Tipo"] || "").toLowerCase().includes("cripto");
      return {
        id: genId(),
        source_aba: "ETF",
        tipo: isCripto ? "Cripto" : "ETF",
        classe: isCripto ? "Alternativo" : "Variável",
        nome,
        ticker,
        instituicao: normalizeInstitution(r["Instituição"]),
        instituicao_original: String(r["Instituição"] || "").trim(),
        quantidade,
        valor_atual: valorAtual,
        preco_medio: precoMedio,
        is_selected: true,
        dup_status: "new" as const,
      };
    });
};

// ----- Fundo de Investimento (FIIs) -----
const parseFundoInvestimento = (rows: Row[]): B3Candidate[] => {
  return rows
    .filter(r => !isEmptyRow(r))
    .map(r => {
      const ticker = extractTicker(r["Código de Negociação"], r["Produto"]);
      const nome = cleanName(r["Produto"]);
      const quantidade = num(r["Quantidade"]);
      const valorAtual = num(r["Valor Atualizado"]);
      const precoMedio = num(r["Preço de Fechamento"]) || (quantidade > 0 ? valorAtual / quantidade : 0);
      return {
        id: genId(),
        source_aba: "Fundo de Investimento",
        tipo: "FII",
        classe: "Variável",
        nome,
        ticker,
        instituicao: normalizeInstitution(r["Instituição"]),
        instituicao_original: String(r["Instituição"] || "").trim(),
        quantidade,
        valor_atual: valorAtual,
        preco_medio: precoMedio,
        is_selected: true,
        dup_status: "new" as const,
      };
    });
};

// ----- Tesouro Direto -----
const parseTesouroDireto = (rows: Row[]): B3Candidate[] => {
  return rows
    .filter(r => !isEmptyRow(r))
    .map(r => {
      const nome = String(r["Produto"] || "").trim();
      const quantidade = num(r["Quantidade"]);
      const valorAtual = num(r["Valor Atualizado"]) || num(r["Valor líquido"]) || num(r["Valor bruto"]);
      const precoMedio = quantidade > 0 ? valorAtual / quantidade : 0;
      const indexador = deriveIndexadorFromTesouro(nome);
      const vencimento = parseDateBR(r["Vencimento"]);
      const dataEmissao = parseDateBR(r["Data de Emissão"]);
      return {
        id: genId(),
        source_aba: "Tesouro Direto",
        tipo: "Renda Fixa",
        classe: "Renda Fixa",
        nome,
        ticker: null,
        instituicao: normalizeInstitution(r["Instituição"]),
        instituicao_original: String(r["Instituição"] || "").trim(),
        quantidade,
        valor_atual: valorAtual,
        preco_medio: precoMedio,
        indexador,
        taxa_contratada: 0,
        vencimento_data: vencimento,
        categoria_titulo: "Tesouro Direto",
        data_emissao: dataEmissao,
        data_compra: dataEmissao,
        is_selected: true,
        dup_status: "new" as const,
      };
    });
};

// ----- Renda Fixa (CDB/LCI/CRA/etc) -----
const parseRendaFixa = (rows: Row[]): B3Candidate[] => {
  return rows
    .filter(r => !isEmptyRow(r))
    .map(r => {
      const produto = String(r["Produto"] || "").trim();
      const emissor = String(r["Emissor"] || "").trim();
      const quantidade = num(r["Quantidade"]);
      // B3 nem sempre preenche MTM (mark-to-market). CURVA é o cálculo
      // pela curva contratada — sempre disponível para títulos registrados.
      // Ordem de preferência: MTM > CURVA > FECHAMENTO.
      const valorAtual =
        num(r["Valor Atualizado MTM"]) ||
        num(r["Valor Atualizado CURVA"]) ||
        num(r["Valor Atualizado FECHAMENTO"]);
      const precoMedio = quantidade > 0 ? valorAtual / quantidade : 0;
      const indexador = normalizeIndexadorRendaFixa(r["Indexador"]);
      const vencimento = parseDateBR(r["Vencimento"]);
      const dataEmissao = parseDateBR(r["Data de Emissão"]);
      const categoria = deriveCategoriaTituloRendaFixa(produto);
      return {
        id: genId(),
        source_aba: "Renda Fixa",
        tipo: "Renda Fixa",
        classe: "Renda Fixa",
        nome: emissor ? `${produto} (${emissor})` : produto,
        ticker: null,
        instituicao: normalizeInstitution(r["Instituição"]),
        instituicao_original: String(r["Instituição"] || "").trim(),
        quantidade,
        valor_atual: valorAtual,
        preco_medio: precoMedio,
        indexador,
        taxa_contratada: 0,
        vencimento_data: vencimento,
        categoria_titulo: categoria,
        data_emissao: dataEmissao,
        data_compra: dataEmissao,
        is_selected: true,
        dup_status: "new" as const,
      };
    });
};

// ----- COE -----
const parseCOE = (rows: Row[]): B3Candidate[] => {
  return rows
    .filter(r => !isEmptyRow(r))
    .map(r => {
      const produto = String(r["Produto"] || "").trim();
      const emissor = String(r["Emissor"] || "").trim();
      const quantidade = num(r["Quantidade"]) || 1;
      // B3 às vezes retorna "-" em Valor Aplicado para COE — ficará em zero
      // e o usuário verá warning para preencher manualmente.
      const valorAtual = num(r["Valor Aplicado"]);
      const precoMedio = quantidade > 0 ? valorAtual / quantidade : valorAtual;
      const vencimento = parseDateBR(r["Vencimento"]);
      const dataEmissao = parseDateBR(r["Data de Emissão"]);
      return {
        id: genId(),
        source_aba: "COE",
        tipo: "Outro",
        classe: "Alternativo",
        nome: emissor ? `COE ${emissor}` : produto,
        ticker: null,
        instituicao: normalizeInstitution(r["Instituição"]),
        instituicao_original: String(r["Instituição"] || "").trim(),
        quantidade,
        valor_atual: valorAtual,
        preco_medio: precoMedio,
        vencimento_data: vencimento,
        data_emissao: dataEmissao,
        data_compra: dataEmissao,
        is_selected: true,
        dup_status: "new" as const,
      };
    });
};

// ===== Main entry =====

export type B3ParseResult = {
  candidates: B3Candidate[];
  totalsBySheet: Record<string, number>;
  warnings: string[];
};

export async function parseB3File(file: File): Promise<B3ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });

  const candidates: B3Candidate[] = [];
  const totalsBySheet: Record<string, number> = {};
  const warnings: string[] = [];

  const expected = ["Acoes", "ETF", "Fundo de Investimento", "Tesouro Direto", "Renda Fixa", "COE"];
  for (const e of expected) {
    if (!wb.Sheets[e]) warnings.push(`Aba "${e}" não encontrada no arquivo.`);
  }

  const acoes = wb.Sheets["Acoes"] ? parseAcoes(parseSheet(wb, "Acoes")) : [];
  const etfs = wb.Sheets["ETF"] ? parseETF(parseSheet(wb, "ETF")) : [];
  const fundos = wb.Sheets["Fundo de Investimento"] ? parseFundoInvestimento(parseSheet(wb, "Fundo de Investimento")) : [];
  const tesouro = wb.Sheets["Tesouro Direto"] ? parseTesouroDireto(parseSheet(wb, "Tesouro Direto")) : [];
  const rendaFixa = wb.Sheets["Renda Fixa"] ? parseRendaFixa(parseSheet(wb, "Renda Fixa")) : [];
  const coe = wb.Sheets["COE"] ? parseCOE(parseSheet(wb, "COE")) : [];

  totalsBySheet["Acoes"] = acoes.length;
  totalsBySheet["ETF"] = etfs.length;
  totalsBySheet["Fundo de Investimento"] = fundos.length;
  totalsBySheet["Tesouro Direto"] = tesouro.length;
  totalsBySheet["Renda Fixa"] = rendaFixa.length;
  totalsBySheet["COE"] = coe.length;

  candidates.push(...acoes, ...etfs, ...fundos, ...tesouro, ...rendaFixa, ...coe);

  // COE sem valor aplicado não é descartado — só recebe warning.
  // Usuário pode preencher manualmente o valor antes de confirmar.
  const coeSemValor = candidates.filter(c => c.source_aba === "COE" && c.valor_atual === 0);
  if (coeSemValor.length > 0) {
    warnings.push(
      `${coeSemValor.length} COE(s) sem valor aplicado — preencha o valor manualmente antes de confirmar.`
    );
  }

  // Drop other types with 0 quantity/value (corrupted rows)
  const filtered = candidates.filter(c => {
    if (c.source_aba === "COE") return c.quantidade > 0; // COE: keep even without valor
    return c.quantidade > 0 && c.valor_atual > 0;
  });
  const dropped = candidates.length - filtered.length;
  if (dropped > 0) {
    warnings.push(`${dropped} linha(s) ignorada(s) por quantidade ou valor zero.`);
  }

  return { candidates: filtered, totalsBySheet, warnings };
}

// ===== Duplicate detection =====

export function detectDuplicates(
  candidates: B3Candidate[],
  existing: Investimento[]
): B3Candidate[] {
  return candidates.map(c => {
    let match: Investimento | undefined;

    if (c.ticker) {
      // Renda variável: match por ticker
      match = existing.find(inv =>
        inv.ticker && inv.ticker.toUpperCase() === c.ticker
      );
    } else {
      // Renda fixa / Tesouro / COE: match por nome + vencimento (se houver)
      match = existing.find(inv => {
        const sameName = inv.nome && inv.nome.trim() === c.nome.trim();
        if (!sameName) return false;
        if (c.vencimento_data && inv.vencimento_data) {
          return inv.vencimento_data === c.vencimento_data;
        }
        return true;
      });
    }

    if (!match) return { ...c, dup_status: "new", existing_id: undefined };
    // Tolerância 0.01 evita falsos positivos de comparação de float
    // (ex: 1824430.9999999998 vs 1824431 são "iguais" pra fins práticos).
    const diff = Math.abs(Number(match.quantidade) - c.quantidade);
    if (diff < 0.01) {
      return { ...c, dup_status: "duplicate_match", existing_id: match.id, is_selected: false };
    }
    return { ...c, dup_status: "duplicate_qty_diff", existing_id: match.id };
  });
}
