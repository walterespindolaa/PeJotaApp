/**
 * Security utilities for fatura processing
 * - Text sanitization (LGPD / anti-injection)
 * - File hash (SHA-256)
 * - Rate limiting helpers (DB-backed per-user)
 * - Fingerprint v2 (robust dedup)
 * - Idempotency key
 * - Integrity validation
 */

import { supabase } from "@/integrations/supabase/client";

// ─── Sanitization ───

/** Strip HTML tags, scripts, and suspicious content from extracted text */
export function sanitizeExtractedText(raw: string): string {
  let text = raw;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  text = text.replace(/javascript\s*:/gi, "");
  text = text.replace(/data\s*:[^,\s]+/gi, "");
  text = text.replace(/\s{4,}/g, "   ");
  return text;
}

/** Truncate text to a safe max length before sending to AI */
export function truncateForAI(text: string, maxChars = 15000): string {
  return text.slice(0, maxChars);
}

// ─── File Hash ───

/** Compute SHA-256 hash of an ArrayBuffer (for file dedup) */
export async function computeFileHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ─── PII Masking (LGPD) ───

/** Mask PII patterns (CPF, card numbers) from text before persisting */
export function maskPII(text: string): string {
  let masked = text;
  masked = masked.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "***.***.***-**");
  masked = masked.replace(/\b\d{11}\b/g, (match) => {
    const d = match.split("").map(Number);
    if (d[0] === d[1] && d[1] === d[2]) return match;
    return "***********";
  });
  masked = masked.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, "**** **** **** ****");
  masked = masked.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "***@***.***");
  return masked;
}

// ─── Rate Limiting (DB-backed, per-user) ───

function getMinuteKey(now: Date): string {
  return now.toISOString().slice(0, 16); // "2026-03-04T20:34"
}

function getDayKey(now: Date): string {
  return now.toISOString().slice(0, 10); // "2026-03-04"
}

export interface RateLimitResult {
  allowed: boolean;
  reason?: string;
  countToday: number;
  retryAfterSeconds?: number;
}

/**
 * Check and increment rate limit for a user.
 * kind: "upload" (5/min, 20/day) or "ai" (10/min, 50/day)
 */
export async function checkAndIncrementRateLimit(
  userId: string,
  kind: "upload" | "ai"
): Promise<RateLimitResult> {
  const now = new Date();
  const minuteKey = getMinuteKey(now);
  const dayKey = getDayKey(now);

  const maxPerMin = kind === "upload" ? 5 : 10;
  const maxPerDay = kind === "upload" ? 20 : 50;

  const minuteField = kind === "upload" ? "minute_key" : "ai_minute_key";
  const minuteCountField = kind === "upload" ? "minute_count" : "ai_minute_count";
  const dayField = kind === "upload" ? "day_key" : "ai_day_key";
  const dayCountField = kind === "upload" ? "day_count" : "ai_day_count";

  // Get or create record
  const { data: existing } = await supabase
    .from("user_rate_limits" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const row = existing as any;

  if (!row) {
    // First time — create
    const insertObj: any = {
      user_id: userId,
      [minuteField]: minuteKey,
      [minuteCountField]: 1,
      [dayField]: dayKey,
      [dayCountField]: 1,
      updated_at: now.toISOString(),
    };
    await supabase.from("user_rate_limits" as any).insert(insertObj);
    return { allowed: true, countToday: 1 };
  }

  // Calculate current counts
  let currentMinute = row[minuteField] === minuteKey ? (row[minuteCountField] || 0) : 0;
  let currentDay = row[dayField] === dayKey ? (row[dayCountField] || 0) : 0;

  // Check limits
  if (currentMinute >= maxPerMin) {
    const retryAfterSeconds = 60 - now.getSeconds();
    return {
      allowed: false,
      reason: `Limite de ${kind === "upload" ? "importação" : "IA"} atingido (${maxPerMin}/min). Tente novamente em ${retryAfterSeconds}s.`,
      countToday: currentDay,
      retryAfterSeconds,
    };
  }
  if (currentDay >= maxPerDay) {
    return {
      allowed: false,
      reason: `Limite diário de ${kind === "upload" ? "processamento" : "IA"} atingido (máximo ${maxPerDay}/${kind === "upload" ? "importações" : "chamadas"}/dia).`,
      countToday: currentDay,
      retryAfterSeconds: undefined,
    };
  }

  // Increment
  const updateObj: any = {
    [minuteField]: minuteKey,
    [minuteCountField]: (row[minuteField] === minuteKey ? currentMinute : 0) + 1,
    [dayField]: dayKey,
    [dayCountField]: (row[dayField] === dayKey ? currentDay : 0) + 1,
    updated_at: now.toISOString(),
  };
  await supabase.from("user_rate_limits" as any).update(updateObj).eq("user_id", userId);

  return { allowed: true, countToday: currentDay + 1 };
}

// Legacy check (kept for backward compat but prefer checkAndIncrementRateLimit)
export function checkRateLimit(logs: { created_at: string }[], maxPerMin = 5, maxPerDay = 20): RateLimitResult {
  const now = Date.now();
  const oneMinAgo = now - 60_000;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const inLastMinute = logs.filter(l => new Date(l.created_at).getTime() > oneMinAgo).length;
  const today = logs.filter(l => new Date(l.created_at) >= todayStart).length;
  if (inLastMinute >= maxPerMin) {
    return { allowed: false, reason: "Muitas importações em sequência. Aguarde um momento.", countToday: today };
  }
  if (today >= maxPerDay) {
    return { allowed: false, reason: "Limite diário de processamento atingido (máximo 20 importações/dia).", countToday: today };
  }
  return { allowed: true, countToday: today };
}

// ─── Fingerprint v1 (legacy) ───

export function generateStatementFingerprint(params: {
  userId: string;
  cardId: string | null;
  statementMonth: string;
  totalAmount: number;
  transactionsCount: number;
}): string {
  const raw = [
    params.userId, params.cardId || "no-card", params.statementMonth,
    params.totalAmount.toFixed(2), params.transactionsCount.toString(),
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `sf_${Math.abs(hash).toString(36)}`;
}

// ─── Fingerprint v2 (robust dedup with top5 signature) ───

export async function generateTop5Signature(
  transactions: { amount: number; purchase_date: string; merchant_norm?: string }[]
): Promise<string> {
  const sorted = [...transactions].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const raw = sorted.map(t => `${t.purchase_date}|${t.amount.toFixed(2)}|${(t.merchant_norm || "").toLowerCase().trim()}`).join("||");
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

export async function generateStatementFingerprintV2(params: {
  userId: string;
  cardId: string | null;
  statementMonth: string;
  totalAmount: number;
  transactionsCount: number;
  dueDate?: string | null;
  cardLast4?: string | null;
  currency?: string;
  top5Signature: string;
}): Promise<string> {
  const raw = [
    params.userId,
    params.cardId || "no-card",
    params.statementMonth,
    params.totalAmount.toFixed(2),
    params.transactionsCount.toString(),
    params.dueDate || "no-due",
    params.cardLast4 || "no-last4",
    params.currency || "BRL",
    params.top5Signature,
  ].join("|");
  const encoded = new TextEncoder().encode(raw);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return "sfv2_" + Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

// ─── Idempotency Key ───

export function generateIdempotencyKey(params: {
  userId: string;
  statementId: string;
  merchant: string;
  amount: number;
  date: string;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
}): string {
  const raw = [
    params.userId, params.statementId,
    (params.merchant || "").toLowerCase().trim(),
    params.amount.toFixed(2), params.date,
    params.installmentCurrent ?? 0, params.installmentTotal ?? 0,
  ].join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  return `ik_${Math.abs(hash).toString(36)}`;
}

// ─── Integrity Validation ───

export interface IntegrityIssue {
  lineIndex: number;
  field: string;
  reason: string;
}

export function validateLineIntegrity(line: {
  amount: number;
  purchase_date: string;
  installment_current?: number | null;
  installment_total?: number | null;
  category?: string | null;
}): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  if (line.amount <= 0) {
    issues.push({ lineIndex: 0, field: "amount", reason: "Valor deve ser positivo" });
  }
  const d = new Date(line.purchase_date);
  if (isNaN(d.getTime())) {
    issues.push({ lineIndex: 0, field: "purchase_date", reason: "Data inválida" });
  }
  if (line.installment_total && line.installment_current) {
    if (line.installment_current > line.installment_total) {
      issues.push({ lineIndex: 0, field: "installment", reason: "Parcela atual maior que total" });
    }
    if (line.installment_total < 2 || line.installment_total > 72) {
      issues.push({ lineIndex: 0, field: "installment", reason: "Total de parcelas fora do intervalo (2–72)" });
    }
  }
  return issues;
}
