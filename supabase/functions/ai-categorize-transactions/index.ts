import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { hasPremiumAccess, premiumDeniedResponse } from "../_shared/plan-check.ts";
import { checkAndIncrementQuota, quotaExceededResponse } from "../_shared/quota-check.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";
import { aiFetch, AiTimeoutError } from "../_shared/ai-fetch.ts";

const SYSTEM_PROMPT = Deno.env.get("ATLAS_CATEGORIZE_SYSTEM_PROMPT");
if (!SYSTEM_PROMPT) throw new Error("ATLAS_CATEGORIZE_SYSTEM_PROMPT not configured");

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
    const userId = claimsData.claims.sub as string;

    const rl = await checkRateLimit(userId, { scope: "ai-categorize", window: "hour", limit: 50 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders, "Muitas categorizações em pouco tempo. Aguarde alguns minutos.");

    // --- Plan validation ---
    const hasAccess = await hasPremiumAccess(supabase, userId);
    if (!hasAccess) return premiumDeniedResponse(corsHeaders);

    // Quota check (compartilha feature "chat" — categorização é uso de IA)
    const quota = await checkAndIncrementQuota(authHeader, "chat");
    if (!quota.allowed) {
      return quotaExceededResponse(quota, "chat", corsHeaders);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const { source, statement_month, rows, learned_categories, use_strong_model } = await req.json();
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "rows e obrigatorio e deve ser um array nao vazio" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    if (rows.length > 100) {
      return new Response(JSON.stringify({ error: "Maximo de 100 transacoes por requisicao" }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    let learningContext = "";
    if (learned_categories && Array.isArray(learned_categories) && learned_categories.length > 0) {
      const trimmed = learned_categories.slice(0, 200);
      learningContext = `\n\nCATEGORIAS APRENDIDAS DO USUARIO:\n${trimmed.map((l: any) => `- "${l.merchant}" -> ${l.categoria || l.category}`).join("\n")}`;
    }

    const model = "gpt-4o-mini";

    const userPrompt = `Fonte: ${source || "fatura"}
Mes referencia: ${statement_month || "atual"}
${learningContext}

Transacoes:
${JSON.stringify(rows)}

Retorne EXATAMENTE neste formato JSON:
{
  "items": [
    {
      "date": "string (mesmo do input)",
      "description": "string (mesmo do input)",
      "amount": number,
      "category": "string",
      "type": "fixa" | "variavel",
      "recorrente": boolean,
      "parcelado": boolean,
      "parcela_atual": number | null,
      "parcelas_total": number | null,
      "merchant": "string | null",
      "confidence": number
    }
  ]
}`;

    console.log(`[ai-categorize] Processing ${rows.length} txns with model ${model}`);

    const res = await aiFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 4096,
        temperature: 0,
      }),
    }, 30_000);

    if (!res.ok) {
      const errText = await res.text();
      console.error("[ai-categorize] AI gateway error:", res.status, errText);
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
        return new Response(JSON.stringify({ error: "Creditos de IA esgotados. Entre em contato com o suporte." }), {
          status: 402,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify({ error: "Erro ao chamar IA", details: errText }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    const data = await res.json();
    const outputText = data.choices?.[0]?.message?.content;

    if (!outputText) {
      console.error("[ai-categorize] No output found:", JSON.stringify(data).slice(0, 500));
      return new Response(JSON.stringify({ error: "Resposta inesperada da IA", raw: data }), {
        status: 502,
        headers: corsHeaders,
      });
    }

    // Extract JSON from response (handle possible markdown code blocks)
    let jsonStr = outputText.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }

    const parsed = JSON.parse(jsonStr);
    const estimatedTokens = Math.round(JSON.stringify(rows).length / 4 + outputText.length / 4);
    console.log(
      `[ai-categorize] Model: ${model}, Categorized ${parsed.items?.length ?? 0} items, ~${estimatedTokens} tokens`,
    );

    return new Response(JSON.stringify({ ...parsed, _meta: { model, estimated_tokens: estimatedTokens } }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (e: any) {
    if (e instanceof AiTimeoutError) {
      return new Response(JSON.stringify({ error: "A IA demorou para responder. Tente novamente em instantes." }), { status: 504, headers: corsHeaders });
    }
    console.error("[ai-categorize] Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
