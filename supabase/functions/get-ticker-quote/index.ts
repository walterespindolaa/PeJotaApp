import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const BRAPI_BASE = "https://brapi.dev/api";
const TWELVE_BASE = "https://api.twelvedata.com";
const CACHE_TTL_MINUTES = 15;

// fetch com timeout via AbortController — evita pendurar a function se a API externa travar.
async function fetchWithTimeout(url: string, timeoutMs = 9000): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ac.signal });
  } finally {
    clearTimeout(t);
  }
}

interface TickerRequest {
  tickers: string[];
  tipos?: Record<string, string>;
  forceRefresh?: boolean;
}

function isInternational(ticker: string, tipo?: string): boolean {
  if (tipo === "Exterior") return true;
  if (tipo === "Cripto" && !/\d/.test(ticker)) return true;
  return false;
}

async function fetchFromTwelveData(
  tickers: string[],
  tipos: Record<string, string>,
  apiKey: string
): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  if (!tickers.length) return result;

  const symbols = tickers.join(",");
  const url = `${TWELVE_BASE}/quote?symbol=${symbols}&apikey=${apiKey}`;

  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return result;
    const json = await res.json();

    const entries = tickers.length === 1 ? { [tickers[0]]: json } : json;

    for (const [sym, data] of Object.entries(entries)) {
      const ticker = sym.toUpperCase();
      const d = data as any;
      if (d.status === "error" || !d.close) continue;

      result[ticker] = {
        ticker,
        nome: d.name || ticker,
        logo_url: null,
        tipo_ativo: tipos[ticker]?.toLowerCase() || "stock",
        preco_atual: d.close ? Number(d.close) : null,
        variacao_dia: d.change ? Number(d.change) : null,
        variacao_pct: d.percent_change ? Number(d.percent_change) : null,
        volume: d.volume ? Number(d.volume) : null,
        abertura: d.open ? Number(d.open) : null,
        maximo_dia: d.high ? Number(d.high) : null,
        minimo_dia: d.low ? Number(d.low) : null,
        pl: null, pvp: null, roe: null, dy: null, ev_ebitda: null, market_cap: null,
      };
    }
  } catch (e) {
    console.error("Twelve Data fetch error:", e);
  }

  return result;
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

  // Rate limit: 60/hour per user
  const rl = await checkRateLimit(userId, { scope: "get-ticker-quote", window: "hour", limit: 60 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const BRAPI_TOKEN = Deno.env.get("BRAPI_API_TOKEN");
    const TWELVE_KEY = Deno.env.get("TWELVE_DATA_API_KEY");
    if (!BRAPI_TOKEN) throw new Error("BRAPI_API_TOKEN not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body: TickerRequest = await req.json();
    const { tickers, tipos = {}, forceRefresh = false } = body;

    if (!tickers?.length) {
      return new Response(JSON.stringify({ data: [] }), {
        headers: corsHeaders,
      });
    }

    const normalizedTickers = tickers.map(t => t.toUpperCase().trim()).filter(Boolean);

    const now = new Date();
    const cacheThreshold = new Date(now.getTime() - CACHE_TTL_MINUTES * 60 * 1000).toISOString();

    let tickersToFetch = normalizedTickers;
    let cachedData: Record<string, any> = {};

    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from("ticker_cache")
        .select("*")
        .in("ticker", normalizedTickers)
        .gte("updated_at", cacheThreshold);

      for (const row of cached || []) {
        cachedData[row.ticker] = row;
      }
      tickersToFetch = normalizedTickers.filter(t => !cachedData[t]);
    }

    if (tickersToFetch.length > 0) {
      const internacionais = tickersToFetch.filter(t => isInternational(t, tipos[t]));
      const brasileiros = tickersToFetch.filter(t => !internacionais.includes(t));

      // ── BRAPI: tickers brasileiros ──
      if (brasileiros.length > 0) {
        const fiis = brasileiros.filter(t =>
          tipos[t] === "FII" ||
          (t.endsWith("11") && tipos[t] !== "ETF" && tipos[t] !== "Ação" && tipos[t] !== "Exterior")
        );
        const allBR = brasileiros;

        for (let i = 0; i < allBR.length; i += 20) {
          const chunk = allBR.slice(i, i + 20);
          const url = `${BRAPI_BASE}/quote/${chunk.join(",")}?modules=defaultKeyStatistics,summaryProfile&token=${BRAPI_TOKEN}`;
          const res = await fetchWithTimeout(url);
          if (!res.ok) continue;
          const json = await res.json();

          for (const result of json.results || []) {
            const ticker = result.symbol?.toUpperCase();
            if (!ticker) continue;

            const stats = result.defaultKeyStatistics || {};
            const isFii = fiis.includes(ticker) || tipos[ticker] === "FII";

            const cacheRow = {
              ticker,
              nome: result.longName || result.shortName || ticker,
              logo_url: result.logourl || null,
              tipo_ativo: isFii ? "fii" : tipos[ticker]?.toLowerCase() || "stock",
              preco_atual: result.regularMarketPrice ?? null,
              variacao_dia: result.regularMarketChange ?? null,
              variacao_pct: result.regularMarketChangePercent ?? null,
              volume: result.regularMarketVolume ?? null,
              abertura: result.regularMarketOpen ?? null,
              maximo_dia: result.regularMarketDayHigh ?? null,
              minimo_dia: result.regularMarketDayLow ?? null,
              pl: stats.trailingPE ?? null,
              pvp: stats.priceToBook ?? null,
              roe: stats.returnOnEquity ? stats.returnOnEquity * 100 : null,
              dy: stats.dividendYield ? stats.dividendYield * 100 : null,
              ev_ebitda: stats.enterpriseToEbitda ?? null,
              market_cap: result.marketCap ?? null,
              updated_at: now.toISOString(),
            };

            cachedData[ticker] = cacheRow;
            await supabase.from("ticker_cache").upsert(cacheRow, { onConflict: "ticker" });
          }
        }

        // FII indicators específicos
        if (fiis.length > 0) {
          for (let i = 0; i < fiis.length; i += 20) {
            const chunk = fiis.slice(i, i + 20);
            const url = `${BRAPI_BASE}/v2/fii/indicators?symbols=${chunk.join(",")}&token=${BRAPI_TOKEN}`;
            const res = await fetchWithTimeout(url);
            if (!res.ok) continue;
            const json = await res.json();

            for (const fii of json.fiis || []) {
              const ticker = fii.symbol?.toUpperCase();
              if (!ticker) continue;

              const updates = {
                nav_per_share: fii.navPerShare ?? null,
                dividend_yield_12m: fii.dividendYield12m ? fii.dividendYield12m * 100 : null,
                dividend_yield_1m: fii.dividendYield1m ? fii.dividendYield1m * 100 : null,
                segment_type: fii.segmentType ?? null,
                segment_name: fii.segmentoAtuacao ?? null,
                admin_name: fii.adminName ?? null,
                manager_name: fii.managerName ?? null,
                total_investors: fii.totalInvestors ?? null,
                pvp: fii.priceToNav ?? null,
                updated_at: now.toISOString(),
              };

              cachedData[ticker] = { ...(cachedData[ticker] || {}), ...updates };
              await supabase.from("ticker_cache").upsert(
                { ticker, ...updates },
                { onConflict: "ticker" }
              );
            }
          }
        }
      }

      // ── Twelve Data: tickers internacionais ──
      if (internacionais.length > 0 && TWELVE_KEY) {
        const twelveData = await fetchFromTwelveData(internacionais, tipos, TWELVE_KEY);
        for (const [ticker, data] of Object.entries(twelveData)) {
          const cacheRow = { ...data, updated_at: now.toISOString() };
          cachedData[ticker] = cacheRow;
          await supabase.from("ticker_cache").upsert(cacheRow, { onConflict: "ticker" });
        }
      } else if (internacionais.length > 0 && !TWELVE_KEY) {
        for (const ticker of internacionais) {
          cachedData[ticker] = { ticker, preco_atual: null, erro: "TWELVE_DATA_API_KEY não configurada" };
        }
      }
    }

    const result = normalizedTickers.map(ticker => ({
      ticker,
      ...(cachedData[ticker] || { ticker, preco_atual: null, erro: "Ticker não encontrado" }),
      from_cache: !tickersToFetch.includes(ticker),
    }));

    return new Response(JSON.stringify({ data: result }), {
      headers: corsHeaders,
    });

  } catch (err) {
    console.error("get-ticker-quote error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
