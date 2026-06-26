import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const CACHE_TTL_DAYS = 7;

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
  const rl = await checkRateLimit(userId, { scope: "get-fii-reports", window: "hour", limit: 30 });
  if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);

  try {
    const BRAPI_TOKEN = Deno.env.get("BRAPI_API_TOKEN");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!BRAPI_TOKEN) throw new Error("BRAPI_API_TOKEN not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { tickers }: { tickers: string[] } = await req.json();
    if (!tickers?.length) {
      return new Response(JSON.stringify({ reports: [] }), {
        headers: corsHeaders,
      });
    }

    const upperTickers = tickers.map((t) => t.toUpperCase());

    const { data: cached, error: cacheErr } = await supabase
      .from("fii_informes_cache")
      .select("ticker, informe, updated_at")
      .in("ticker", upperTickers);

    if (cacheErr) console.error("[get-fii-reports] erro lendo cache:", cacheErr.message);

    const cacheMap = new Map<string, { informe: any; updated_at: string }>();
    (cached || []).forEach((row) => {
      cacheMap.set(row.ticker, { informe: row.informe, updated_at: row.updated_at });
    });

    const ttlMs = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const needsRefresh: string[] = [];

    for (const ticker of upperTickers) {
      const entry = cacheMap.get(ticker);
      if (!entry) {
        needsRefresh.push(ticker);
        continue;
      }
      const age = now - new Date(entry.updated_at).getTime();
      if (age > ttlMs) needsRefresh.push(ticker);
    }

    console.log(`[get-fii-reports] ${tickers.length} pedidos | ${cacheMap.size} no cache | ${needsRefresh.length} precisam refresh`);

    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    for (const ticker of needsRefresh) {
      const url = `https://brapi.dev/api/v2/fii/reports?symbols=${ticker}&startDate=${startDate}&endDate=${endDate}&limit=1&token=${BRAPI_TOKEN}`;
      try {
        const res = await fetchWithTimeout(url);
        if (!res.ok) {
          console.warn(`[get-fii-reports] ${ticker} BRAPI status ${res.status}`);
          continue;
        }
        const json = await res.json();
        const arr = (json.reports || []) as any[];
        if (arr.length === 0) {
          console.log(`[get-fii-reports] ${ticker} sem informe na BRAPI`);
          continue;
        }

        const r = arr[0];
        const equity = Number(r.equity || 0);
        const toPct = (value: any): number | null => {
          if (value == null || equity <= 0) return null;
          const num = Number(value);
          if (!Number.isFinite(num) || num === 0) return null;
          return (num / equity) * 100;
        };

        const informe = {
          referenceDate: r.referenceDate || null,
          monthlyDividendYield: r.monthlyDividendYield ?? null,
          monthlyReturn: r.monthlyReturn ?? null,
          navPerShare: r.navPerShare ?? null,
          equity: r.equity ?? null,
          totalAssets: r.totalAssets ?? null,
          totalInvestors: r.totalInvestors ?? null,
          composition: {
            cri: toPct(r.cri),
            lci: toPct(r.lci),
            governmentBonds: toPct(r.governmentBonds),
            cash: toPct(r.cash),
            realEstateAssets: toPct(r.realEstateAssets),
            other: toPct(r.other ?? r.others),
          },
        };

        const refDate = r.referenceDate ? r.referenceDate.split(" ")[0] : null;

        const { error: upsertErr } = await supabase
          .from("fii_informes_cache")
          .upsert({
            ticker,
            informe,
            source_reference_date: refDate,
            updated_at: new Date().toISOString(),
          }, { onConflict: "ticker" });

        if (upsertErr) {
          console.error(`[get-fii-reports] ${ticker} upsert error:`, upsertErr.message);
        } else {
          cacheMap.set(ticker, { informe, updated_at: new Date().toISOString() });
        }
      } catch (e: any) {
        console.error(`[get-fii-reports] ${ticker} erro:`, e?.message);
      }
    }

    const reports = upperTickers
      .map((ticker) => {
        const entry = cacheMap.get(ticker);
        return entry ? { ticker, informe: entry.informe } : null;
      })
      .filter(Boolean);

    return new Response(JSON.stringify({ reports }), {
      headers: corsHeaders,
    });

  } catch (err) {
    console.error("[get-fii-reports] erro geral:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
