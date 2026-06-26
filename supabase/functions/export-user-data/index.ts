import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

// Exportação de dados do usuário (direito de portabilidade/acesso — LGPD).
// Verifica o JWT do solicitante e, com um client autenticado (RLS), coleta os
// dados das principais tabelas filtrando por user_id = auth.uid().
// Retorna { exported_at, data: { tabela: linhas[] } }.

// Tabelas exportadas. Algumas podem não existir em todos os ambientes —
// erros individuais (incluindo tabela inexistente) são ignorados por tabela.
const TABLES = [
  "profiles",
  "despesas",
  "receitas",
  "investimentos_financeiros",
  "objetivos",
  "aposentadoria",
  "business_companies",
  "companies",
  "business_transactions",
  "business_clients",
];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const data: Record<string, unknown[]> = {};

    for (const table of TABLES) {
      try {
        // RLS já restringe ao próprio usuário, mas filtramos por user_id por
        // segurança. Algumas tabelas podem não ter coluna user_id — nesse caso
        // o filtro falha e caímos no fallback sem filtro (ainda protegido por RLS).
        let rows: unknown[] | null = null;

        const filtered = await authClient.from(table).select("*").eq("user_id", user.id);
        if (filtered.error) {
          // Tabela inexistente ou sem coluna user_id — tenta sem o filtro.
          const fallback = await authClient.from(table).select("*");
          if (!fallback.error) rows = fallback.data;
        } else {
          rows = filtered.data;
        }

        if (rows) data[table] = rows;
      } catch (_e) {
        // Ignora erro individual de tabela (ex.: inexistente).
      }
    }

    const result = {
      exported_at: new Date().toISOString(),
      data,
    };

    return new Response(JSON.stringify(result), { status: 200, headers: corsHeaders });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: corsHeaders });
  }
});
