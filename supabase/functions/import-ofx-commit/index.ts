import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { hasPremiumAccess, premiumDeniedResponse } from "../_shared/plan-check.ts";

type ImportItem = {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense" | "transfer";
  tipo_despesa?: "fixa" | "variavel";
  responsavel: string;
  fit_id?: string | null;
};

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

    // Plan validation
    const hasAccess = await hasPremiumAccess(supabase, userId);
    if (!hasAccess) return premiumDeniedResponse(corsHeaders);

    const body = await req.json();
    const accountId: string | null = body?.account_id ?? null;
    const filename: string | null = typeof body?.filename === "string" ? body.filename : null;
    const items: ImportItem[] = Array.isArray(body?.items) ? body.items : [];

    if (items.length === 0) {
      return new Response(JSON.stringify({ error: "items vazio" }), { status: 400, headers: corsHeaders });
    }
    if (items.length > 500) {
      return new Response(JSON.stringify({ error: "Máximo de 500 itens por requisição" }), { status: 400, headers: corsHeaders });
    }

    for (const it of items) {
      if (!it.date || typeof it.amount !== "number" || !it.type) {
        return new Response(JSON.stringify({ error: "item inválido: date/amount/type obrigatórios" }), { status: 400, headers: corsHeaders });
      }
      if (!["income", "expense", "transfer"].includes(it.type)) {
        return new Response(JSON.stringify({ error: "type inválido" }), { status: 400, headers: corsHeaders });
      }
      if (it.tipo_despesa !== undefined && !["fixa", "variavel"].includes(it.tipo_despesa)) {
        return new Response(JSON.stringify({ error: "tipo_despesa inválido (esperado: fixa | variavel)" }), { status: 400, headers: corsHeaders });
      }
    }

    const { data, error } = await supabase.rpc("import_ofx_batch", {
      p_account_id: accountId,
      p_items: items,
      p_filename: filename,
    });

    if (error) {
      console.error("[import-ofx-commit] rpc error:", error);
      return new Response(JSON.stringify({ error: "Falha ao processar importação no banco" }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      inserted_transactions: data?.inserted_transactions ?? 0,
      inserted_receitas: data?.inserted_receitas ?? 0,
      inserted_despesas: data?.inserted_despesas ?? 0,
      skipped_duplicates: data?.skipped_duplicates ?? 0,
      import_id: data?.import_id ?? null,
    }), { status: 200, headers: corsHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[import-ofx-commit] error:", message);
    return new Response(JSON.stringify({ error: "Erro interno ao processar importação" }), { status: 500, headers: getCorsHeadersWithContentType(req) });
  }
});
