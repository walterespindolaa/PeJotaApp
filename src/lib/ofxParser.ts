/**
 * Simple OFX/QFX parser for Brazilian bank statements.
 * Extracts STMTTRN transactions from OFX XML-like format.
 */

export interface OFXTransaction {
  fitId: string;
  date: string; // yyyy-MM-dd
  amount: number;
  description: string;
  type: "income" | "expense";
  memo?: string;
}

export interface OFXParseResult {
  bankId?: string;
  accountId?: string;
  accountType?: string;
  transactions: OFXTransaction[];
  errors: string[];
}

function parseOFXDate(raw: string): string {
  // OFX dates: YYYYMMDDHHMMSS or YYYYMMDD
  const d = raw.replace(/\[.*$/, "").trim();
  if (d.length >= 8) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  return new Date().toISOString().split("T")[0];
}

function extractTag(text: string, tag: string): string {
  // OFX uses <TAG>value format (no closing tag in SGML mode) or <TAG>value</TAG> in XML mode
  const xmlRe = new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const xmlMatch = text.match(xmlRe);
  if (xmlMatch) return xmlMatch[1].trim();

  const sgmlRe = new RegExp(`<${tag}>([^\\n<]+)`, "i");
  const sgmlMatch = text.match(sgmlRe);
  if (sgmlMatch) return sgmlMatch[1].trim();

  return "";
}

function extractBlocks(text: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi");
  const blocks: string[] = [];
  let match;
  while ((match = re.exec(text)) !== null) {
    blocks.push(match[1]);
  }
  // Fallback for SGML-style without closing tags
  if (blocks.length === 0) {
    const sgmlRe = new RegExp(`<${tag}>([\\s\\S]*?)(?=<${tag}>|</${tag.split(".")[0]}|$)`, "gi");
    while ((match = sgmlRe.exec(text)) !== null) {
      blocks.push(match[1]);
    }
  }
  return blocks;
}

export function parseOFX(content: string): OFXParseResult {
  const errors: string[] = [];
  const transactions: OFXTransaction[] = [];

  try {
    const bankId = extractTag(content, "BANKID");
    const accountId = extractTag(content, "ACCTID");
    const accountType = extractTag(content, "ACCTTYPE");

    const txBlocks = extractBlocks(content, "STMTTRN");

    if (txBlocks.length === 0) {
      errors.push("Nenhuma transação encontrada no arquivo OFX.");
      return { bankId, accountId, accountType, transactions, errors };
    }

    for (const block of txBlocks) {
      const fitId = extractTag(block, "FITID");
      const dateRaw = extractTag(block, "DTPOSTED");
      const amountRaw = extractTag(block, "TRNAMT");
      const name = extractTag(block, "NAME");
      const memo = extractTag(block, "MEMO");

      if (!dateRaw || !amountRaw) {
        errors.push(`Transação ignorada: dados incompletos (FITID: ${fitId || "?"})`);
        continue;
      }

      const amount = parseFloat(amountRaw.replace(",", "."));
      if (isNaN(amount)) {
        errors.push(`Valor inválido: ${amountRaw}`);
        continue;
      }

      transactions.push({
        fitId: fitId || `gen_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        date: parseOFXDate(dateRaw),
        amount: Math.abs(amount),
        description: name || memo || "Sem descrição",
        type: amount >= 0 ? "income" : "expense",
        memo: memo || undefined,
      });
    }

    return { bankId, accountId, accountType, transactions, errors };
  } catch (e: any) {
    errors.push(`Erro ao processar OFX: ${e.message}`);
    return { transactions, errors };
  }
}
