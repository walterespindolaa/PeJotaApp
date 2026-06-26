import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, getCorsHeadersWithContentType } from "../_shared/cors.ts";

const BRAPI_BASE = "https://brapi.dev/api";

const TICKERS_CONFIG = [
  // Ações BR
  ...["PETR4","VALE3","ITUB4","BBDC4","ABEV3","WEGE3","RENT3","RADL3","EQTL3","EGIE3","TAEE11","SAPR11","ALUP11","CMIG4","CPLE3","VIVT3","SBSP3","BBSE3","CSMG3","FLRY3","HYPE3","KLBN4","SANB11","ITSA4","PSSA3","GRND3","LEVE3","MRVE3","TIMS3","BBAS3","BRAP4","CSAN3","CSNA3","GGBR4","JHSF3","JBSS3","KEPL3","LCAM3","AGRO3","SOJA3","VITT3","TTEN3","SMTO3","SUZB3"].map(t => ({ ticker: t, tipo: "Ação", subtipo: "Ação BR", setor: "" })),
  // FIIs
  ...["MXRF11","HGLG11","IRDM11","XPML11","KNRI11","BTLG11","VISC11","HGBS11","BRCO11","XPLG11","HGRE11","BRCR11","PVBI11","XPCI11","KNCR11","KNCA11","CPTS11","VRTA11","RBRF11","RBRR11","BCFF11","HGCR11","GGRC11","RBRY11","VGIR11","HABT11","HFOF11","MGFF11","BTCI11","VCJR11","DEVA11","LFTT11","RCRB11","TGAR11","VILG11","LVBI11","HSML11","BIEV11","LIFE11","PATL11"].map(t => ({ ticker: t, tipo: "FII", subtipo: "FII", setor: "" })),
  // ETFs Renda Fixa
  ...["LFTB11","POSB11","LFTS11","IMAB511","PACB11"].map(t => ({ ticker: t, tipo: "ETF", subtipo: "Renda Fixa", setor: "" })),
  // ETFs Renda Variável BR
  ...["BOVA11","IBOB11","SMAL11","BCIC11","BDEF11","HIGH11","TRIG11"].map(t => ({ ticker: t, tipo: "ETF", subtipo: "Renda Variável BR", setor: "" })),
  // ETFs Internacional
  ...["SPXR11","NASD11","WRLD11","IVVB11","BIEV39","XINA11"].map(t => ({ ticker: t, tipo: "ETF", subtipo: "Internacional", setor: "" })),
  // ETFs Metais
  ...["GOLD11","BCPX39","BSLV39"].map(t => ({ ticker: t, tipo: "ETF", subtipo: "Metais", setor: "" })),
  // ETFs Cripto
  ...["HASH11","BITH11"].map(t => ({ ticker: t, tipo: "ETF", subtipo: "Cripto", setor: "" })),
  // BDRs Internacional
  ...["AAPL34","MSFT34","AMZN34","GOGL34","NVDC34","META34","JPM34","V34","BAC34","MELI34","TSLA34","NFLX34"].map(t => ({ ticker: t, tipo: "BDR", subtipo: "Internacional", setor: "" })),
];

const TICKERS_DEDUPED = Array.from(
  new Map(TICKERS_CONFIG.map(t => [t.ticker, t])).values()
);

const FII_SEGMENT_MAP: Record<string, string> = {
  // Logística
  HGLG11: "Logística", BTLG11: "Logística", BRCO11: "Logística",
  XPLG11: "Logística", GGRC11: "Logística", VILG11: "Logística",
  LVBI11: "Logística", PATL11: "Logística",
  // Shoppings
  XPML11: "Shoppings", VISC11: "Shoppings", HGBS11: "Shoppings",
  HSML11: "Shoppings",
  // Lajes Corporativas
  HGRE11: "Lajes Corporativas", BRCR11: "Lajes Corporativas",
  PVBI11: "Lajes Corporativas", RCRB11: "Lajes Corporativas",
  // Recebíveis / Papel (CRI)
  MXRF11: "Recebíveis", IRDM11: "Recebíveis", XPCI11: "Recebíveis",
  KNCR11: "Recebíveis", KNCA11: "Recebíveis", CPTS11: "Recebíveis",
  VRTA11: "Recebíveis", RBRR11: "Recebíveis", HGCR11: "Recebíveis",
  RBRY11: "Recebíveis", VGIR11: "Recebíveis", HABT11: "Recebíveis",
  BTCI11: "Recebíveis", VCJR11: "Recebíveis", DEVA11: "Recebíveis",
  LFTT11: "Recebíveis",
  // Híbrido
  KNRI11: "Híbrido",
  // Fundo de Fundos
  RBRF11: "Fundo de Fundos", BCFF11: "Fundo de Fundos",
  HFOF11: "Fundo de Fundos", MGFF11: "Fundo de Fundos",
  // Outros segmentos específicos
  TGAR11: "Agro",
  BIEV11: "Hospitalar",
  LIFE11: "Hospitalar",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders(req) });

  const corsHeaders = getCorsHeadersWithContentType(req);

  // Admin auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
  if (claimsError || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const callerUserId = claimsData.claims.sub as string;

  // Require admin role
  const serviceClient = createClient(supabaseUrl, serviceKey);
  const { data: roleData } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", callerUserId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: "Admin required" }), { status: 403, headers: corsHeaders });
  }

  try {
    const BRAPI_TOKEN = Deno.env.get("BRAPI_API_TOKEN");
    const SUPABASE_URL = supabaseUrl;
    const SUPABASE_SERVICE_KEY = serviceKey;
    if (!BRAPI_TOKEN) throw new Error("BRAPI_API_TOKEN not configured");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { tipo } = await req.json().catch(() => ({ tipo: "all" }));
    const toUpdate = tipo === "all"
      ? TICKERS_DEDUPED
      : TICKERS_DEDUPED.filter(t => t.tipo === tipo || t.subtipo === tipo);

    const tickers = toUpdate.map(t => t.ticker);
    const CHUNK = 5;
    let updated = 0;
    let errors = 0;

    for (let i = 0; i < tickers.length; i += CHUNK) {
      const chunk = tickers.slice(i, i + CHUNK);
      // modules=defaultKeyStatistics (P/VP, P/L forward),
      //         financialData (ROE, EPS, debt),
      //         summaryProfile (sector/industry pra Ações)
      const url = `${BRAPI_BASE}/quote/${chunk.join(",")}?token=${BRAPI_TOKEN}&fundamental=true&dividends=true&range=1y&interval=1mo&modules=defaultKeyStatistics,financialData,summaryProfile`;
      const res = await fetch(url);
      if (!res.ok) { errors += chunk.length; continue; }
      const json = await res.json();
      const results = json.results || [];

      for (const r of results) {
        const config = TICKERS_DEDUPED.find(t => t.ticker === r.symbol);
        if (!config) continue;

        const ks = r.defaultKeyStatistics || {};
        const fd = r.financialData || {};
        const sp = r.summaryProfile || {};

        const oneYearAgoIso = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const cashDivs = r.dividendsData?.cashDividends || [];
        const sumDivs12m = cashDivs
          .filter((d: any) => {
            const dt = (d.paymentDate || d.lastDatePrior || "").toString().slice(0, 10);
            return dt >= oneYearAgoIso;
          })
          .reduce((s: number, d: any) => s + Number(d.rate || 0), 0);
        const px = Number(r.regularMarketPrice || 0);
        const dyCalc = (px > 0 && sumDivs12m > 0) ? (sumDivs12m / px) * 100 : null;

        // Variações: mês / ytd / 12m via historicalDataPrice (range=1y, interval=1mo)
        const hp = (r.historicalDataPrice || []) as any[];
        const currentYear = new Date().getFullYear();

        let var12m: number | null = null;
        let varMes: number | null = null;
        let varYtd: number | null = null;

        if (px > 0 && hp.length > 0) {
          // 12m: vs ponto mais antigo (~12 meses atrás)
          const oldestClose = Number(hp[0]?.close ?? 0);
          if (oldestClose > 0) var12m = ((px - oldestClose) / oldestClose) * 100;

          // Mês: vs último fechamento mensal
          const lastMonthClose = Number(hp[hp.length - 1]?.close ?? 0);
          if (lastMonthClose > 0) varMes = ((px - lastMonthClose) / lastMonthClose) * 100;

          // YTD: vs último ponto do ano anterior (procura do mais recente pro mais antigo)
          for (let i = hp.length - 1; i >= 0; i--) {
            const dt = new Date(Number(hp[i]?.date ?? 0) * 1000);
            if (dt.getFullYear() < currentYear) {
              const c = Number(hp[i]?.close ?? 0);
              if (c > 0) varYtd = ((px - c) / c) * 100;
              break;
            }
          }
        }

        // P/L: para BDRs, ignorar pois priceEarnings vem distorcido (preço BRL / EPS USD)
        const pl = config.tipo === "BDR" ? null : (r.priceEarnings ?? ks.forwardPE ?? null);

        // P/VP
        const pvp = ks.priceToBook ?? r.priceToBook ?? null;

        // ROE em %
        const roeRaw = fd.returnOnEquity ?? r.returnOnEquity ?? null;
        const roe = roeRaw != null ? Number(roeRaw) * 100 : null;

        // BDR e ETF Renda Fixa não usam DY do BRAPI; demais usam o calculado
        const dy = (config.tipo === "BDR" || config.subtipo === "Renda Fixa")
          ? null
          : dyCalc;

        // Setor: ETF/BDR mantém subtipo; FII pega do FII_SEGMENT_MAP; Ação pega do top-level r.sector
        let setor = config.setor || "";
        if (config.tipo === "FII") setor = FII_SEGMENT_MAP[r.symbol] || "Outros";
        else if (config.tipo === "Ação") setor = r.sector || sp.sector || "Outros";
        else if (config.tipo === "BDR") setor = sp.sector || r.sector || "Internacional";

        const { error } = await supabase.from("stock_guide").upsert({
          ticker: r.symbol,
          nome: r.longName || r.shortName || r.symbol,
          tipo: config.tipo,
          subtipo: config.subtipo,
          setor,
          preco: r.regularMarketPrice ?? null,
          variacao_dia: r.regularMarketChangePercent ?? null,
          variacao_mes: varMes,
          variacao_ytd: varYtd,
          variacao_12m: var12m,
          market_cap: r.marketCap ?? null,
          pl,
          pvp,
          ev_ebitda: ks.enterpriseToEbitda ?? null,
          roe,
          dy_12m: dy,
          volume_medio: r.regularMarketVolume ?? null,
          cotistas: r.numberOfShares ?? null,
          patrimonio_liquido: ks.bookValue ?? r.bookValuePerShare ?? null,
          updated_at: new Date().toISOString(),
        }, { onConflict: "ticker" });

        if (error) { console.error("upsert error", r.symbol, error.message); errors++; }
        else updated++;
      }
    }

    return new Response(JSON.stringify({ updated, errors, total: toUpdate.length }), {
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("update-stock-guide error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});