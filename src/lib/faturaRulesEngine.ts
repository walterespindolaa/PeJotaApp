/**
 * Rules Engine — applies merchant_rules and pattern_rules before AI
 * to reduce cost and improve accuracy over time
 */

import { supabase } from "@/integrations/supabase/client";
import { normalizeMerchant, generateCacheFingerprint } from "./faturaProviders";

export interface MerchantRule {
  merchant_norm: string;
  category: string;
  type: string;
  recurring_default: boolean;
  confidence: number;
}

export interface PatternRule {
  pattern: string;
  category: string;
  type: string;
  confidence: number;
}

export interface TransactionInput {
  date: string;
  description: string;
  amount: number;
  parcela_atual?: number | null;
  parcelas_total?: number | null;
}

export interface ResolvedTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "fixa" | "variavel";
  recorrente: boolean;
  parcelado: boolean;
  parcela_atual: number | null;
  parcelas_total: number | null;
  merchant: string | null;
  confidence: number;
  origin: "rule" | "cache" | "ai";
  knownInstallment?: boolean;
  installmentFingerprint?: string;
}

export async function loadMerchantRules(userId: string): Promise<MerchantRule[]> {
  const { data } = await supabase
    .from("merchant_rules")
    .select("merchant_norm,category,type,recurring_default,confidence")
    .eq("user_id", userId) as any;
  return data || [];
}

export async function loadPatternRules(userId: string): Promise<PatternRule[]> {
  const { data } = await supabase
    .from("pattern_rules")
    .select("pattern,category,type,confidence")
    .eq("user_id", userId) as any;
  return data || [];
}

export async function loadAICache(userId: string): Promise<Map<string, any>> {
  const { data } = await supabase
    .from("ai_inference_cache")
    .select("fingerprint,result_json")
    .eq("user_id", userId) as any;
  const cache = new Map<string, any>();
  (data || []).forEach((row: any) => cache.set(row.fingerprint, row.result_json));
  return cache;
}

export async function saveAICache(userId: string, fingerprint: string, result: any, statementId?: string) {
  await (supabase.from("ai_inference_cache") as any).upsert(
    { user_id: userId, fingerprint, result_json: result, ...(statementId ? { statement_id: statementId } : {}) },
    { onConflict: "user_id,fingerprint" }
  );
}

export async function upsertMerchantRule(userId: string, merchantNorm: string, category: string, type: string, recurring: boolean) {
  await supabase.from("merchant_rules").upsert(
    {
      user_id: userId,
      merchant_norm: merchantNorm,
      category,
      type,
      recurring_default: recurring,
      confidence: 1,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,merchant_norm" }
  ) as any;
}

/** Detect installments in description */
function detectInstallment(desc: string): { parcelado: boolean; parcela_atual: number | null; parcelas_total: number | null } {
  // "02/10", "3/12", "PARC 02/10"
  const m = desc.match(/(\d{1,2})\s*[/x]\s*(\d{1,2})/i);
  if (m) {
    const atual = parseInt(m[1]);
    const total = parseInt(m[2]);
    if (total >= 2 && total <= 72 && atual >= 1 && atual <= total) {
      return { parcelado: true, parcela_atual: atual, parcelas_total: total };
    }
  }
  if (/PARC/i.test(desc)) {
    return { parcelado: true, parcela_atual: null, parcelas_total: null };
  }
  return { parcelado: false, parcela_atual: null, parcelas_total: null };
}

export interface RulesEngineResult {
  resolved: ResolvedTransaction[];
  unresolved: TransactionInput[];
  stats: {
    byRules: number;
    byCache: number;
    toAI: number;
  };
}

export async function applyRulesEngine(
  userId: string,
  transactions: TransactionInput[]
): Promise<RulesEngineResult> {
  const [merchantRules, patternRules, cache] = await Promise.all([
    loadMerchantRules(userId),
    loadPatternRules(userId),
    loadAICache(userId),
  ]);

  const resolved: ResolvedTransaction[] = [];
  const unresolved: TransactionInput[] = [];
  let byRules = 0, byCache = 0;

  for (const tx of transactions) {
    const merchantNorm = normalizeMerchant(tx.description);
    const installment = detectInstallment(tx.description);

    // 1. Try merchant rules
    const merchantRule = merchantRules.find(r => r.merchant_norm === merchantNorm);
    if (merchantRule && merchantRule.confidence >= 0.5) {
      resolved.push({
        ...tx,
        category: merchantRule.category,
        type: merchantRule.type as "fixa" | "variavel",
        recorrente: merchantRule.recurring_default,
        ...installment,
        merchant: merchantNorm,
        confidence: Math.min(merchantRule.confidence, 0.95),
        origin: "rule",
      });
      byRules++;
      continue;
    }

    // 2. Try pattern rules
    const patternRule = patternRules.find(r => {
      try {
        return tx.description.toUpperCase().includes(r.pattern.toUpperCase());
      } catch { return false; }
    });
    if (patternRule && patternRule.confidence >= 0.4) {
      resolved.push({
        ...tx,
        category: patternRule.category,
        type: patternRule.type as "fixa" | "variavel",
        recorrente: false,
        ...installment,
        merchant: merchantNorm,
        confidence: Math.min(patternRule.confidence, 0.85),
        origin: "rule",
      });
      byRules++;
      continue;
    }

    // 3. Try AI cache
    const cacheKey = generateCacheFingerprint(merchantNorm, tx.amount, tx.description.toUpperCase());
    const cached = cache.get(cacheKey);
    if (cached) {
      resolved.push({
        ...tx,
        ...cached,
        ...installment,
        merchant: merchantNorm,
        origin: "cache",
      });
      byCache++;
      continue;
    }

    // 4. Unresolved → needs AI
    unresolved.push(tx);
  }

  return {
    resolved,
    unresolved,
    stats: { byRules, byCache, toAI: unresolved.length },
  };
}
