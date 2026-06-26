import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const BRAPI_BASE = "https://brapi.dev/api";

// fetch com timeout via AbortController — evita pendurar a function se a BRAPI travar.
async function fetchWithTimeout(url: string, timeoutMs = 9000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

interface TickerAsset {
  ticker: string;
  quantidade: number;
  tipo: string;
  nome: string;
  investimento_id: string;
  data_compra?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  const corsHeaders = getCorsHeadersWithContentType(req);

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const userId = claimsData.claims.sub as string;

  // Rate limit: 30/hour per user
  const rl = await checkRateLimit(userId, { scope: "get-ticker-dividends", window: "hour", limit: 30 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const BRAPI_TOKEN = Deno.env.get("BRAPI_API_TOKEN");
    if (!BRAPI_TOKEN) throw new Error("BRAPI_API_TOKEN not configured");

    const { ativos }: { ativos: TickerAsset[] } = await req.json();

    if (!ativos?.length) {
      return new Response(JSON.stringify({ historico: [], previsao: [] }), {
        headers: corsHeaders,
      });
    }

    const now = new Date();
    const cutoff12mAgo = new Date(now.getFullYear() - 2, now.getMonth(), 1);
    const cutoff12mFuture = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    const historico: any[] = [];
    const previsao: any[] = [];

    for (const ativo of ativos) {
      if (!ativo.ticker?.trim()) continue;

      const ticker = ativo.ticker.toUpperCase().trim();

      const url = `${BRAPI_BASE}/quote/${ticker}?dividends=true&token=${BRAPI_TOKEN}`;
      let res: Response;
      try {
        res = await fetchWithTimeout(url);
      } catch (e) {
        console.warn(`[get-ticker-dividends] ${ticker} fetch falhou/timeout:`, e instanceof Error ? e.message : e);
        continue;
      }
      if (!res.ok) continue;

      const json = await res.json();
      const cashDividends = json.results?.[0]?.dividendsData?.cashDividends || [];

      for (const div of cashDividends) {
        const payDate = div.paymentDate ? new Date(div.paymentDate) : null;
        const exDate = div.lastDatePrior ? new Date(div.lastDatePrior) : null;

        if (!payDate || isNaN(payDate.getTime())) continue;

        const rate = Number(div.rate || 0);
        const quantidade = Number(ativo.quantidade || 0);
        const valorTotal = rate * quantidade;
        const mesRef = `${payDate.getFullYear()}-${String(payDate.getMonth() + 1).padStart(2, "0")}`;

        const item = {
          ticker,
          nome: ativo.nome,
          investimento_id: ativo.investimento_id,
          tipo: ativo.tipo,
          label: div.label || "Dividendo",
          rate,
          quantidade,
          valor_total: valorTotal,
          mes_referencia: mesRef,
          payment_date: payDate.toISOString(),
          ex_date: exDate ? exDate.toISOString() : null,
          related_to: div.relatedTo || null,
        };

        if (ativo.data_compra) {
          const dataCompra = new Date(ativo.data_compra);
          if (payDate < dataCompra) continue;
        }

        const nowWithMargin = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
        if (payDate >= cutoff12mAgo && payDate <= now) {
          historico.push(item);
        } else if (payDate > now && payDate <= nowWithMargin) {
          // Pagamento nos próximos 5 dias — trata como já recebido
          historico.push(item);
        } else if (payDate > nowWithMargin && payDate <= cutoff12mFuture) {
          previsao.push(item);
        }
      }

      if (ativo.tipo === "FII" && previsao.filter(p => p.ticker === ticker).length === 0) {
        const ultimosDiv = historico
          .filter(h => h.ticker === ticker)
          .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());

        if (ultimosDiv.length > 0) {
          const mediaRate = ultimosDiv.slice(0, 3).reduce((s, d) => s + d.rate, 0) / Math.min(3, ultimosDiv.length);
          for (let m = 1; m <= 6; m++) {
            const projecaoDate = new Date(now.getFullYear(), now.getMonth() + m, 15);
            const mesRef = `${projecaoDate.getFullYear()}-${String(projecaoDate.getMonth() + 1).padStart(2, "0")}`;
            previsao.push({
              ticker,
              nome: ativo.nome,
              investimento_id: ativo.investimento_id,
              tipo: ativo.tipo,
              label: "Rendimento",
              rate: mediaRate,
              quantidade: Number(ativo.quantidade),
              valor_total: mediaRate * Number(ativo.quantidade),
              mes_referencia: mesRef,
              payment_date: projecaoDate.toISOString(),
              ex_date: null,
              related_to: null,
              estimado: true,
            });
          }
        }
      }
    }

    const historicoByMes: Record<string, number> = {};
    for (const h of historico) {
      historicoByMes[h.mes_referencia] = (historicoByMes[h.mes_referencia] || 0) + h.valor_total;
    }

    const previsaoByMes: Record<string, number> = {};
    for (const p of previsao) {
      previsaoByMes[p.mes_referencia] = (previsaoByMes[p.mes_referencia] || 0) + p.valor_total;
    }

    return new Response(JSON.stringify({
      historico,
      previsao,
      grafico_historico: Object.entries(historicoByMes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, total]) => ({ mes, total })),
      grafico_previsao: Object.entries(previsaoByMes)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([mes, total, estimado = true]) => ({ mes, total, estimado })),
    }), {
      headers: corsHeaders,
    });

  } catch (err) {
    console.error("get-ticker-dividends error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
