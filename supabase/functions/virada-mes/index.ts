import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getLastDayOfMonth } from "../_shared/date-helpers.ts";

// Shared replication logic
async function replicarMes(supabase: any, userId: string, mesOrigem: string, mesDestino: string) {
  const [yearDest, monthDest] = mesDestino.split("-").map(Number);
  const lastDayDest = new Date(yearDest, monthDest, 0).getDate();

  const { data: existing } = await supabase
    .from("meses_iniciados")
    .select("id")
    .eq("user_id", userId)
    .eq("mes_ano", mesDestino)
    .maybeSingle();

  if (existing) {
    return { skipped: true, reason: "already_initiated" };
  }

  // 1. Replicate recurring fixed expenses
  const { data: fixasRecorrentes } = await supabase
    .from("despesas")
    .select("*")
    .eq("user_id", userId)
    .eq("recorrente", true)
    .eq("tipo", "fixa")
    .eq("is_parcelada", false)
    .gte("data", `${mesOrigem}-01`)
    .lte("data", getLastDayOfMonth(mesOrigem));

  if (fixasRecorrentes && fixasRecorrentes.length > 0) {
    const newFixas = fixasRecorrentes.map((f: any) => {
      const dia = f.dia_vencimento || f.vencimento || 1;
      const diaReal = Math.min(dia, lastDayDest);
      return {
        user_id: userId,
        categoria: f.categoria,
        subcategoria: f.subcategoria,
        descricao: f.descricao,
        valor: f.ajuste_variacao ? (f.valor_base || f.valor) : (f.valor_base || f.valor),
        valor_base: f.valor_base || f.valor,
        tipo: "fixa",
        status: "a_pagar",
        vencimento: f.vencimento,
        dia_vencimento: f.dia_vencimento,
        forma_pagamento: f.forma_pagamento,
        recorrente: true,
        ajuste_variacao: f.ajuste_variacao,
        is_parcelada: false,
        data: `${mesDestino}-${String(diaReal).padStart(2, "0")}`,
        mes_referencia: mesDestino,
      };
    });
    await supabase.from("despesas").insert(newFixas);
  }

  // 2. Replicate recurring incomes
  const { data: ganhosRecorrentes } = await supabase
    .from("receitas")
    .select("*")
    .eq("user_id", userId)
    .eq("recorrente", true)
    .gte("data", `${mesOrigem}-01`)
    .lte("data", getLastDayOfMonth(mesOrigem));

  if (ganhosRecorrentes && ganhosRecorrentes.length > 0) {
    const newGanhos = ganhosRecorrentes.map((r: any) => {
      const dia = r.dia_recebimento || 1;
      const diaReal = Math.min(dia, lastDayDest);
      return {
        user_id: userId,
        categoria: r.categoria,
        descricao: r.descricao,
        valor: r.valor,
        tipo: r.tipo,
        status: "pendente",
        corresponde: r.corresponde,
        recorrente: true,
        dia_recebimento: r.dia_recebimento,
        porcentagem_economia: r.porcentagem_economia,
        data: `${mesDestino}-${String(diaReal).padStart(2, "0")}`,
      };
    });
    await supabase.from("receitas").insert(newGanhos);
  }

  // 3. Advance installments
  const { data: parcelasAtivas } = await supabase
    .from("despesas")
    .select("*")
    .eq("user_id", userId)
    .eq("is_parcelada", true)
    .gte("data", `${mesOrigem}-01`)
    .lte("data", getLastDayOfMonth(mesOrigem));

  let parcelasReplicadas = 0;
  if (parcelasAtivas && parcelasAtivas.length > 0) {
    const newParcelas = parcelasAtivas
      .filter((p: any) => Number(p.parcela_atual) < Number(p.total_parcelas))
      .map((p: any) => {
        const nextParcela = Number(p.parcela_atual) + 1;
        return {
          user_id: userId,
          categoria: p.categoria,
          subcategoria: p.subcategoria,
          descricao: p.descricao,
          valor: p.valor,
          valor_total: p.valor_total,
          tipo: p.tipo,
          status: "a_pagar",
          is_parcelada: true,
          total_parcelas: p.total_parcelas,
          parcela_atual: nextParcela,
          data_inicio_parcelas: p.data_inicio_parcelas,
          forma_pagamento: p.forma_pagamento,
          data: `${mesDestino}-${String(Math.min(new Date(p.data).getDate(), lastDayDest)).padStart(2, "0")}`,
          mes_referencia: mesDestino,
        };
      });

    if (newParcelas.length > 0) {
      await supabase.from("despesas").insert(newParcelas);
      parcelasReplicadas = newParcelas.length;
    }
  }

  // 4. Record month as initiated
  await supabase.from("meses_iniciados").insert({
    user_id: userId,
    mes_ano: mesDestino,
    origem: "manual",
  });

  return {
    skipped: false,
    replicated: {
      fixas: fixasRecorrentes?.length || 0,
      ganhos: ganhosRecorrentes?.length || 0,
      parcelas: parcelasReplicadas,
    },
  };
}

Deno.serve(async (req) => {
  const corsHeaders = {
    ...getCorsHeaders(req),
    "Content-Type": "application/json",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const isCron = body.cron === true;

    if (isCron) {
      // CRON MODE: require service_role key
      const authHeader = req.headers.get("Authorization") || "";
      const isServiceRole = authHeader === `Bearer ${supabaseKey}`;
      const cronSecret = Deno.env.get("CRON_SECRET");
      const isCronSecret = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;

      if (!isServiceRole && !isCronSecret) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      const now = new Date();
      const mesDestino = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      const mesOrigem = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

      const results = [];
      // Paginated fetch of active plans to support large user bases
      const PAGE = 500;
      let offset = 0;
      while (true) {
        const { data: plans } = await supabase
          .from("user_plans")
          .select("user_id")
          .eq("active", true)
          .order("user_id", { ascending: true })
          .range(offset, offset + PAGE - 1);

        if (!plans || plans.length === 0) break;

        for (const plan of plans) {
          const result = await replicarMes(supabase, plan.user_id, mesOrigem, mesDestino);
          results.push({ user_id: plan.user_id, ...result });
        }

        if (plans.length < PAGE) break;
        offset += PAGE;
      }

      return new Response(
        JSON.stringify({ success: true, processed: results.length, results }),
        { headers: corsHeaders }
      );
    }

    // MANUAL MODE: authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const userId = claimsData.claims.sub as string;

    const { mes_origem, mes_destino, fechar_mes } = body;

    if (!mes_origem || !mes_destino) {
      return new Response(
        JSON.stringify({ error: "mes_origem and mes_destino are required" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const result = await replicarMes(supabase, userId, mes_origem, mes_destino);

    if (result.skipped) {
      return new Response(
        JSON.stringify({ error: "Este mês já foi iniciado.", already_initiated: true }),
        { status: 409, headers: corsHeaders }
      );
    }

    if (fechar_mes) {
      await supabase.from("fechamentos_mensais").upsert({
        user_id: userId,
        mes_ano: mes_origem,
      }, { onConflict: "user_id,mes_ano" });
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: corsHeaders }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
