import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getLastDayOfMonth } from "../_shared/date-helpers.ts";

// ─── Notification Catalog (server-side mirror) ───
// Keep in sync with src/lib/notificationCatalog.ts

interface NotifDef {
  slug: string;
  block: string;
  priority: string;
  title: string;
  message: string;
  route: string;
  tag: string;
  active: boolean;
  cooldownHours: number;
  maxLifetimeSends: number | null;
  preferredHourStart: number;
  preferredHourEnd: number;
  allowedDaysOfWeek: number[] | null;
  preferenceCategory: string;
}

const CATALOG: NotifDef[] = [
  // ONBOARDING
  {
    slug: "onboarding_base_incompleta",
    block: "onboarding", priority: "medium",
    title: "Falta pouco pra concluir 🚧",
    message: "Mais alguns minutos no setup e seu Atlas começa a trabalhar pra você de verdade.",
    route: "/comece-por-aqui", tag: "onboarding",
    active: true, cooldownHours: 24 * 30, maxLifetimeSends: 1,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "onboarding",
  },
  {
    slug: "onboarding_objetivos",
    block: "onboarding", priority: "medium",
    title: "Cadê seus objetivos? 🎯",
    message: "Sem destino, todo caminho serve. Define os seus no Atlas.",
    route: "/dashboard/objetivos-de-vida", tag: "onboarding",
    active: true, cooldownHours: 24 * 7, maxLifetimeSends: 2,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "onboarding",
  },
  // HÁBITO
  {
    slug: "habito_revisao_semanal",
    block: "habito", priority: "low",
    title: "Bora revisar a semana? 📋",
    message: "2 minutos no Atlas e domingo de noite vira clareza pra próxima semana.",
    route: "/dashboard", tag: "habito-semanal",
    active: true, cooldownHours: 24 * 6, maxLifetimeSends: null,
    preferredHourStart: 19, preferredHourEnd: 20, allowedDaysOfWeek: [0],
    preferenceCategory: "lembretes",
  },
  {
    slug: "habito_pos_salario",
    block: "habito", priority: "medium",
    title: "Salário caiu 💰",
    message: "Hora de decidir o destino. Abre o Atlas antes de gastar no automático.",
    route: "/dashboard/renda-despesas", tag: "habito-salario",
    active: true, cooldownHours: 24 * 25, maxLifetimeSends: null,
    preferredHourStart: 18, preferredHourEnd: 20, allowedDaysOfWeek: null,
    preferenceCategory: "lembretes",
  },
  {
    slug: "habito_sem_gastos",
    block: "habito", priority: "low",
    title: "Faltam lançamentos da semana 📝",
    message: "Sem registrar, sem controle. 2 minutos no Atlas e tá feito.",
    route: "/dashboard/renda-despesas", tag: "habito-gastos",
    active: true, cooldownHours: 24 * 5, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "lembretes",
  },
  {
    slug: "habito_vencimento_fixa",
    block: "habito", priority: "high",
    title: "{descricao} vence em {dias} dias 📅",
    message: "Antes do vencimento, dá uma olhada e garante que tá tudo certo.",
    route: "/dashboard/renda-despesas", tag: "habito-vencimento",
    active: true, cooldownHours: 24, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "vencimentos",
  },
  {
    slug: "habito_inicio_mes",
    block: "habito", priority: "medium",
    title: "Mês novo, vida organizada 🗓️",
    message: "Antes da rotina pegar, atualiza o Atlas. 5 minutos e o mês começa redondo.",
    route: "/dashboard", tag: "habito-mes",
    active: true, cooldownHours: 24 * 28, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "lembretes",
  },
  // ALERTAS
  {
    slug: "alerta_orcamento_limite",
    block: "alerta", priority: "high",
    title: "Orçamento apertando ⚠️",
    message: "Você tá chegando no limite do mês. Vale revisar antes que estoure.",
    route: "/dashboard/renda-despesas", tag: "alerta-orcamento",
    active: true, cooldownHours: 24 * 7, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_categoria_fora_padrao",
    block: "alerta", priority: "medium",
    title: "Categoria fora do padrão 📊",
    message: "Seus gastos com {categoria} ficaram bem acima da média esse mês. Vale revisar.",
    route: "/dashboard/analises", tag: "alerta-categoria",
    active: true, cooldownHours: 24 * 28, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_planejamento_desatualizado",
    block: "alerta", priority: "medium",
    title: "Plano envelheceu? 🔄",
    message: "Tá um tempo sem atualizar. Dá uma olhada se ainda reflete sua vida.",
    route: "/dashboard", tag: "alerta-desatualizado",
    active: true, cooldownHours: 24 * 7, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_saldo_negativo",
    block: "alerta", priority: "high",
    title: "Saldo apertando ⚠️",
    message: "Continuando assim, o mês pode fechar negativo. Vale uma olhada agora.",
    route: "/dashboard/controledajornada", tag: "alerta-saldo",
    active: true, cooldownHours: 24 * 7, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_conta_importante",
    block: "alerta", priority: "high",
    title: "Conta grande no caminho 💸",
    message: "Tem uma despesa relevante chegando. Pode valer organizar o caixa antes.",
    route: "/dashboard/renda-despesas", tag: "alerta-conta-importante",
    active: true, cooldownHours: 24 * 7, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  {
    slug: "alerta_reserva_baixa",
    block: "alerta", priority: "medium",
    title: "Reserva precisa de reforço 💰",
    message: "Sua emergência tá abaixo do recomendado. Vale pensar em subir os aportes.",
    route: "/dashboard/investimentos", tag: "alerta-reserva",
    active: true, cooldownHours: 24 * 30, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "alertas",
  },
  // REATIVAÇÃO
  {
    slug: "reativacao_3_dias",
    block: "reativacao", priority: "low",
    title: "3 dias sem dar oi 👀",
    message: "Seu Atlas tá esperando. 5 minutos resolve a saudade.",
    route: "/dashboard", tag: "reativacao",
    active: true, cooldownHours: 24 * 14, maxLifetimeSends: 1,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  {
    slug: "reativacao_7_dias",
    block: "reativacao", priority: "medium",
    title: "Uma semana sem você 👋",
    message: "Plano só funciona com acompanhamento. Bora retomar?",
    route: "/dashboard", tag: "reativacao",
    active: true, cooldownHours: 24 * 14, maxLifetimeSends: 1,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  {
    slug: "reativacao_14_dias",
    block: "reativacao", priority: "medium",
    title: "Tá ficando longe... ⌛",
    message: "Cada semana sem dar uma olhada, mais difícil retomar. 5 minutos hoje resolve.",
    route: "/dashboard", tag: "reativacao",
    active: true, cooldownHours: 24 * 21, maxLifetimeSends: 1,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  {
    slug: "reativacao_30_dias",
    block: "reativacao", priority: "low",
    title: "Seu Atlas continua aqui ⏳",
    message: "Um mês fora, mas seus dados tão prontos. 5 minutos e você retoma.",
    route: "/dashboard", tag: "reativacao",
    active: true, cooldownHours: 24 * 30, maxLifetimeSends: 2,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  {
    slug: "reativacao_engajado",
    block: "reativacao", priority: "medium",
    title: "Você tava em ritmo 🚀",
    message: "Pena perder o ritmo agora. Bora retomar de onde parou?",
    route: "/dashboard", tag: "reativacao-engajado",
    active: true, cooldownHours: 24 * 30, maxLifetimeSends: 1,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
  // INSIGHTS
  {
    slug: "insight_score_subiu",
    block: "insight", priority: "low",
    title: "Score subiu! 🏆",
    message: "Seu Atlas Score melhorou esse mês. Mantém o ritmo que os objetivos vêm.",
    route: "/dashboard", tag: "insight-score",
    active: true, cooldownHours: 24 * 28, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_economia_boa",
    block: "insight", priority: "low",
    title: "Disciplina top 🎉",
    message: "Você poupou mais de 20% da renda esse mês. Tá no caminho da liberdade.",
    route: "/dashboard/analises", tag: "insight-poupanca",
    active: true, cooldownHours: 24 * 28, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_relatorio_pronto",
    block: "insight", priority: "low",
    title: "Resumo do mês saiu 📋",
    message: "Seu resumo financeiro tá pronto. Pode ter insight importante esperando.",
    route: "/dashboard/guiadajornada", tag: "insight-relatorio",
    active: true, cooldownHours: 24 * 28, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_atualizar_relatorios",
    block: "insight", priority: "low",
    title: "Hora dos relatórios 📊",
    message: "Atualiza no Atlas e vê o impacto real das suas decisões esse mês.",
    route: "/dashboard/guiadajornada", tag: "insight-atualizar",
    active: true, cooldownHours: 24 * 7, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_dica_util",
    block: "insight", priority: "low",
    title: "Dica rápida do Atlas 💡",
    message: "Pequenos ajustes hoje evitam dor de cabeça grande depois.",
    route: "/dashboard/analises", tag: "insight-dica",
    active: true, cooldownHours: 24 * 14, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "insights",
  },
  {
    slug: "insight_novidade_produto",
    block: "insight", priority: "low",
    title: "Novidade no Atlas ✨",
    message: "Tem feature nova que pode mudar como você organiza. Dá uma olhada.",
    route: "/dashboard", tag: "insight-novidade",
    active: false, // only activated manually when there's a real release
    cooldownHours: 24 * 30, maxLifetimeSends: null,
    preferredHourStart: 5, preferredHourEnd: 22, allowedDaysOfWeek: null,
    preferenceCategory: "novidades",
  },
];

const CATALOG_MAP = new Map(CATALOG.map(n => [n.slug, n]));

// ─── Web Push helpers (reuse from send-push) ───

const encoder = new TextEncoder();

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function createVapidJwt(audience: string, subject: string, privateKeyBase64Url: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;
  const rawKey = base64UrlDecode(privateKeyBase64Url);
  const key = await crypto.subtle.importKey(
    "pkcs8", (rawKey.buffer.byteLength === 32 ? buildPkcs8FromRaw(rawKey) : rawKey.buffer) as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]
  );
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(unsignedToken));
  const sigBytes = new Uint8Array(signature);
  const rawSig = sigBytes.length === 64 ? sigBytes : derToRaw(sigBytes);
  return `${unsignedToken}.${base64UrlEncode(rawSig)}`;
}

function buildPkcs8FromRaw(raw: Uint8Array): ArrayBuffer {
  const prefix = new Uint8Array([0x30,0x81,0x87,0x02,0x01,0x00,0x30,0x13,0x06,0x07,0x2a,0x86,0x48,0xce,0x3d,0x02,0x01,0x06,0x08,0x2a,0x86,0x48,0xce,0x3d,0x03,0x01,0x07,0x04,0x6d,0x30,0x6b,0x02,0x01,0x01,0x04,0x20]);
  const result = new Uint8Array(prefix.length + 32);
  result.set(prefix);
  result.set(raw, prefix.length);
  return result.buffer;
}

function derToRaw(der: Uint8Array): Uint8Array {
  const raw = new Uint8Array(64);
  let offset = 2;
  const rLen = der[offset + 1]; offset += 2;
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  raw.set(der.slice(rStart, offset + rLen), rLen < 32 ? 32 - rLen : 0);
  offset += rLen;
  const sLen = der[offset + 1]; offset += 2;
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  raw.set(der.slice(sStart, offset + sLen), sLen < 32 ? 64 - sLen : 32);
  return raw;
}

function concatBuffers(...buffers: Uint8Array[]): Uint8Array {
  const total = buffers.reduce((s, b) => s + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const b of buffers) { result.set(b, offset); offset += b.length; }
  return result;
}

async function encryptPayload(payload: string, p256dhB64: string, authB64: string) {
  const localKeyPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localKeyPair.publicKey));
  const subPubKey = await crypto.subtle.importKey("raw", base64UrlDecode(p256dhB64) as unknown as BufferSource, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = await crypto.subtle.deriveBits({ name: "ECDH", public: subPubKey }, localKeyPair.privateKey, 256);
  const authSecret = base64UrlDecode(authB64);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const ikm = new Uint8Array(shared);
  const authKey = await crypto.subtle.importKey("raw", authSecret as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", authKey, ikm as unknown as BufferSource));
  const subPubBytes = base64UrlDecode(p256dhB64);
  const keyInfo = concatBuffers(encoder.encode("WebPush: info\0"), subPubBytes, localPubRaw);
  const prkKey = await crypto.subtle.importKey("raw", prk as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const ikmFull = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, concatBuffers(keyInfo, new Uint8Array([1])) as unknown as BufferSource));
  const contentIkm = ikmFull.slice(0, 32);
  const saltKey = await crypto.subtle.importKey("raw", salt as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk2 = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, contentIkm as unknown as BufferSource));
  const prk2Key = await crypto.subtle.importKey("raw", prk2 as unknown as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const cekFull = new Uint8Array(await crypto.subtle.sign("HMAC", prk2Key, concatBuffers(encoder.encode("Content-Encoding: aes128gcm\0"), new Uint8Array([1])) as unknown as BufferSource));
  const cek = cekFull.slice(0, 16);
  const nonceFull = new Uint8Array(await crypto.subtle.sign("HMAC", prk2Key, concatBuffers(encoder.encode("Content-Encoding: nonce\0"), new Uint8Array([1])) as unknown as BufferSource));
  const nonce = nonceFull.slice(0, 12);
  const aesKey = await crypto.subtle.importKey("raw", cek as unknown as BufferSource, "AES-GCM", false, ["encrypt"]);
  const padded = concatBuffers(encoder.encode(payload), new Uint8Array([2]));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded as unknown as BufferSource);
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  return concatBuffers(salt, rs, new Uint8Array([65]), localPubRaw, new Uint8Array(encrypted));
}

async function sendPushToSub(
  endpoint: string, p256dh: string, auth: string, payload: string,
  vapidPub: string, vapidPriv: string, vapidSubject: string
): Promise<{ ok: boolean; status: number }> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await createVapidJwt(audience, vapidSubject, vapidPriv);
  const body = await encryptPayload(payload, p256dh, auth);
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      "TTL": "86400",
      "Authorization": `vapid t=${jwt}, k=${vapidPub}`,
    },
    body,
  });
  return { ok: resp.ok, status: resp.status };
}

// ─── Timezone helper ───
// Centralized: default BRT (America/Sao_Paulo = UTC-3).
// Future: read per-user timezone from profiles table.
const DEFAULT_TZ_OFFSET_HOURS = -3;

function getUserLocalTime(utcNow: Date, _tzOffsetHours?: number): { hour: number; dayOfWeek: number; dayOfMonth: number; date: Date } {
  const offset = _tzOffsetHours ?? DEFAULT_TZ_OFFSET_HOURS;
  const local = new Date(utcNow.getTime() + offset * 3600 * 1000);
  return {
    hour: local.getUTCHours(),
    dayOfWeek: local.getUTCDay(),
    dayOfMonth: local.getUTCDate(),
    date: local,
  };
}

// ─── Eligibility Engine ───

interface EligibilityContext {
  userId: string;
  history: { notification_slug: string; sent_at: string; source_ref: string | null }[];
  preferences: { category: string; enabled: boolean }[];
  nowHour: number;
  dayOfWeek: number;
  /** How many notifications were already sent TODAY to this user */
  sentToday: number;
  /** How many notifications were sent this WEEK to this user */
  sentThisWeek: number;
}

const DAILY_LIMIT = 4;
const WEEKLY_LIMIT = 20;
const CRITICAL_OVERRIDE_PRIORITIES = ["high", "critical"];

function isEligible(def: NotifDef, ctx: EligibilityContext, sourceRef?: string): boolean {
  if (!def.active) return false;

  // Global frequency cap — high/critical can exceed daily limit but not weekly
  if (!CRITICAL_OVERRIDE_PRIORITIES.includes(def.priority)) {
    if (ctx.sentToday >= DAILY_LIMIT) return false;
  }
  if (ctx.sentThisWeek >= WEEKLY_LIMIT) return false;

  // Time window
  if (ctx.nowHour < def.preferredHourStart || ctx.nowHour >= def.preferredHourEnd) return false;

  // Day of week
  if (def.allowedDaysOfWeek && !def.allowedDaysOfWeek.includes(ctx.dayOfWeek)) return false;

  // User preferences
  const pref = ctx.preferences.find(p => p.category === def.preferenceCategory);
  if (pref && !pref.enabled) return false;

  // History-based frequency
  const relevant = ctx.history.filter(h => {
    if (h.notification_slug !== def.slug) return false;
    if (sourceRef && h.source_ref !== sourceRef) return false;
    return true;
  });

  // Max lifetime
  if (def.maxLifetimeSends !== null && relevant.length >= def.maxLifetimeSends) return false;

  // Cooldown
  if (relevant.length > 0) {
    const lastSent = new Date(relevant[0].sent_at).getTime();
    const cooldownMs = def.cooldownHours * 3600 * 1000;
    if (Date.now() - lastSent < cooldownMs) return false;
  }

  return true;
}

// ─── Rule Evaluators ───

interface ReceitaRow {
  valor: number;
  data: string;
  recorrente: boolean;
  tipo: string;
  descricao: string | null;
  dia_recebimento: number | null;
  status: string;
}

interface DespesaFixaRow {
  id: string;
  descricao: string;
  categoria: string;
  dia_vencimento: number;
  status: string;
  valor: number;
}

interface PaymentAlertRow {
  source_id: string;
  due_date: string;
  reminder_offsets: number[];
  custom_message: string | null;
  status: string;
}

interface ScoreSnapshot {
  score: number;
  snapshot_date: string;
}

interface UserData {
  userId: string;
  createdAt: string;
  lastSignIn: string | null;
  hasReceitas: boolean;
  hasDespesas: boolean;
  hasInvestimentos: boolean;
  hasObjetivos: boolean;
  receitaTotal: number;
  despesaTotal: number;
  economiaTotal: number;
  reservaEmergencia: number;
  lastDespesaDate: string | null;
  // Most recent updated_at across despesas + receitas
  lastDespesaUpdate: string | null;
  lastReceitaUpdate: string | null;
  despesasFixas: DespesaFixaRow[];
  // All receitas of current month with full data
  receitasMonth: ReceitaRow[];
  // Category spending data for anomaly detection
  categorySpending: { categoria: string; total: number }[];
  // Previous months per-category per-month breakdown for real average
  prevMonthsCategoryBreakdown: { categoria: string; month: string; total: number }[];
  // Real engagement metrics
  dataPointsLast90d: number; // total rows created in receitas + despesas + economias in last 90d
  // Payment alerts configured by user
  paymentAlerts: PaymentAlertRow[];
  // Score snapshots for score-subiu detection
  scoreSnapshots: ScoreSnapshot[];
  // Min receitas count (to determine sufficient data for insights)
  receitaCount: number;
  despesaCount: number;
}

interface PendingNotif {
  slug: string;
  title: string;
  message: string;
  route: string;
  tag: string;
  priority: string;
  block: string;
  sourceRef?: string;
}

// Priority order for conflict resolution
const PRIORITY_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function evaluateRules(data: UserData, ctx: EligibilityContext, localTime: { dayOfMonth: number }): PendingNotif[] {
  const pending: PendingNotif[] = [];
  const dayOfMonth = localTime.dayOfMonth;
  const usedTags = new Set<string>(); // prevent duplicate tags in same run
  const usedBlocks = new Set<string>(); // limit one reativacao per run

  const push = (def: NotifDef, overrides?: Partial<PendingNotif>) => {
    // Conflict: only one notification per tag group
    const tag = overrides?.tag || def.tag;
    if (usedTags.has(tag)) return;
    // Only one reativação per run
    if (def.block === "reativacao" && usedBlocks.has("reativacao")) return;

    pending.push({
      slug: def.slug, title: def.title, message: def.message,
      route: def.route, tag, priority: def.priority, block: def.block,
      ...overrides,
    });
    usedTags.add(tag);
    if (def.block === "reativacao") usedBlocks.add("reativacao");
  };

  // ── ONBOARDING ──

  const defOnb1 = CATALOG_MAP.get("onboarding_base_incompleta")!;
  if (isEligible(defOnb1, ctx)) {
    const accountAge = (Date.now() - new Date(data.createdAt).getTime()) / (3600 * 1000);
    if (accountAge >= 24 && (!data.hasReceitas || !data.hasDespesas || !data.hasInvestimentos)) {
      push(defOnb1);
    }
  }

  const defOnb2 = CATALOG_MAP.get("onboarding_objetivos")!;
  if (isEligible(defOnb2, ctx)) {
    if (!data.hasObjetivos && data.hasReceitas) {
      push(defOnb2);
    }
  }

  // ── HÁBITO ──

  // Revisão semanal (domingo)
  const defHab1 = CATALOG_MAP.get("habito_revisao_semanal")!;
  if (isEligible(defHab1, ctx) && data.lastSignIn) {
    const daysSinceLogin = (Date.now() - new Date(data.lastSignIn).getTime()) / (86400 * 1000);
    if (daysSinceLogin <= 7) push(defHab1);
  }

  // ─── PÓS-SALÁRIO (refined) ───
  // Criteria: identify top 2-3 significant recurring incomes.
  // Only trigger when a major income was received in the last 2 days.
  // Exclude small/marginal incomes. Skip if user already updated despesas after income.
  const defHab2 = CATALOG_MAP.get("habito_pos_salario")!;
  if (isEligible(defHab2, ctx) && data.receitasMonth.length > 0) {
    // Sort receitas by valor desc to find top incomes
    const sortedReceitas = [...data.receitasMonth]
      .filter(r => r.status !== "cancelado")
      .sort((a, b) => b.valor - a.valor);

    // Only consider top 3 incomes that are ≥ 15% of total monthly income
    const minRelevant = data.receitaTotal * 0.15;
    const relevantIncomes = sortedReceitas.filter(r => r.valor >= minRelevant).slice(0, 3);

    // Check if any relevant income was received in the last 2 days
    const twoDaysAgo = new Date(Date.now() - 2 * 86400 * 1000).toISOString().split("T")[0];
    const recentRelevantIncome = relevantIncomes.find(r => r.data >= twoDaysAgo);

    if (recentRelevantIncome) {
      // "Action already resolved" check: did user update despesas after the income date?
      const incomeDate = new Date(recentRelevantIncome.data).getTime();
      const userUpdatedAfter = data.lastDespesaUpdate
        && new Date(data.lastDespesaUpdate).getTime() > incomeDate;

      if (!userUpdatedAfter) {
        const sourceRef = `salario_${recentRelevantIncome.data}`;
        if (isEligible(defHab2, ctx, sourceRef)) {
          push(defHab2, { sourceRef });
        }
      }
    }
  }

  // Sem registrar gastos
  const defHab3 = CATALOG_MAP.get("habito_sem_gastos")!;
  if (isEligible(defHab3, ctx) && data.lastDespesaDate && data.lastSignIn) {
    const daysSinceDespesa = (Date.now() - new Date(data.lastDespesaDate).getTime()) / (86400 * 1000);
    const daysSinceLogin = (Date.now() - new Date(data.lastSignIn).getTime()) / (86400 * 1000);
    // Only for active users (logged in within 7 days) who haven't registered expenses in 3+ days
    if (daysSinceDespesa >= 3 && daysSinceLogin <= 7) push(defHab3);
  }

  // ─── VENCIMENTO DE DESPESA FIXA (refined) ───
  // Integrates with payment_alerts table for user-configured offsets and custom messages.
  // Falls back to generic 1-7 day window for despesas without configured alerts.
  const defHab4 = CATALOG_MAP.get("habito_vencimento_fixa")!;
  const alertsBySource = new Map(data.paymentAlerts.map(a => [a.source_id, a]));

  for (const desp of data.despesasFixas) {
    if (!desp.dia_vencimento || desp.status === "pago") continue;
    const daysUntil = desp.dia_vencimento - dayOfMonth;
    if (daysUntil < 0) continue; // already past

    const alert = alertsBySource.get(desp.id);

    if (alert && alert.status === "scheduled") {
      // User has configured alert — use their exact offsets
      const matchesOffset = alert.reminder_offsets.includes(daysUntil);
      if (!matchesOffset) continue;

      const sourceRef = `fixa_${desp.id}_offset${daysUntil}`;
      if (isEligible(defHab4, ctx, sourceRef)) {
        // Use custom message if user provided one, otherwise default
        const desc = desp.descricao || desp.categoria || "conta";
        const message = alert.custom_message
          ? alert.custom_message
          : defHab4.message.replace("{descricao}", desc).replace("{dias}", String(daysUntil));
        push(defHab4, { message, sourceRef });
      }
    } else if (!alert) {
      // No user-configured alert — use default behavior (3 and 1 day before)
      if (daysUntil === 3 || daysUntil === 1) {
        const sourceRef = `fixa_${desp.id}_d${daysUntil}`;
        if (isEligible(defHab4, ctx, sourceRef)) {
          const desc = desp.descricao || desp.categoria || "conta";
          push(defHab4, {
            message: defHab4.message.replace("{descricao}", desc).replace("{dias}", String(daysUntil)),
            sourceRef,
          });
        }
      }
    }
  }

  // Início do mês
  const defHab5 = CATALOG_MAP.get("habito_inicio_mes")!;
  if (isEligible(defHab5, ctx) && dayOfMonth >= 1 && dayOfMonth <= 3) {
    push(defHab5);
  }

  // ── ALERTAS ──

  // Orçamento limite (despesa >= 80% receita)
  // Only suppress if economias ≥ 10% of receita (real evidence of budget control)
  const defA1 = CATALOG_MAP.get("alerta_orcamento_limite")!;
  if (isEligible(defA1, ctx) && data.receitaTotal > 0) {
    const ratio = data.despesaTotal / data.receitaTotal;
    if (ratio >= 0.8) {
      const savingsRatio = data.economiaTotal / data.receitaTotal;
      // Only suppress if savings are meaningful (≥10% of income)
      if (savingsRatio < 0.10) {
        push(defA1);
      }
    }
  }

  // ─── CATEGORIA FORA DO PADRÃO (refined) ───
  // Requires at least 2 months of historical data per category.
  // Uses per-month breakdown for real average calculation.
  // Only triggers for categories with relevant absolute values (>R$100).
  const defA2 = CATALOG_MAP.get("alerta_categoria_fora_padrao")!;
  if (isEligible(defA2, ctx)) {
    for (const cat of data.categorySpending) {
      if (cat.total < 100) continue; // ignore tiny categories

      // Get historical months for this category
      const catHistory = data.prevMonthsCategoryBreakdown.filter(p => p.categoria === cat.categoria);
      const uniqueMonths = new Set(catHistory.map(h => h.month));

      // Need at least 2 months of historical data for meaningful comparison
      if (uniqueMonths.size < 2) continue;

      // Calculate real average: sum per month, then average across months
      const monthlyTotals = new Map<string, number>();
      for (const h of catHistory) {
        monthlyTotals.set(h.month, (monthlyTotals.get(h.month) || 0) + h.total);
      }
      const monthValues = [...monthlyTotals.values()];
      const avg = monthValues.reduce((s, v) => s + v, 0) / monthValues.length;

      if (avg > 0 && cat.total > avg * 1.3 && (cat.total - avg) > 50) {
        const sourceRef = `cat_${cat.categoria}`;
        if (isEligible(defA2, ctx, sourceRef)) {
          push(defA2, {
            message: defA2.message.replace("{categoria}", cat.categoria),
            sourceRef,
          });
          break; // only one category alert per run
        }
      }
    }
  }

  // ─── PLANEJAMENTO DESATUALIZADO (refined) ───
  // Uses update timestamps from both despesas AND receitas.
  // Only triggers when user has meaningful data and hasn't updated anything in 7+ days.
  const defA3 = CATALOG_MAP.get("alerta_planejamento_desatualizado")!;
  if (isEligible(defA3, ctx) && data.hasDespesas && data.hasReceitas) {
    // Find most recent update across despesas and receitas
    const updates = [data.lastDespesaUpdate, data.lastReceitaUpdate].filter(Boolean) as string[];
    if (updates.length > 0) {
      const mostRecent = updates.sort().reverse()[0];
      const daysSinceUpdate = (Date.now() - new Date(mostRecent).getTime()) / (86400 * 1000);
      // Only trigger if user has substantial data (not a near-empty account)
      if (daysSinceUpdate >= 7 && data.despesaCount >= 3 && data.receitaCount >= 1) {
        push(defA3);
      }
    }
  }

  // ─── SALDO NEGATIVO PREVISTO (refined with severity) ───
  const defA4 = CATALOG_MAP.get("alerta_saldo_negativo")!;
  if (isEligible(defA4, ctx) && data.receitaTotal > 0) {
    const ratio = data.despesaTotal / data.receitaTotal;
    if (ratio > 1.0) {
      // Differentiate severity in message
      const deficit = data.despesaTotal - data.receitaTotal;
      let message = defA4.message;
      if (ratio >= 1.3) {
        message = `Atenção: suas despesas ultrapassam sua renda em R$ ${Math.round(deficit).toLocaleString("pt-BR")} este mês. Revise com urgência.`;
      } else if (ratio >= 1.15) {
        message = `Suas despesas estão acima da renda este mês. Revise antes que fique pior.`;
      }
      push(defA4, { message });
    }
  }

  // ─── CONTA IMPORTANTE (refined) ───
  // Uses absolute threshold (R$500+) combined with relative importance (top 20% by value).
  // Not just "above average" which was too noisy.
  const defA5 = CATALOG_MAP.get("alerta_conta_importante")!;
  if (isEligible(defA5, ctx) && data.despesasFixas.length > 0) {
    const sortedByVal = [...data.despesasFixas]
      .filter(d => d.dia_vencimento && d.status !== "pago")
      .sort((a, b) => b.valor - a.valor);

    // Top 20% threshold or absolute R$500, whichever is lower
    const top20idx = Math.max(1, Math.ceil(sortedByVal.length * 0.2));
    const top20threshold = sortedByVal.length > 0 ? sortedByVal[Math.min(top20idx - 1, sortedByVal.length - 1)].valor : 0;
    const importanceThreshold = Math.min(top20threshold, 500);

    for (const desp of sortedByVal) {
      if (!desp.dia_vencimento || desp.status === "pago") continue;
      const daysUntil = desp.dia_vencimento - dayOfMonth;
      if (daysUntil >= 1 && daysUntil <= 3 && desp.valor >= importanceThreshold) {
        const sourceRef = `importante_${desp.id}`;
        if (isEligible(defA5, ctx, sourceRef)) {
          push(defA5, { sourceRef });
          break;
        }
      }
    }
  }

  // Reserva baixa
  const defA6 = CATALOG_MAP.get("alerta_reserva_baixa")!;
  if (isEligible(defA6, ctx) && data.despesaTotal > 0 && data.reservaEmergencia < data.despesaTotal * 3) {
    push(defA6);
  }

  // ── REATIVAÇÃO (refined) ──
  // Uses real last_sign_in_at. Only one reativação per run (enforced by usedBlocks).
  // Won't send if user already came back after the inactivity period started.

  if (data.lastSignIn) {
    const daysSince = (Date.now() - new Date(data.lastSignIn).getTime()) / (86400 * 1000);

    // Don't send any reactivation if user logged in today
    if (daysSince >= 1) {
      // Progressive stages — only one fires (enforced by usedBlocks)
      if (daysSince >= 30) {
        const defR4 = CATALOG_MAP.get("reativacao_30_dias")!;
        if (isEligible(defR4, ctx)) push(defR4);
      } else if (daysSince >= 14) {
        const defR3 = CATALOG_MAP.get("reativacao_14_dias")!;
        if (isEligible(defR3, ctx)) push(defR3);
      } else if (daysSince >= 7) {
        // Check for "was-engaged user who went cold"
        // Use real data points (rows created in 90d) instead of notification history as proxy
        const defR5 = CATALOG_MAP.get("reativacao_engajado")!;
        if (data.dataPointsLast90d >= 20 && isEligible(defR5, ctx)) {
          push(defR5);
        } else {
          const defR2 = CATALOG_MAP.get("reativacao_7_dias")!;
          if (isEligible(defR2, ctx)) push(defR2);
        }
      } else if (daysSince >= 3) {
        const defR1 = CATALOG_MAP.get("reativacao_3_dias")!;
        if (isEligible(defR1, ctx)) push(defR1);
      }
    }
  }

  // ── INSIGHTS (refined) ──

  // Score subiu — real comparison using atlas_score_snapshots
  const defI1 = CATALOG_MAP.get("insight_score_subiu")!;
  if (isEligible(defI1, ctx) && data.scoreSnapshots.length >= 2) {
    const sorted = [...data.scoreSnapshots].sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
    const latest = sorted[0];
    const previous = sorted[1];
    if (latest.score > previous.score) {
      push(defI1);
    }
  }

  // Boa taxa de poupança — only with sufficient data
  const defI2 = CATALOG_MAP.get("insight_economia_boa")!;
  if (isEligible(defI2, ctx) && data.receitaTotal > 0 && data.receitaCount >= 1 && data.despesaCount >= 3) {
    if (data.economiaTotal / data.receitaTotal >= 0.2) {
      push(defI2);
    }
  }

  // Relatório pronto — only at month start and when user has meaningful data
  const defI3 = CATALOG_MAP.get("insight_relatorio_pronto")!;
  if (isEligible(defI3, ctx) && dayOfMonth >= 2 && dayOfMonth <= 5) {
    // Require at least 5 despesas and 1 receita for a meaningful report
    if (data.despesaCount >= 5 && data.receitaCount >= 1) {
      push(defI3);
    }
  }

  // Atualizar relatórios — only when data changed substantially
  const defI4 = CATALOG_MAP.get("insight_atualizar_relatorios")!;
  if (isEligible(defI4, ctx)) {
    // Check if both despesas and receitas were recently updated (within 2 days)
    const recentUpdate = [data.lastDespesaUpdate, data.lastReceitaUpdate]
      .filter(Boolean)
      .some(d => (Date.now() - new Date(d!).getTime()) / (86400 * 1000) <= 2);

    // Only trigger if there's enough data to make reports meaningful
    if (recentUpdate && data.despesaCount >= 5 && data.receitaCount >= 1) {
      push(defI4);
    }
  }

  // Insight útil — triggered mid-month for active users with substantial data
  const defI5 = CATALOG_MAP.get("insight_dica_util")!;
  if (isEligible(defI5, ctx) && dayOfMonth >= 10 && dayOfMonth <= 20) {
    // Only for users with real engagement: 10+ data points in last 90d
    if (data.dataPointsLast90d >= 10 && data.despesaCount >= 5) {
      push(defI5);
    }
  }

  // ─── CONFLICT RESOLUTION & PRIORITIZATION ───
  // 1. Sort by priority (critical > high > medium > low)
  // 2. Within same priority, prefer alerts > habito > reativacao > insights
  const blockOrder: Record<string, number> = { alerta: 0, habito: 1, onboarding: 2, reativacao: 3, insight: 4 };

  pending.sort((a, b) => {
    const prioDiff = (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
    if (prioDiff !== 0) return prioDiff;
    return (blockOrder[a.block] ?? 3) - (blockOrder[b.block] ?? 3);
  });

  // Max 3 notifications per run per user to avoid spam
  return pending.slice(0, 3);
}

// ─── Main Handler ───

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    // ── Auth guard: only callable with service-role key (cron) ──
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
    if (authHeader !== `Bearer ${serviceRoleKey}` && !isCron) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // ── Optional user_id filter ──
    let targetUserId: string | null = null;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body?.user_id && typeof body.user_id === "string") {
          targetUserId = body.user_id;
        }
      } catch { /* no body or invalid JSON — process all */ }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const vapidPub = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPriv = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = "mailto:suporte@useatlasapp.com";

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Get push subscriptions — optionally filtered by user_id.
    // Paginated to support large numbers of active subscriptions; all pages
    // are accumulated so the downstream grouping/processing logic is unchanged.
    type PushSub = { user_id: string; endpoint: string; p256dh: string; auth: string };
    const subs: PushSub[] = [];
    {
      const PAGE = 500;
      let offset = 0;
      while (true) {
        let subsQuery = admin
          .from("push_subscriptions")
          .select("user_id, endpoint, p256dh, auth")
          .eq("is_active", true)
          .order("endpoint", { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (targetUserId) {
          subsQuery = subsQuery.eq("user_id", targetUserId);
        }
        const { data: pageSubs } = await subsQuery;
        if (!pageSubs || pageSubs.length === 0) break;
        subs.push(...(pageSubs as PushSub[]));
        if (pageSubs.length < PAGE) break;
        offset += PAGE;
      }
    }

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ processed: 0, sent: 0, message: "No active subscriptions" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Group by user
    const userSubs = new Map<string, typeof subs>();
    for (const sub of subs) {
      const list = userSubs.get(sub.user_id) || [];
      list.push(sub);
      userSubs.set(sub.user_id, list);
    }

    const userIds = [...userSubs.keys()];
    const utcNow = new Date();
    const localTime = getUserLocalTime(utcNow);
    const mes = (() => {
      const d = localTime.date;
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    })();

    // Previous 3 months for category average
    const prev3Months: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const d = new Date(localTime.date.getTime());
      d.setUTCMonth(d.getUTCMonth() - i);
      prev3Months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
    }
    const prev3Start = `${prev3Months[prev3Months.length - 1]}-01`;
    const prev3End = getLastDayOfMonth(prev3Months[0]);

    // 90 days ago for engagement metrics
    const ninetyDaysAgo = new Date(Date.now() - 90 * 86400 * 1000).toISOString();

    // Fetch notification history for all users (last 90 days)
    const { data: allHistory } = await admin
      .from("notification_history")
      .select("user_id, notification_slug, sent_at, source_ref")
      .in("user_id", userIds)
      .gte("sent_at", ninetyDaysAgo)
      .order("sent_at", { ascending: false });

    // Fetch preferences
    const { data: allPrefs } = await admin
      .from("notification_preferences")
      .select("user_id, category, enabled")
      .in("user_id", userIds);

    // Fetch user auth data for last_sign_in — paginated to support >1000 users
    const authMap = new Map<string, { id: string; created_at: string; last_sign_in_at: string | null }>();
    let page = 1;
    const perPage = 1000;
    while (true) {
      const { data: { users: batch } } = await admin.auth.admin.listUsers({ page, perPage });
      if (!batch || batch.length === 0) break;
      for (const u of batch) {
        // Only store users we actually need
        if (userSubs.has(u.id)) {
          authMap.set(u.id, { id: u.id, created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? null });
        }
      }
      if (batch.length < perPage) break; // last page
      page++;
    }

    // Compute today/week boundaries for global frequency caps (in user local time)
    const todayStartLocal = new Date(localTime.date);
    todayStartLocal.setUTCHours(0, 0, 0, 0);
    const todayStartUTC = new Date(todayStartLocal.getTime() - DEFAULT_TZ_OFFSET_HOURS * 3600 * 1000);
    const weekStartUTC = new Date(todayStartUTC.getTime() - localTime.dayOfWeek * 86400 * 1000);

    let totalSent = 0;
    let totalProcessed = 0;

    // Process each user
    for (const userId of userIds) {
      totalProcessed++;
      const authUser = authMap.get(userId);
      if (!authUser) continue;

      const userHistory = (allHistory || []).filter(h => h.user_id === userId);
      const userPrefs = (allPrefs || []).filter(p => p.user_id === userId);

      // Count today/week sends for global caps
      const sentToday = userHistory.filter(h => new Date(h.sent_at) >= todayStartUTC).length;
      const sentThisWeek = userHistory.filter(h => new Date(h.sent_at) >= weekStartUTC).length;

      const ctx: EligibilityContext = {
        userId,
        history: userHistory,
        preferences: userPrefs,
        nowHour: localTime.hour,
        dayOfWeek: localTime.dayOfWeek,
        sentToday,
        sentThisWeek,
      };

      // Fetch user financial data
      const [
        receitasRes, despesasRes, economiasRes, investRes, objRes,
        prevDespRes, paymentAlertsRes, scoreRes,
        // Engagement: count rows created in last 90d
        recentReceitasCountRes, recentDespesasCountRes, recentEconomiasCountRes,
      ] = await Promise.all([
        admin.from("receitas").select("valor, data, recorrente, tipo, descricao, dia_recebimento, status, updated_at").eq("user_id", userId).gte("data", `${mes}-01`).lte("data", getLastDayOfMonth(mes)),
        admin.from("despesas").select("id, valor, categoria, tipo, descricao, dia_vencimento, status, data, updated_at").eq("user_id", userId).gte("data", `${mes}-01`).lte("data", getLastDayOfMonth(mes)),
        admin.from("economias").select("valor").eq("user_id", userId).gte("data", `${mes}-01`).lte("data", getLastDayOfMonth(mes)),
        admin.from("investimentos_financeiros").select("valor_atual, valor, is_reserva_emergencia").eq("user_id", userId),
        admin.from("objetivos").select("id").eq("user_id", userId).limit(1),
        admin.from("despesas").select("valor, categoria, data").eq("user_id", userId).gte("data", prev3Start).lte("data", prev3End),
        admin.from("payment_alerts").select("source_id, due_date, reminder_offsets, custom_message, status").eq("user_id", userId).eq("status", "scheduled"),
        admin.from("atlas_score_snapshots").select("score, snapshot_date").eq("user_id", userId).order("snapshot_date", { ascending: false }).limit(2),
        // Count data points for engagement detection
        admin.from("receitas").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", ninetyDaysAgo),
        admin.from("despesas").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", ninetyDaysAgo),
        admin.from("economias").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", ninetyDaysAgo),
      ]);

      const receitas = (receitasRes.data || []) as any[];
      const despesas = (despesasRes.data || []) as any[];
      const economias = (economiasRes.data || []) as any[];
      const investimentos = (investRes.data || []) as any[];
      const prevDesp = (prevDespRes.data || []) as any[];

      const receitaTotal = receitas.reduce((s: number, r: any) => s + Number(r.valor), 0);
      const despesaTotal = despesas.reduce((s: number, d: any) => s + Number(d.valor), 0);
      const economiaTotal = economias.reduce((s: number, e: any) => s + Number(e.valor), 0);
      const reservaEmergencia = investimentos
        .filter((i: any) => i.is_reserva_emergencia)
        .reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0);

      const despesasSorted = [...despesas].sort((a: any, b: any) => b.data.localeCompare(a.data));
      const lastDespesaDate = despesasSorted.length > 0 ? despesasSorted[0].data : null;

      // Most recent update timestamps
      const despUpdates = despesas.map((d: any) => d.updated_at).filter(Boolean).sort().reverse();
      const recUpdates = receitas.map((r: any) => r.updated_at).filter(Boolean).sort().reverse();

      const despesasFixas: DespesaFixaRow[] = despesas
        .filter((d: any) => d.tipo === "fixa")
        .map((d: any) => ({
          id: d.id,
          descricao: d.descricao || "",
          categoria: d.categoria || "",
          dia_vencimento: d.dia_vencimento || 0,
          status: d.status || "",
          valor: Number(d.valor) || 0,
        }));

      const receitasMonth: ReceitaRow[] = receitas.map((r: any) => ({
        valor: Number(r.valor) || 0,
        data: r.data,
        recorrente: r.recorrente || false,
        tipo: r.tipo || "",
        descricao: r.descricao || null,
        dia_recebimento: r.dia_recebimento || null,
        status: r.status || "",
      }));

      // Current month category spending
      const catMap = new Map<string, number>();
      for (const d of despesas) {
        const cat = d.categoria || "Outros";
        catMap.set(cat, (catMap.get(cat) || 0) + Number(d.valor));
      }
      const categorySpending = [...catMap.entries()].map(([categoria, total]) => ({ categoria, total }));

      // Previous months per-category per-month breakdown
      const prevBreakdown: { categoria: string; month: string; total: number }[] = [];
      const prevMonthMap = new Map<string, Map<string, number>>();
      for (const d of prevDesp) {
        const cat = d.categoria || "Outros";
        const month = d.data?.substring(0, 7) || "";
        if (!month) continue;
        if (!prevMonthMap.has(cat)) prevMonthMap.set(cat, new Map());
        const catMonths = prevMonthMap.get(cat)!;
        catMonths.set(month, (catMonths.get(month) || 0) + Number(d.valor));
      }
      for (const [cat, months] of prevMonthMap) {
        for (const [month, total] of months) {
          prevBreakdown.push({ categoria: cat, month, total });
        }
      }

      // Real engagement metric: total data rows created in last 90 days
      const dataPointsLast90d =
        (recentReceitasCountRes.count || 0) +
        (recentDespesasCountRes.count || 0) +
        (recentEconomiasCountRes.count || 0);

      const userData: UserData = {
        userId,
        createdAt: authUser.created_at,
        lastSignIn: authUser.last_sign_in_at || null,
        hasReceitas: receitas.length > 0,
        hasDespesas: despesas.length > 0,
        hasInvestimentos: investimentos.length > 0,
        hasObjetivos: (objRes.data || []).length > 0,
        receitaTotal,
        despesaTotal,
        economiaTotal,
        reservaEmergencia,
        lastDespesaDate,
        lastDespesaUpdate: despUpdates[0] || null,
        lastReceitaUpdate: recUpdates[0] || null,
        despesasFixas,
        receitasMonth,
        categorySpending,
        prevMonthsCategoryBreakdown: prevBreakdown,
        dataPointsLast90d,
        paymentAlerts: ((paymentAlertsRes.data || []) as any[]).map((a: any) => ({
          source_id: a.source_id,
          due_date: a.due_date,
          reminder_offsets: a.reminder_offsets || [7, 3, 1],
          custom_message: a.custom_message || null,
          status: a.status,
        })),
        scoreSnapshots: ((scoreRes.data || []) as any[]).map((s: any) => ({
          score: s.score,
          snapshot_date: s.snapshot_date,
        })),
        receitaCount: receitas.length,
        despesaCount: despesas.length,
      };

      const pending = evaluateRules(userData, ctx, localTime);

      // Send push for each pending notification
      const userSubList = userSubs.get(userId) || [];
      for (const notif of pending) {
        const pushPayload = JSON.stringify({
          title: notif.title,
          body: notif.message,
          icon: "/logo.png",
          badge: "/icons/icon-72x72.png",
          url: notif.route,
          tag: notif.tag,
        });

        let delivered = false;
        let errorMsg: string | null = null;

        for (const sub of userSubList) {
          try {
            const result = await sendPushToSub(sub.endpoint, sub.p256dh, sub.auth, pushPayload, vapidPub, vapidPriv, vapidSubject);
            if (result.ok) {
              delivered = true;
              break;
            }
            if (result.status === 404 || result.status === 410) {
              await admin.from("push_subscriptions").update({ is_active: false }).eq("endpoint", sub.endpoint);
            }
            errorMsg = `HTTP ${result.status}`;
          } catch (err) {
            errorMsg = (err as Error).message;
          }
        }

        // Record in history
        await admin.from("notification_history").insert({
          user_id: userId,
          notification_slug: notif.slug,
          source_ref: notif.sourceRef || null,
          title: notif.title,
          message: notif.message,
          route: notif.route,
          priority: notif.priority,
          block: notif.block,
          delivery_status: delivered ? "delivered" : "failed",
          error_message: delivered ? null : errorMsg,
        });

        if (delivered) totalSent++;
      }
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed, sent: totalSent, timestamp: utcNow.toISOString() }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[smart-notifications] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
