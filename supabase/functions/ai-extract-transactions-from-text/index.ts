import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { hasPremiumAccess, premiumDeniedResponse } from "../_shared/plan-check.ts";
import { aiFetch, AiTimeoutError } from "../_shared/ai-fetch.ts";

const SYSTEM_PROMPT = `Voce e um extrator de transacoes de faturas de cartao de credito brasileiro.
Recebe texto bruto extraido de um PDF de fatura e deve identificar TODAS as transacoes de compra.

REGRAS:
- Extraia apenas transacoes reais (compras, pagamentos, assinaturas)
- Ignore cabecalhos, totais, juros, encargos, IOF
- Para cada transacao retorne: date (YYYY-MM-DD), description (texto original), amount (numero positivo)
- Se a data estiver no formato DD/MM, assuma o ano fornecido no contexto
- Responda APENAS com JSON valido`;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const user = { id: claimsData.claims.sub as string };

    // Plan validation
    const hasAccess = await hasPremiumAccess(supabase, user.id);
    if (!hasAccess) return premiumDeniedResponse(corsHeaders);

    const rl = await checkRateLimit(user.id, { scope: "ai-extract", window: "hour", limit: 30 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders, "Muitas extrações em pouco tempo. Aguarde alguns minutos.");

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const MODEL = "gpt-4o-mini";

    const { text, year } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text is required" }), { status: 400, headers: corsHeaders });
    }

    // Truncate to ~12k chars to stay within limits
    const truncated = text.slice(0, 12000);

    console.log(
      `[ai-extract] Model: ${MODEL}, Fallback extraction for user ${user.id}, text length: ${truncated.length}`,
    );

    // Log this as fallback usage
    await supabase.from("fatura_import_logs").insert({
      user_id: user.id,
      provider_used: "ai_fallback",
      ai_fallback_used: true,
      total_transactions: 0,
      sent_to_ai: 1,
    });

    const res = await aiFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Ano de referencia: ${year || new Date().getFullYear()}\n\nTexto da fatura:\n${truncated}\n\nRetorne JSON: { "transactions": [{ "date": "YYYY-MM-DD", "description": "string", "amount": number }] }`,
          },
        ],
        max_tokens: 4096,
        temperature: 0,
      }),
    }, 30_000);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ai-extract] AI gateway error:", res.status, errText);
      if (res.status === 429) {
        return new Response(
          JSON.stringify({ error: "Limite de requisicoes atingido. Tente novamente em alguns segundos." }),
          {
            status: 429,
            headers: corsHeaders,
          },
        );
      }
      if (res.status === 402) {
        return new Response(JSON.stringify({ error: "Creditos de IA esgotados." }), {
          status: 402,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify({ error: "AI extraction failed", details: errText }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const data = await res.json();
    const outputText = data.choices?.[0]?.message?.content;

    if (!outputText) {
      return new Response(JSON.stringify({ error: "No output from AI", raw: data }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    // Extract JSON from response
    let jsonStr = outputText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    console.log(
      `[ai-extract] Model: ${MODEL}, Extracted ${parsed.transactions?.length ?? 0} transactions via AI fallback`,
    );

    return new Response(JSON.stringify(parsed), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    if (e instanceof AiTimeoutError) {
      return new Response(JSON.stringify({ error: "A IA demorou para responder. Tente novamente em instantes." }), { status: 504, headers: corsHeaders });
    }
    console.error("[ai-extract] Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
