/**
 * PDF Text Layout Extraction — Hybrid (text + AcroForm annotations)
 * Robust layout-aware extraction with anti-glue splitters and noise removal
 * for Brazilian credit card statements (Itaú, Nubank, etc.).
 */

import { logWarn } from "@/lib/log";

// ── Types ──────────────────────────────────────────────────

interface TextItem {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
}

export interface ExtractedCell {
  x: number;
  text: string;
  width: number;
  source: "text" | "annotation";
}

export interface ExtractedRow {
  y: number;
  cells: ExtractedCell[];
}

interface PositionedItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
  source: "text" | "annotation";
}

// ── Hybrid Extractor (text + Widget annotations) ───────────

/**
 * Extract structured rows from a PDF document by merging text content
 * and AcroForm Widget annotation field values, all positioned by (x, y).
 * Returns rows sorted top-to-bottom, cells sorted left-to-right.
 */
export async function extractPdfToRows(
  pdf: any, // PDFDocumentProxy
  yTolerance = 2.5
): Promise<{ rows: ExtractedRow[]; textItemCount: number; annotationItemCount: number }> {
  const allItems: PositionedItem[] = [];
  let textItemCount = 0;
  let annotationItemCount = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    // (a) textContent items
    const textContent = await page.getTextContent();
    for (const item of textContent.items) {
      if (!item.str || item.str.trim() === "") continue;
      const tx = item.transform || [1, 0, 0, 1, 0, 0];
      allItems.push({
        str: item.str,
        x: tx[4] || 0,
        y: tx[5] || 0,
        width: item.width || 0,
        height: item.height || 0,
        source: "text",
      });
      textItemCount++;
    }

    // (b) Widget annotations (AcroForm fields with values)
    try {
      const annotations = await page.getAnnotations({ intent: "display" });
      for (const ann of annotations) {
        if (ann.subtype !== "Widget") continue;

        // Extract field value
        const fieldValue = ann.fieldValue ?? ann.buttonValue ?? ann.value ?? null;
        if (fieldValue == null) continue;
        const text = String(fieldValue).trim();
        if (!text || text.length === 0) continue;

        // Get position from rect [x1, y1, x2, y2]
        const rect = ann.rect;
        if (!rect || rect.length < 4) continue;

        allItems.push({
          str: text,
          x: rect[0],
          y: rect[1],
          width: rect[2] - rect[0],
          height: rect[3] - rect[1],
          source: "annotation",
        });
        annotationItemCount++;
      }
    } catch (e) {
      // Some PDFs may not support getAnnotations; continue without
      logWarn("[pdfTextLayout] getAnnotations failed for page", pageNum, e);
    }
  }

  // (c) Group items into rows by Y tolerance
  const rows: { y: number; items: PositionedItem[] }[] = [];

  // Sort by Y descending (top to bottom in PDF coords), then X ascending
  allItems.sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > yTolerance) return yDiff;
    return a.x - b.x;
  });

  for (const item of allItems) {
    const existing = rows.find(r => Math.abs(r.y - item.y) < yTolerance);
    if (existing) {
      existing.items.push(item);
    } else {
      rows.push({ y: item.y, items: [item] });
    }
  }

  // Sort rows top-to-bottom
  rows.sort((a, b) => b.y - a.y);

  // (d) Build ExtractedRow[] with cells sorted by X, NOT concatenated
  const extractedRows: ExtractedRow[] = rows.map(row => {
    row.items.sort((a, b) => a.x - b.x);

    // Merge adjacent text items that are very close (gap < 2px) into one cell
    const mergedCells: ExtractedCell[] = [];
    let currentCell: ExtractedCell | null = null;

    for (const item of row.items) {
      if (currentCell) {
        const cell: ExtractedCell = currentCell;
        const gap: number = item.x - (cell.x + cell.width);
        if (gap < 2 && item.source === "text" && cell.source === "text") {
          // Merge into current cell
          const newText: string = gap < 0.5 ? cell.text + item.str : cell.text + " " + item.str;
          currentCell = {
            ...cell,
            text: newText,
            width: (item.x + item.width) - cell.x,
          };
          continue;
        }
        mergedCells.push(cell);
      }
      currentCell = {
        x: item.x,
        text: item.str,
        width: item.width || item.str.length * 5,
        source: item.source,
      };
    }
    if (currentCell) mergedCells.push(currentCell);

    return { y: row.y, cells: mergedCells };
  });

  return { rows: extractedRows, textItemCount, annotationItemCount };
}

/**
 * Convert ExtractedRow[] back to a plain text string (for legacy parsers).
 * Cells are joined with double-space for column separation.
 */
export function rowsToText(rows: ExtractedRow[]): string {
  return rows
    .map(row => row.cells.map(c => c.text.trim()).filter(Boolean).join("  "))
    .filter(line => line.trim().length > 0)
    .join("\n");
}

// ── Legacy Text Extraction (from raw items) ────────────────

/**
 * Extract text from PDF page items preserving line breaks.
 * Groups items by Y coordinate (with tolerance) then sorts by X.
 */
export function extractTextPreservingLines(items: TextItem[], yTolerance = 2.5): string {
  if (!items || items.length === 0) return "";

  const positioned = items
    .filter(it => it.str && it.str.trim() !== "")
    .map(it => {
      const tx = it.transform || [1, 0, 0, 1, 0, 0];
      return { str: it.str, x: tx[4] || 0, y: tx[5] || 0, width: it.width || 0 };
    });

  if (positioned.length === 0) return items.map(it => it.str).join(" ");

  positioned.sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > yTolerance) return yDiff;
    return a.x - b.x;
  });

  const lines: { y: number; items: typeof positioned }[] = [];
  for (const item of positioned) {
    const existing = lines.find(l => Math.abs(l.y - item.y) < yTolerance);
    if (existing) {
      existing.items.push(item);
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  lines.sort((a, b) => b.y - a.y);

  const textLines = lines.map(line => {
    line.items.sort((a, b) => a.x - b.x);
    let result = "";
    let lastEnd = 0;
    for (const item of line.items) {
      if (result.length > 0) {
        const gap = item.x - lastEnd;
        if (gap > 8) {
          result += "  ";
        } else if (gap > 1.5) {
          result += " ";
        }
      }
      result += item.str;
      lastEnd = item.x + (item.width || item.str.length * 5);
    }
    return result.trim();
  });

  return textLines.filter(l => l.length > 0).join("\n");
}

/**
 * Try extracting with a different Y tolerance.
 */
export function extractTextWithAlternativeTolerance(items: TextItem[]): string {
  return extractTextPreservingLines(items, 4);
}

// ── Money pattern ──────────────────────────────────────────

const MONEY_RE = /\d{1,3}(?:\.\d{3})*,\d{2}/g;

/**
 * Detect if extracted text has "glued lines" — a single line with
 * multiple monetary values that should be separate transactions.
 */
export function detectGluedLines(text: string): boolean {
  const lines = text.split("\n");
  let gluedCount = 0;
  for (const line of lines) {
    const moneyMatches = line.match(MONEY_RE);
    if (moneyMatches && moneyMatches.length >= 3) {
      gluedCount++;
    }
  }
  return gluedCount >= 1;
}

/**
 * Split glued lines that contain multiple transactions concatenated.
 */
export function splitGluedTransactionLines(text: string): string {
  const lines = text.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    const moneyMatches = line.match(MONEY_RE);
    if (moneyMatches && moneyMatches.length >= 2) {
      const split = line.replace(
        /(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{2}\/\d{2})\b/g,
        "$1\n$2"
      );
      if (split !== line) {
        result.push(...split.split("\n").map(s => s.trim()).filter(Boolean));
        continue;
      }

      const txPattern = /(\d{2}\/\d{2}\s+.+?\s+\d{1,3}(?:\.\d{3})*,\d{2})/g;
      const parts = line.match(txPattern);
      if (parts && parts.length > 1) {
        result.push(...parts.map(p => p.trim()));
        continue;
      }
    }
    result.push(line);
  }

  return result.join("\n");
}

/**
 * Force line breaks before each DD/MM date pattern found mid-text.
 */
export function splitByTransactionDate(text: string): string {
  let result = text;

  // Pattern 1: value followed by date
  result = result.replace(
    /(\d{1,3}(?:\.\d{3})*,\d{2})\s+(\d{2}\/\d{2})(?!\/\d)(\s)/g,
    "$1\n$2$3"
  );

  // Pattern 2: text followed by date
  result = result.replace(
    /([A-ZÀ-Ÿa-zà-ÿ]{2,})\s+(\d{2}\/\d{2})(?!\/\d)\s+([A-ZÀ-Ÿ])/g,
    "$1\n$2 $3"
  );

  // Pattern 3: 2-letter suffix + date
  result = result.replace(
    /(\s[A-Z]{2})\s+(\d{2}\/\d{2})(?!\/\d)\s/g,
    "$1\n$2 "
  );

  return result;
}

// ── Noise Removal ──────────────────────────────────────────

const NOISE_PATTERNS = [
  /^\s*0800/i,
  /autentica[çc][ãa]o\s*mec[âa]nica/i,
  /banco\s*ita[úu]\s*s\.?a\.?\s*341/i,
  /recibo\s*do\s*pagador/i,
  /ficha\s*de\s*compensa[çc][ãa]o/i,
  /teto\s*de\s*juros/i,
  /sac\s*ita[úu]/i,
  /ouvidoria\s*corporativa/i,
  /deficientes?\s*auditivos/i,
  /www\.itau/i,
  /www\.nubank/i,
  /cpf\/cnpj/i,
  /ag[êe]ncia.*conta/i,
  /^\s*p[áa]gina\s+\d/i,
  /^\s*\d+\s*\/\s*\d+\s*$/,
  /central\s*de\s*atendimento/i,
  /cart[ãa]o\s*de\s*cr[ée]dito\s*-\s*demonstrativo/i,
  /atendimento\s*especial/i,
  /impresso\s*em/i,
  /ligue\s*para/i,
  /^\s*ita[úu]\s*unibanco\s*s\.?a\.?\s*$/i,
  /^\s*PC\s*-/,
  /^\s*SAC\b/i,
  /atendimento\s+24h/i,
  /capita[il]\s+social/i,
  /^\s*CNPJ/i,
  /registro\s+de\s+correspondente/i,
  /segurança\s+do\s+seu\s+cartão/i,
  /caso\s+n[ãa]o\s+reconhe[çc]a/i,
  /em\s+caso\s+de\s+d[úu]vida/i,
];

export function stripCommonNoise(text: string): string {
  return text
    .split("\n")
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return false;
      return !NOISE_PATTERNS.some(p => p.test(trimmed));
    })
    .join("\n");
}

/**
 * More aggressive noise removal for retry scenarios.
 */
export function stripCommonNoiseAggressive(text: string): string {
  const basic = stripCommonNoise(text);
  const EXTRA_NOISE = [
    /boleto\s+banc[áa]rio/i,
    /instru[çc][õo]es\s+ao\s+caixa/i,
    /benefici[áa]rio/i,
    /sacado/i,
    /nosso\s+n[úu]mero/i,
    /c[óo]digo\s+de\s+barras/i,
    /refer[eê]ncia\s+\d/i,
    /simulad?[oa]/i,
    /parcelamento\s+de\s+fatura/i,
    /rotativo/i,
    /pagamento\s+m[ií]nimo/i,
    /limite\s+de\s+cr[ée]dito/i,
    /limite\s+dispon[ií]vel/i,
    /cr[ée]dito\s+rotativo/i,
    /encargos\s+financeiros/i,
    /previs[ãa]o\s+pr[oó]x/i,
  ];
  return basic
    .split("\n")
    .filter(line => {
      const trimmed = line.trim();
      if (trimmed.length < 5) return false;
      if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) return false;
      if (EXTRA_NOISE.some(p => p.test(trimmed))) return false;
      return true;
    })
    .join("\n");
}

/**
 * Strip noise from ExtractedRow[] (filters out entire rows matching noise).
 */
export function stripNoiseFromRows(rows: ExtractedRow[]): ExtractedRow[] {
  return rows.filter(row => {
    const lineText = row.cells.map(c => c.text).join(" ").trim();
    if (!lineText || lineText.length < 3) return false;
    return !NOISE_PATTERNS.some(p => p.test(lineText));
  });
}

/**
 * Full pre-processing pipeline: noise → glue detect → split.
 */
export function fullPreprocess(rawText: string): string {
  let text = stripCommonNoise(rawText);
  if (detectGluedLines(text)) {
    text = splitGluedTransactionLines(text);
  }
  text = splitByTransactionDate(text);
  return text;
}
