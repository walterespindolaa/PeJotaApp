import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Upload, Check, FileText, Lock, CreditCard, Download } from "lucide-react";
import { detectAndParse, detectAndParseFromRows, normalizeMerchant, generateInstallmentFingerprint, generateCacheFingerprint, sanityCheckStatement, heuristicCategorize, type SanityLevel } from "@/lib/faturaProviders";
import { extractPdfToRows, rowsToText, extractTextPreservingLines, stripCommonNoise, stripCommonNoiseAggressive, detectGluedLines, splitGluedTransactionLines, splitByTransactionDate, stripNoiseFromRows, fullPreprocess } from "@/lib/pdfTextLayout";
import { applyRulesEngine, saveAICache, type ResolvedTransaction, type TransactionInput } from "@/lib/faturaRulesEngine";
import {
  sanitizeExtractedText, truncateForAI, computeFileHash, validateLineIntegrity,
  checkAndIncrementRateLimit, generateStatementFingerprintV2, generateTop5Signature,
  generateIdempotencyKey, maskPII,
} from "@/lib/faturaSecurity";
import FaturaCardSelector from "./FaturaCardSelector";
import { Checkbox } from "@/components/ui/checkbox";
import { useUserRole } from "@/hooks/useUserRole";
import { logError, logWarn } from "@/lib/log";

type ProcessingStep = "idle" | "reading" | "detecting" | "rules" | "classifying" | "reconciling" | "preparing" | "done";

const STEP_LABELS: Record<ProcessingStep, string> = {
  idle: "", reading: "Lendo PDF…", detecting: "Detectando banco e layout…",
  rules: "Aplicando regras aprendidas…", classifying: "Classificando com IA (somente pendentes)…",
  reconciling: "Reconciliando parcelamentos…", preparing: "Preparando revisão…", done: "Pronto!",
};
const ORDERED_STEPS: ProcessingStep[] = ["reading", "detecting", "rules", "classifying", "reconciling", "preparing"];

const SUBSCRIPTION_PATTERNS = [
  "NETFLIX", "SPOTIFY", "ICLOUD", "APPLE.COM", "PRIME VIDEO", "AMAZON PRIME",
  "DISNEY", "HBO", "GOOGLE STORAGE", "GOOGLE ONE", "MICROSOFT", "ADOBE",
  "DROPBOX", "YOUTUBE", "DEEZER", "GLOBOPLAY", "PARAMOUNT", "STAR+",
  "CRUNCHYROLL", "CHATGPT", "OPENAI", "NOTION", "FIGMA", "CANVA",
  "ACADEMIA", "SMART FIT", "BLU FIT",
];

function isSubscription(desc: string): boolean {
  const upper = desc.toUpperCase();
  return SUBSCRIPTION_PATTERNS.some(p => upper.includes(p));
}

export interface StatementLine {
  line_index: number;
  raw_text: string;
  purchase_date: string;
  merchant_raw: string;
  merchant_norm: string;
  amount: number;
  category: string | null;
  expense_type: string | null;
  recurring: boolean;
  installment_total: number | null;
  installment_current: number | null;
  fingerprint: string | null;
  status: string;
  confidence: number;
  origin: string;
  knownInstallment?: boolean;
  keepAsIs?: boolean;
  isDuplicate?: boolean;
  installmentFingerprint?: string;
  idempotencyKey?: string;
}

export interface ImportResult {
  statementId: string;
  lines: StatementLine[];
  stats: {
    total: number; byRules: number; byCache: number; byAI: number;
    provider: string; bank?: string; estimatedTokens: number; processingMs: number;
  };
}

interface Props {
  onImportComplete: (result: ImportResult) => void;
}

// ── Helper: extract text from PDF items with full preprocessing pipeline ──
function extractAndPreprocess(allPageItems: any[][], tolerance: number): string {
  const pages = allPageItems.map(items => extractTextPreservingLines(items as any, tolerance));
  let raw = pages.join("\n\n");
  raw = stripCommonNoise(raw);
  if (detectGluedLines(raw)) {
    raw = splitGluedTransactionLines(raw);
  }
  raw = splitByTransactionDate(raw);
  return raw;
}

// ── Helper: score a parse result for dual-tolerance comparison ──
function scoreParse(result: ReturnType<typeof detectAndParse>): number {
  const sanity = sanityCheckStatement(result.transactions, result.statementTotal);
  const mismatch = sanity.details?.mismatchPct ?? 1;
  return result.transactions.length * (1 - Math.min(mismatch, 1));
}

export default function FaturaImportTab({ onImportComplete }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [statementMonth, setStatementMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [step, setStep] = useState<ProcessingStep>("idle");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [pdfPassword, setPdfPassword] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [lgpdConsent, setLgpdConsent] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProcessing = step !== "idle" && step !== "done";

  // --- DB-BACKED RATE LIMIT ---
  const checkRateLimits = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const result = await checkAndIncrementRateLimit(user.id, "upload");
    if (!result.allowed) {
      toast({
        title: "Limite de importação atingido",
        description: result.retryAfterSeconds
          ? `Para sua segurança, limitamos imports em alta frequência. Tente novamente em ${result.retryAfterSeconds}s. (${result.countToday}/20 do dia)`
          : `${result.reason} (${result.countToday}/20 do dia)`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  }, [user]);

  // --- FILE HASH DEDUP CHECK ---
  const checkFileHashDuplicate = useCallback(async (hash: string): Promise<boolean> => {
    if (!user) return false;
    const { data } = await supabase.from("credit_card_statements" as any)
      .select("id,statement_month,status")
      .eq("user_id", user.id).eq("file_hash", hash).limit(1);
    if (data && (data as any[]).length > 0) {
      const existing = (data as any[])[0];
      toast({
        title: "Fatura já importada",
        description: `Esta fatura já foi importada anteriormente (mês ${existing.statement_month}, status: ${existing.status}). Selecione-a no Histórico.`,
        variant: "destructive",
      });
      return true;
    }
    return false;
  }, [user]);

  // --- FINGERPRINT V2 DEDUP CHECK ---
  const checkFingerprintV2Duplicate = useCallback(async (fpv2: string): Promise<string | null> => {
    if (!user) return null;
    const { data } = await supabase.from("credit_card_statements" as any)
      .select("id,statement_month,status")
      .eq("user_id", user.id).eq("statement_fingerprint_v2", fpv2).limit(1);
    if (data && (data as any[]).length > 0) {
      const existing = (data as any[])[0];
      toast({
        title: "Fatura duplicada detectada",
        description: `Uma fatura com dados idênticos já existe (mês ${existing.statement_month}). Abra-a no Histórico.`,
        variant: "destructive",
      });
      return existing.id;
    }
    return null;
  }, [user]);

  const checkDuplicates = useCallback(async (items: StatementLine[]) => {
    if (!user) return items;
    const { data: existing } = await supabase.from("despesas").select("descricao,valor,data").eq("user_id", user.id).eq("mes_referencia", statementMonth);
    if (!existing?.length) return items;
    return items.map(item => {
      const isDup = existing.some(e => e.valor === item.amount && e.data === item.purchase_date && (e.descricao || "").toLowerCase().includes((item.merchant_raw || "").toLowerCase().slice(0, 15)));
      return { ...item, isDuplicate: isDup };
    });
  }, [user, statementMonth]);

  const reconcileInstallments = useCallback(async (items: StatementLine[]): Promise<StatementLine[]> => {
    if (!user) return items;
    const { data: existing } = await supabase.from("credit_card_installments" as any).select("fingerprint,merchant,total_installments,started_at,last_seen_at").eq("user_id", user.id).eq("status", "active");
    const rows = (existing || []) as any[];
    const knownMap = new Map(rows.map((e: any) => [e.fingerprint, e]));
    return items.map(item => {
      if (!item.installment_total) return item;
      const fp = generateInstallmentFingerprint(item.merchant_norm || "", item.amount, item.installment_total);
      const known = knownMap.get(fp);
      if (known) {
        const sp = known.started_at.split("-"); const cp = statementMonth.split("-");
        const diff = (parseInt(cp[0]) - parseInt(sp[0])) * 12 + (parseInt(cp[1]) - parseInt(sp[1]));
        return { ...item, knownInstallment: true, keepAsIs: true, installment_current: Math.min(diff + 1, item.installment_total || 99), installmentFingerprint: fp };
      }
      return { ...item, installmentFingerprint: fp };
    });
  }, [user, statementMonth]);

  // --- AUDIT HELPER ---
  const logAudit = useCallback(async (statementId: string, eventType: string, detail: any) => {
    if (!user) return;
    await supabase.from("credit_card_audit_events" as any).insert({
      statement_id: statementId, user_id: user.id, event_type: eventType, detail,
    } as any);
  }, [user]);

  const runPipeline = useCallback(async (pdfText: string, file: File, fileHash: string, winnerTolerance?: string, extractionMeta?: { textItems: number; annotationItems: number; totalRows: number }) => {
    const startTime = Date.now();

    const sanitized = maskPII(sanitizeExtractedText(pdfText));
    if (!sanitized.trim()) {
      toast({ title: "Arquivo vazio ou conteúdo ilegível após sanitização", variant: "destructive" });
      setStep("idle"); return;
    }

    setStep("detecting");
    const providerResult = detectAndParse(sanitized, statementMonth);
    let transactions = providerResult.transactions;
    const detectedBank = providerResult.bank;
    const detectedTotal = providerResult.statementTotal;
    const detectedDueDate = providerResult.dueDate;

    // --- 3-Layer Sanity Check ---
    let sanity = sanityCheckStatement(transactions, detectedTotal);
    let usedAiFallback = false;
    let lowConfidenceMode = false;

    if (sanity.level === "low_confidence") {
      lowConfidenceMode = true;
      logWarn("[fatura] Low confidence:", sanity.reasonCode, sanity.reason);
    }

    const needsFallback = sanity.level === "blocked" ||
      transactions.length < 10 ||
      (providerResult.parserConfidence !== undefined && providerResult.parserConfidence < 0.4) ||
      providerResult.partial;

    if (needsFallback && sanitized.length > 100) {
      // --- Retry #1: Aggressive noise removal + reparse ---
      if (sanity.level === "blocked" || transactions.length < 10) {
        const aggressiveCleaned = stripCommonNoiseAggressive(sanitized);
        const resplit = splitByTransactionDate(
          detectGluedLines(aggressiveCleaned)
            ? splitGluedTransactionLines(aggressiveCleaned)
            : aggressiveCleaned
        );
        const retryResult = detectAndParse(resplit, statementMonth);
        if (retryResult.transactions.length > transactions.length) {
          transactions = retryResult.transactions;
          sanity = sanityCheckStatement(transactions, detectedTotal);
          if (sanity.level === "ok" || sanity.level === "low_confidence") {
            lowConfidenceMode = sanity.level === "low_confidence";
          }
        }
      }

      // --- Retry #2: AI Extraction Fallback ---
      if ((sanity.level === "blocked" || transactions.length < 10) && sanitized.length > 100) {
        setStep("classifying");
        try {
          const truncated = truncateForAI(sanitized, 12000);
          const { data, error } = await supabase.functions.invoke("ai-extract-transactions-from-text", {
            body: {
              text: truncated,
              year: statementMonth.split("-")[0],
              bankHint: detectedBank || providerResult.provider,
              maxTxns: 60,
            }
          });
          if (!error && data?.transactions && data.transactions.length > transactions.length) {
            usedAiFallback = true;
            transactions = data.transactions.map((t: any) => ({
              date: t.date, description: t.description, amount: t.amount,
              installment_current: t.installment_current, installment_total: t.installment_total,
            }));
            sanity = sanityCheckStatement(transactions, detectedTotal);
            if (sanity.level === "blocked" && transactions.length < 3) {
              toast({
                title: "Falha de leitura",
                description: "PDF pode estar com layout protegido/colado. Tente baixar novamente (imprimir > salvar PDF) ou enviar CSV.",
                variant: "destructive",
              });
              setStep("idle"); return;
            }
            if (transactions.length >= 10) {
              lowConfidenceMode = true;
              sanity = { ...sanity, valid: true, level: "low_confidence" };
            }
          }
        } catch (e: any) {
          logError("[fatura] AI fallback failed:", e);
        }
      }

      if (sanity.level === "blocked" && transactions.length < 3) {
        toast({
          title: "Falha de leitura",
          description: sanity.reason || "PDF pode estar com layout protegido. Tente 'Imprimir > Salvar em PDF' ou enviar CSV.",
          variant: "destructive",
        });
        setStep("idle"); return;
      }
      if (sanity.level === "blocked" && transactions.length >= 3) {
        lowConfidenceMode = true;
      }
    }

    if (sanity.suspiciousLines) {
      for (const idx of sanity.suspiciousLines) {
        if (transactions[idx]) (transactions[idx] as any)._suspicious = true;
      }
    }

    // --- Fingerprint v2 dedup ---
    const top5sig = await generateTop5Signature(
      transactions.map(t => ({ amount: t.amount, purchase_date: t.date, merchant_norm: normalizeMerchant(t.description) }))
    );
    const totalAmount = transactions.reduce((s, t) => s + t.amount, 0);
    const fpv2 = await generateStatementFingerprintV2({
      userId: user!.id, cardId: selectedCardId, statementMonth,
      totalAmount, transactionsCount: transactions.length,
      top5Signature: top5sig, dueDate: detectedDueDate,
    });
    const existingId = await checkFingerprintV2Duplicate(fpv2);
    if (existingId) { setStep("idle"); return; }

    // Create statement record
    const { data: stmt, error: stmtErr } = await supabase.from("credit_card_statements" as any).insert({
      user_id: user!.id, statement_month: statementMonth, source_name: detectedBank || providerResult.provider,
      provider: providerResult.provider, source_label: detectedBank || providerResult.provider,
      file_path: `${user!.id}/${file.name}`, file_hash: fileHash,
      status: "parsing", total_items: transactions.length,
      card_id: selectedCardId || null, parsed_items_count: transactions.length,
      statement_fingerprint_v2: fpv2, top5_signature: top5sig,
      due_date: detectedDueDate || null,
      total_amount: totalAmount,
    } as any).select("id").single();
    if (stmtErr || !stmt) {
      toast({ title: "Erro ao criar registro", variant: "destructive" }); setStep("idle"); return;
    }
    const statementId = (stmt as any).id;

    await logAudit(statementId, "statement_uploaded", { fileName: file.name, fileHash, sizeBytes: file.size });

    await supabase.storage.from("faturas").upload(`${user!.id}/${statementId}_${file.name}`, file, { upsert: true });
    await logAudit(statementId, "provider_detected", {
      provider: providerResult.provider, bank: detectedBank, score: providerResult.score,
      raw_count: transactions.length, parserConfidence: providerResult.parserConfidence,
      statementTotal: detectedTotal, dueDate: detectedDueDate,
      sanity: sanity.details, sanityLevel: sanity.level,
      usedAiFallback, lowConfidenceMode, winnerTolerance,
      extractionMeta,
    });

    if (!transactions.length) {
      toast({ title: "Nenhuma transação encontrada", description: "Não foi possível processar a fatura. Tente outro formato.", variant: "destructive" });
      await supabase.from("credit_card_statements" as any).update({ status: "failed" } as any).eq("id", statementId);
      await logAudit(statementId, "parser_error", { reason: "zero_transactions" });
      setStep("idle"); return;
    }

    await logAudit(statementId, "parser_completed", { count: transactions.length });

    setStep("rules");
    const txAsInput: TransactionInput[] = transactions.map(t => ({
      date: t.date, description: t.description, amount: t.amount,
      parcela_atual: t.installment_current ?? null,
      parcelas_total: t.installment_total ?? null,
    }));
    let rulesResult: Awaited<ReturnType<typeof applyRulesEngine>>;
    try {
      rulesResult = await applyRulesEngine(user!.id, txAsInput);
    } catch (e: any) {
      logError("Rules engine error:", e);
      await logAudit(statementId, "rules_error", { error: e.message });
      toast({ title: "Erro nas regras", description: "Algumas transações podem precisar revisão manual.", variant: "destructive" });
      rulesResult = { resolved: [], unresolved: txAsInput, stats: { byRules: 0, byCache: 0, toAI: txAsInput.length } };
    }

    await logAudit(statementId, "rules_applied", { by_rules: rulesResult.stats.byRules, by_cache: rulesResult.stats.byCache, to_ai: rulesResult.stats.toAI });

    let aiItems: ResolvedTransaction[] = [];
    let estimatedTokens = 0;
    let aiCalls = 0;

    if (rulesResult.unresolved.length > 0) {
      setStep("classifying");

      const aiRateCheck = await checkAndIncrementRateLimit(user!.id, "ai");
      if (!aiRateCheck.allowed) {
        await logAudit(statementId, "rate_limited", { type: "ai", reason: aiRateCheck.reason });
        toast({ title: "Limite de IA atingido", description: aiRateCheck.reason, variant: "destructive" });
      } else {
        const batches: TransactionInput[][] = [];
        for (let i = 0; i < rulesResult.unresolved.length; i += 100) batches.push(rulesResult.unresolved.slice(i, i + 100));

        for (const batch of batches) {
          aiCalls++;
          try {
            const { data, error } = await supabase.functions.invoke("ai-categorize-transactions", { body: { source: "fatura_cartao", statement_month: statementMonth, rows: batch } });
            if (error) throw error;
            if (data?.error) throw new Error(data.error);
            const items = (data.items || []).map((it: any) => ({ ...it, origin: "ai" as const, merchant: it.merchant || normalizeMerchant(it.description) }));
            aiItems.push(...items);
            estimatedTokens += data._meta?.estimated_tokens || 0;
            for (const it of items) {
              const fp = generateCacheFingerprint(normalizeMerchant(it.description), it.amount, it.description.toUpperCase());
              await saveAICache(user!.id, fp, { category: it.category, type: it.type, recorrente: it.recorrente, confidence: it.confidence }, statementId);
            }
          } catch (e: any) {
            logError("AI categorization error:", e);
            await logAudit(statementId, "ai_error", { step: "categorize", error: e.message, batchSize: batch.length });
            toast({ title: "Erro parcial na classificação", description: "Algumas transações podem precisar revisão manual." });
          }
        }
        if (aiCalls > 0) {
          await logAudit(statementId, "ai_called", { count: aiItems.length, tokens: estimatedTokens, calls: aiCalls });
        }
      }
    }

    // Build lines
    const allLines: StatementLine[] = [
      ...rulesResult.resolved.map((r, i) => {
        const isSub = isSubscription(r.description);
        const ikKey = generateIdempotencyKey({
          userId: user!.id, statementId, merchant: normalizeMerchant(r.description),
          amount: r.amount, date: r.date, installmentCurrent: r.parcela_atual, installmentTotal: r.parcelas_total,
        });
        return {
          line_index: i, raw_text: (r.description || "").slice(0, 500), purchase_date: r.date, merchant_raw: r.description,
          merchant_norm: r.merchant || normalizeMerchant(r.description), amount: r.amount,
          category: isSub && !r.category ? "Assinaturas" : r.category, expense_type: r.type,
          recurring: isSub ? true : r.recorrente,
          installment_total: r.parcelas_total, installment_current: r.parcela_atual,
          fingerprint: generateCacheFingerprint(normalizeMerchant(r.description), r.amount, r.description.toUpperCase()),
          status: "ready", confidence: r.confidence, origin: r.origin,
          idempotencyKey: ikKey,
        };
      }),
      ...aiItems.map((a, i) => {
        const isSub = isSubscription(a.description);
        const ikKey = generateIdempotencyKey({
          userId: user!.id, statementId, merchant: normalizeMerchant(a.description),
          amount: a.amount, date: a.date, installmentCurrent: a.parcela_atual, installmentTotal: a.parcelas_total,
        });
        return {
          line_index: rulesResult.resolved.length + i, raw_text: (a.description || "").slice(0, 500), purchase_date: a.date, merchant_raw: a.description,
          merchant_norm: a.merchant || normalizeMerchant(a.description), amount: a.amount,
          category: isSub && !a.category ? "Assinaturas" : a.category, expense_type: a.type,
          recurring: isSub ? true : a.recorrente,
          installment_total: a.parcelas_total, installment_current: a.parcela_atual,
          fingerprint: generateCacheFingerprint(normalizeMerchant(a.description), a.amount, a.description.toUpperCase()),
          status: "pending_review", confidence: a.confidence, origin: a.origin || "ai",
          idempotencyKey: ikKey,
        };
      }),
    ];

    // Unresolved items not sent to AI
    if (rulesResult.unresolved.length > 0 && aiItems.length === 0 && aiCalls === 0) {
      rulesResult.unresolved.forEach((u, i) => {
        const ikKey = generateIdempotencyKey({
          userId: user!.id, statementId, merchant: normalizeMerchant(u.description),
          amount: u.amount, date: u.date,
        });
        const heuristicCat = heuristicCategorize(u.description);
        allLines.push({
          line_index: allLines.length, raw_text: (u.description || "").slice(0, 500),
          purchase_date: u.date, merchant_raw: u.description,
          merchant_norm: normalizeMerchant(u.description), amount: u.amount,
          category: heuristicCat, expense_type: "variavel", recurring: isSubscription(u.description),
          installment_total: u.parcelas_total || null, installment_current: u.parcela_atual || null,
          fingerprint: null, status: heuristicCat ? "ready" : "pending_review",
          confidence: heuristicCat ? 0.6 : 0, origin: heuristicCat ? "heuristic" : "parser",
          idempotencyKey: ikKey,
        });
      });
    }

    // Integrity validation
    for (const line of allLines) {
      const issues = validateLineIntegrity(line);
      if (issues.length > 0 && line.status === "ready") {
        line.status = "pending_review";
        line.confidence = Math.min(line.confidence, 0.3);
      }
    }

    setStep("reconciling");
    const reconciled = await reconcileInstallments(allLines);
    setStep("preparing");
    const final = await checkDuplicates(reconciled);

    const processingMs = Date.now() - startTime;
    const installmentCount = final.filter(l => l.installment_total && l.installment_total > 1).length;
    const dupCount = final.filter(l => l.isDuplicate).length;

    if (dupCount > 0) {
      await logAudit(statementId, "duplicates_detected", { count: dupCount, method: "fingerprint_v2" });
    }

    // Save lines to DB
    const lineInserts = final.map(l => ({
      statement_id: statementId, user_id: user!.id, line_index: l.line_index,
      raw_text: (l.raw_text || "").slice(0, 300),
      description_raw: (l.merchant_raw || "").slice(0, 200),
      purchase_date: l.purchase_date, merchant_raw: (l.merchant_raw || "").slice(0, 200), merchant_norm: l.merchant_norm,
      amount: l.amount, category: l.category, expense_type: l.expense_type, recurring: l.recurring,
      installment_total: l.installment_total, installment_current: l.installment_current,
      fingerprint: l.fingerprint, status: l.isDuplicate ? "duplicate" : l.status, confidence: l.confidence, origin: l.origin,
      idempotency_key: l.idempotencyKey || null,
    }));
    await supabase.from("credit_card_statement_lines" as any).insert(lineInserts as any);

    const totalAmountFinal = final.reduce((s, l) => s + l.amount, 0);
    const statementStatus = lowConfidenceMode ? "reviewing_low_confidence" : "reviewing";
    await supabase.from("credit_card_statements" as any).update({
      status: statementStatus, total_amount: totalAmountFinal, total_items: final.length,
      detected_installments: installmentCount, duplicates_skipped: dupCount,
      tokens_in: estimatedTokens, ai_calls: aiCalls, estimated_cost_usd: estimatedTokens * 0.00015 / 1000,
      rule_items_count: rulesResult.stats.byRules, cache_items_count: rulesResult.stats.byCache,
      ai_items_count: aiItems.length, latency_ms: processingMs,
      due_date: detectedDueDate || null,
    } as any).eq("id", statementId);

    await supabase.from("fatura_import_logs").insert({
      user_id: user!.id, file_name: file.name, provider_used: providerResult.provider,
      total_transactions: final.length, resolved_by_rules: rulesResult.stats.byRules,
      resolved_by_cache: rulesResult.stats.byCache, sent_to_ai: aiItems.length,
      ai_fallback_used: usedAiFallback,
      estimated_tokens: estimatedTokens, processing_ms: processingMs,
    } as any);

    setStep("done");
    if (lowConfidenceMode) {
      toast({ title: `${final.length} transações processadas`, description: "Leitura parcial detectada — revise as transações antes de aplicar.", variant: "default" });
    } else {
      toast({ title: `${final.length} transações processadas` });
    }

    onImportComplete({
      statementId, lines: final,
      stats: { total: final.length, byRules: rulesResult.stats.byRules, byCache: rulesResult.stats.byCache, byAI: aiItems.length, provider: providerResult.provider, bank: detectedBank, estimatedTokens, processingMs },
    });
  }, [user, statementMonth, selectedCardId, checkDuplicates, reconcileInstallments, onImportComplete, logAudit, checkFingerprintV2Duplicate]);

  const handleFileSelect = useCallback(async (file: File, password?: string) => {
    if (!file || !user) return;

    // File size validation: max 10MB
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      toast({ title: "Arquivo muito grande", description: `O arquivo tem ${(file.size / 1024 / 1024).toFixed(1)} MB. O limite maximo e 10 MB.`, variant: "destructive" });
      return;
    }

    // File type validation: only PDF, CSV, TXT
    const validTypes = ["application/pdf", "text/csv", "text/plain"];
    const validExtensions = [".pdf", ".csv", ".txt"];
    const hasValidType = validTypes.includes(file.type) || validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    if (!hasValidType) {
      toast({ title: "Tipo de arquivo invalido", description: "Apenas arquivos PDF, CSV ou TXT sao aceitos.", variant: "destructive" });
      return;
    }

    if (!lgpdConsent) {
      toast({ title: "Consentimento necessario", description: "Autorize o processamento da fatura antes de importar.", variant: "destructive" });
      return;
    }

    const allowed = await checkRateLimits();
    if (!allowed) return;

    setFileName(file.name); setStep("reading");
    setDebugData(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const fileHash = await computeFileHash(arrayBuffer);

      const isDup = await checkFileHashDuplicate(fileHash);
      if (isDup) { setStep("idle"); return; }

      let text: string;
      let winnerTolerance = "text";
      let extractionMeta: { textItems: number; annotationItems: number; totalRows: number } | undefined;

      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs" as any);
        pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs";
        try {
          const params: any = { data: arrayBuffer }; if (password) params.password = password;
          const pdf = await pdfjsLib.getDocument(params).promise;

          // ═══ LAYER 1: Hybrid extraction (text + annotations) ═══
          const { rows: rawRows, textItemCount, annotationItemCount } = await extractPdfToRows(pdf, 2.5);
          const cleanedRows = stripNoiseFromRows(rawRows);
          extractionMeta = { textItems: textItemCount, annotationItems: annotationItemCount, totalRows: cleanedRows.length };

          // Try row-based parsing first (column-aware for Itaú with annotations)
          const rowText = rowsToText(cleanedRows);
          const rowResult = detectAndParseFromRows(cleanedRows, rowText, statementMonth);

          let bestTransactions = rowResult.transactions;
          let bestProvider = rowResult.provider;
          let bestTotal = rowResult.statementTotal;
          let bestDueDate = rowResult.dueDate;

          // ═══ LAYER 2: Legacy text-based with dual tolerance ═══
          // Collect raw items for legacy path
          const allPageItems: any[][] = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const p = await pdf.getPage(i);
            const c = await p.getTextContent();
            allPageItems.push(c.items);
          }

          const text2px = extractAndPreprocess(allPageItems, 2);
          const text4px = extractAndPreprocess(allPageItems, 4);

          const result2 = detectAndParse(text2px, statementMonth);
          const result4 = detectAndParse(text4px, statementMonth);

          const s2 = scoreParse(result2);
          const s4 = scoreParse(result4);

          const textWinner = s4 > s2 ? result4 : result2;
          const textWinnerTolerance = s4 > s2 ? "4px" : "2px";
          const textWinnerText = s4 > s2 ? text4px : text2px;

          // Compare row-based vs text-based: pick the one with more transactions
          const rowScore = bestTransactions.length > 0
            ? scoreParse({ ...rowResult, transactions: bestTransactions })
            : 0;
          const textScore = scoreParse(textWinner);

          let winnerPipeline: string;
          let winnerReason: string;

          if (rowScore > textScore && bestTransactions.length >= 3) {
            text = rowText;
            winnerTolerance = "rows_hybrid";
            winnerPipeline = "rows";
            winnerReason = `row_score(${rowScore.toFixed(1)}) > text_score(${textScore.toFixed(1)}) & ${bestTransactions.length}tx >= 3`;
          } else {
            text = textWinnerText;
            winnerTolerance = textWinnerTolerance;
            winnerPipeline = "legacy_text";
            winnerReason = `text_score(${textScore.toFixed(1)}) >= row_score(${rowScore.toFixed(1)}) | tolerance=${textWinnerTolerance}`;
          }

          // ═══ STRUCTURED DIAGNOSTIC LOG ═══
          const rowSanity = sanityCheckStatement(bestTransactions, bestTotal);
          const textSanity = sanityCheckStatement(textWinner.transactions, textWinner.statementTotal);

          // Build debug data for admin export
          const debugPayload = {
            timestamp: new Date().toISOString(),
            pdf_pages: pdf.numPages,
            extractionMeta,
            rows: cleanedRows.slice(0, 200).map(r => ({ y: r.y, cells: r.cells.map(c => ({ x: Math.round(c.x), text: c.text, w: Math.round(c.width), source: c.source })) })),
            rowParse: { provider: bestProvider, txCount: bestTransactions.length, total: bestTotal, dueDate: bestDueDate, transactions: bestTransactions, sanity: rowSanity },
            textParse: { provider: textWinner.provider, txCount: textWinner.transactions.length, total: textWinner.statementTotal, tolerance: textWinnerTolerance, transactions: textWinner.transactions, sanity: textSanity },
            winner: { pipeline: winnerPipeline, reason: winnerReason, tolerance: winnerTolerance },
          };
          if (isAdmin) {
            setDebugData(debugPayload);
          }
        } catch (err: any) {
          if (err?.name === "PasswordException" || err?.message?.includes("password")) {
            setPendingFile(file); setPasswordModal(true); setStep("idle"); return;
          }
          throw err;
        }
      } else {
        const decoder = new TextDecoder();
        text = decoder.decode(arrayBuffer);
      }

      if (!text.trim()) { toast({ title: "Arquivo vazio ou ilegível", variant: "destructive" }); setStep("idle"); return; }
      await runPipeline(text, file, fileHash, winnerTolerance, extractionMeta);
    } catch (e: any) {
      logError(e);
      toast({ title: "Erro ao processar arquivo", description: "Não foi possível processar completamente a fatura. Algumas transações podem precisar revisão manual.", variant: "destructive" });
      setStep("idle");
    }
  }, [user, lgpdConsent, runPipeline, checkRateLimits, checkFileHashDuplicate, statementMonth, isAdmin]);

  const handlePasswordSubmit = () => {
    setPasswordModal(false);
    if (pendingFile) { handleFileSelect(pendingFile, pdfPassword); setPdfPassword(""); setPendingFile(null); }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const downloadDebug = useCallback(() => {
    if (!debugData) return;
    const blob = new Blob([JSON.stringify(debugData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fatura-debug-${Date.now()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [debugData]);

  return (
    <div className="space-y-6">
      {step === "idle" && (
        <Card className="border-2 border-dashed border-border hover:border-primary/40 transition-colors">
          <CardContent className="py-12">
            <div className={`flex flex-col items-center gap-4 cursor-pointer transition-all ${dragOver ? "scale-105 opacity-80" : ""}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Upload className="h-8 w-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">Selecionar PDF da fatura</p>
                <p className="text-sm text-muted-foreground mt-1">ou arraste e solte aqui</p>
              </div>
              <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
                <Input type="month" value={statementMonth} onChange={e => setStatementMonth(e.target.value)} className="w-auto" />
                <FaturaCardSelector value={selectedCardId} onChange={setSelectedCardId} />
              </div>
              <p className="text-xs text-muted-foreground">PDF, CSV ou TXT • Itaú, Nubank, Mercado Pago e outros</p>
              <div className="flex items-start gap-2 mt-4 px-4" onClick={e => e.stopPropagation()}>
                <Checkbox id="lgpd-consent" checked={lgpdConsent} onCheckedChange={v => setLgpdConsent(!!v)} />
                <label htmlFor="lgpd-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                  Autorizo o Atlas a processar esta fatura para classificar transações financeiras. Nenhum dado pessoal será armazenado pela IA ou usado para treinamento.
                </label>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".pdf,.csv,.txt" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} />
          </CardContent>
        </Card>
      )}

      {step === "idle" && isAdmin && debugData && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={downloadDebug} className="gap-1.5 text-xs">
            <Download className="h-3.5 w-3.5" /> Baixar diagnóstico (admin)
          </Button>
        </div>
      )}

      {step === "idle" && !debugData && (
        <div className="text-center py-8">
          <CreditCard className="h-12 w-12 mx-auto mb-3 text-muted-foreground/20" />
          <p className="text-sm text-muted-foreground">Nenhuma fatura importada ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Envie sua primeira fatura para que o Atlas organize automaticamente suas despesas.
          </p>
        </div>
      )}

      {isProcessing && (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-6">
            <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-foreground">Atlas está analisando sua fatura…</p>
              <div className="flex flex-col gap-1.5 mt-4">
                {ORDERED_STEPS.map(s => {
                  const isActive = s === step;
                  const isPast = ORDERED_STEPS.indexOf(s) < ORDERED_STEPS.indexOf(step);
                  return (
                    <div key={s} className={`flex items-center gap-2 text-sm transition-all duration-300 ${isActive ? "text-primary font-medium" : isPast ? "text-muted-foreground line-through" : "text-muted-foreground/40"}`}>
                      {isActive && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      {isPast && <Check className="h-3.5 w-3.5 text-success" />}
                      {!isActive && !isPast && <div className="h-3.5 w-3.5 rounded-full border border-muted-foreground/20" />}
                      {STEP_LABELS[s]}
                    </div>
                  );
                })}
              </div>
            </div>
            {fileName && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded-lg">
                <FileText className="h-3.5 w-3.5" /> {fileName}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={passwordModal} onOpenChange={setPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> PDF Protegido por Senha</DialogTitle>
            <DialogDescription>Este PDF está protegido. Digite a senha para continuar.</DialogDescription>
          </DialogHeader>
          <Input type="password" placeholder="Senha do PDF" value={pdfPassword} onChange={e => setPdfPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && handlePasswordSubmit()} />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPasswordModal(false); setPdfPassword(""); setPendingFile(null); }}>Cancelar</Button>
            <Button onClick={handlePasswordSubmit} disabled={!pdfPassword}>Desbloquear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
