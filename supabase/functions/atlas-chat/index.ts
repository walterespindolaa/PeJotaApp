import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { hasPremiumAccess, premiumDeniedResponse } from "../_shared/plan-check.ts";
import { checkAndIncrementQuota, quotaExceededResponse } from "../_shared/quota-check.ts";
import { projectRecurringForPeriod } from "../_shared/data-aggregator.ts";
import { getHouseholdUserIds } from "../_shared/household.ts";
import { aiFetch, AiTimeoutError } from "../_shared/ai-fetch.ts";

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub as string;

    // --- Plan validation ---
    const hasAccess = await hasPremiumAccess(supabase, userId);
    if (!hasAccess) return premiumDeniedResponse(corsHeaders);

    // Rate limiting: max 20 messages per minute per user.
    // Usa service_role (supabaseAdmin) para a RPC poder ser travada a service_role —
    // via client authenticated o _user_id seria spoofavel.
    const minuteKey = new Date().toISOString().slice(0, 16);
    const { data: rlData, error: rlError } = await supabaseAdmin
      .rpc("increment_rate_limit", {
        _user_id: userId,
        _minute_key: minuteKey
      });
    if (!rlError && (rlData as number) > 20) {
      return new Response(JSON.stringify({ error: "Muitas mensagens em pouco tempo. Aguarde um momento e tente novamente." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();

    // Input validation
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "messages is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Limit message count to prevent abuse
    if (messages.length > 50) {
      return new Response(JSON.stringify({ error: "Too many messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sanitize messages - only allow role and content, strip any system messages from user input
    const sanitizedMessages = messages
      .filter((m: any) => m.role === "user" || m.role === "assistant")
      .map((m: any) => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content.slice(0, 5000) : "",
      }));

    // Quota check (source of truth). Chamar antes do LLM.
    const quota = await checkAndIncrementQuota(authHeader, "chat");
    if (!quota.allowed) {
      return quotaExceededResponse(quota, "chat", corsHeaders);
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const MODEL = "gpt-4o-mini";

    let contextBlock = "";
    let userName = "Usuario";

    // Range do mês corrente
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

    // --- Fetch user financial context ---
    const monthRef = monthStart.substring(0, 7);

    // Resolver IDs de todos os membros do household (owner + members)
    // para buscar empresas de PF/PJ de toda a casa, nao so do user logado.
    const householdUserIds = await getHouseholdUserIds(supabase, userId);

    // Buscar owner_id do household pra resolver nomes de Pessoa 1/Pessoa 2
    let householdOwnerId = userId; // default: solo user
    {
      const { data: membership } = await supabase
        .from("household_members")
        .select("household_id")
        .eq("user_id", userId)
        .in("status", ["active", "invited"])
        .maybeSingle();
      const hhId = (membership as any)?.household_id || null;
      if (hhId) {
        const { data: hh } = await supabase
          .from("households")
          .select("owner_id")
          .eq("id", hhId)
          .maybeSingle();
        if ((hh as any)?.owner_id) householdOwnerId = (hh as any).owner_id;
      } else {
        // User pode ser o proprio owner
        const { data: owned } = await supabase
          .from("households")
          .select("id")
          .eq("owner_id", userId)
          .maybeSingle();
        if (owned) householdOwnerId = userId;
      }
    }

    // Mapear user_id -> nome de cada pessoa do household
    // Usar service-role pra contornar RLS de profiles
    // (necessario pra mapear nomes de outros membros do household).
    // Filtro restrito a householdUserIds garante que so retornamos o que e necessario.
    const { data: householdProfiles } = await supabaseAdmin
      .from("profiles")
      .select("user_id, full_name, nome_pessoa1, nome_pessoa2")
      .in("user_id", householdUserIds);

    const userNameMap: Record<string, string> = {};
    ((householdProfiles || []) as any[]).forEach((p: any) => {
      userNameMap[p.user_id] = p.full_name || p.nome_pessoa1 || "Pessoa";
    });

    const loggedUserName = userNameMap[userId] || "Voce";
    const otherHouseholdMembers = householdUserIds
      .filter((id: string) => id !== userId)
      .map((id: string) => ({ id, name: userNameMap[id] || "Outra pessoa" }));

    // Nomes literais de Pessoa 1 / Pessoa 2 (vivem no profile do owner)
    const ownerProfile = (householdProfiles || []).find((p: any) => p.user_id === householdOwnerId) as any;
    const nomePessoa1 = ownerProfile?.nome_pessoa1 || "Pessoa 1";
    const nomePessoa2 = ownerProfile?.nome_pessoa2 || "Pessoa 2";

    const [profileRes, aposentRes, invRes, bensRes, objRes, depRes, despRes, recRes, despRecRes, recRecRes, skipsRes, companiesRes, instRes] = await Promise.all([
      supabase.from("profiles").select("full_name, age, nome_pessoa1, nome_pessoa2").eq("user_id", userId).maybeSingle(),
      supabase.from("aposentadoria").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("investimentos_financeiros").select("user_id, nome, tipo, classe, valor_atual, is_reserva_emergencia, total_aportado").in("user_id", householdUserIds),
      supabase.from("investimentos_nao_financeiros").select("user_id, nome, tipo, valor, divida_vinculada, gera_renda, valor_renda").in("user_id", householdUserIds),
      supabase.from("objetivos").select("nome, valor_objetivo, valor_acumulado, data_objetivo, aporte_mensal").eq("user_id", userId),
      supabase.from("dependentes").select("nome, parentesco").in("user_id", householdUserIds),
      supabase.from("despesas").select("id, user_id, responsavel, categoria, valor, tipo, recorrente, is_parcelada, data").in("user_id", householdUserIds).gte("data", monthStart).lte("data", monthEnd).eq("is_parcelada", false),
      supabase.from("receitas").select("id, user_id, responsavel, categoria, valor, tipo, recorrente, recorrente_ate, data, status").in("user_id", householdUserIds).gte("data", monthStart).lte("data", monthEnd),
      supabase.from("despesas").select("id, user_id, responsavel, categoria, valor, tipo, recorrente, is_parcelada, data").in("user_id", householdUserIds).eq("recorrente", true).eq("is_parcelada", false),
      supabase.from("receitas").select("id, user_id, responsavel, categoria, valor, tipo, recorrente, recorrente_ate, data, status").in("user_id", householdUserIds).eq("recorrente", true),
      supabase.from("despesas_skip").select("template_id,month_ref,user_id").in("user_id", householdUserIds),
      supabase.from("companies").select("id,name,business_type,currency").in("user_id", householdUserIds).eq("archived", false),
      supabase.from("installment_instances" as any).select("user_id,amount,competencia,despesas(tipo_parcelamento, responsavel)").in("user_id", householdUserIds).eq("competencia", monthRef),
    ]);

    const profile = profileRes.data as any;
    const aposentadoria = aposentRes.data as any;
    const investimentos = invRes.data || [];
    const bens = bensRes.data || [];
    const objetivos = objRes.data || [];
    const dependentes = depRes.data || [];

    const despesasReais = (despRes.data || []) as any[];
    const despesasRecorrentes = (despRecRes.data || []) as any[];
    const skippedKeys = new Set(((skipsRes.data || []) as any[]).map((s: any) => `${s.template_id}:${s.month_ref}`));

    const despesasReaisFiltradas = despesasReais.filter((d: any) => {
      if (d.is_parcelada) return true;
      if (!d.recorrente) return true;
      const mes = (d.data || "").substring(0, 7);
      return !skippedKeys.has(`${d.id}:${mes}`);
    });
    const despesasRecorrentesFiltradas = despesasRecorrentes.filter((d: any) => {
      if (d.is_parcelada) return true;
      if (!d.recorrente) return true;
      return !skippedKeys.has(`${d.id}:${monthRef}`);
    });

    const despesas = projectRecurringForPeriod(despesasReaisFiltradas, despesasRecorrentesFiltradas, monthStart, monthEnd);

    const receitasReais = (recRes.data || []) as any[];
    const receitasRecorrentes = (recRecRes.data || []) as any[];
    const receitas = projectRecurringForPeriod(receitasReais, receitasRecorrentes, monthStart, monthEnd);

    userName = profile?.full_name || profile?.nome_pessoa1 || "Usuario";
    const patFin = investimentos.reduce((s: number, i: any) => s + Number(i.valor_atual || 0), 0);
    const patBens = bens.reduce((s: number, b: any) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0);
    const reserva = investimentos.filter((i: any) => i.is_reserva_emergencia).reduce((s: number, i: any) => s + Number(i.valor_atual || 0), 0);
    const _instData = (((instRes as any)?.data || []) as any[]);

    const parcelasTotal = _instData.filter((i: any) => (i.despesas?.tipo_parcelamento) !== "divida").reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    const dividasTotal = _instData.filter((i: any) => (i.despesas?.tipo_parcelamento) === "divida").reduce((s: number, i: any) => s + Number(i.amount || 0), 0);

    const installmentTotal = parcelasTotal + dividasTotal;
    // Parcelas com responsavel — pra agregar junto com despesas regulares no breakdown por pessoa
    const parcelasComResponsavel = (((instRes as any)?.data || []) as any[])
      .map((i: any) => ({
        responsavel: i.despesas?.responsavel || "Compartilhado",
        valor: Number(i.amount || 0),
      }));
    const totalDespSemParcelas = despesas.reduce((s: number, d: any) => s + Number(d.valor), 0);
    const totalDesp = totalDespSemParcelas + installmentTotal;
    const despesaCorrente = totalDespSemParcelas + parcelasTotal; // SEM dívida (Opção B)
    const totalRec = receitas.reduce((s: number, r: any) => s + Number(r.valor), 0);
    const poupanca = totalRec - totalDesp;
    const mesesReserva = totalDesp > 0 ? (reserva / totalDesp).toFixed(1) : "N/A";
    const totalAportesObj = objetivos.reduce((s: number, o: any) => s + Number(o.aporte_mensal || 0), 0);

    // Agregacoes por pessoa - patrimonio
    const investidoBreakdown = agregarPorPessoa(investimentos, "valor_atual");
    const bensBreakdown = agregarPorPessoa(
      bens.map((b: any) => ({ user_id: b.user_id, valor: Number(b.valor || 0) - Number(b.divida_vinculada || 0) })),
      "valor"
    );

    // Usa as projecoes (receitas, despesas) que ja sao deduplicadas
    // pelo projectRecurringForPeriod — evita double-counting de recorrentes.
    const despesasMesPorPessoa = agregarPorResponsavel([...despesas, ...parcelasComResponsavel], "valor");
    const receitasMesPorPessoa = agregarPorResponsavel(receitas, "valor");

  // --- Sumario do mes anterior (apenas totais, sem detalhe granular) ---
  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthStart = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const prevMonthEnd = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).toISOString().split("T")[0];
  const prevMonthRef = prevMonthStart.substring(0, 7);

  const nomesMeses = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  const nomeMesCorrente = nomesMeses[now.getMonth()];
  const nomeMesAnterior = nomesMeses[prevMonthDate.getMonth()];
  const anoCorrente = now.getFullYear();
  const anoAnterior = prevMonthDate.getFullYear();
  const dataHojeBR = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const [prevDespRes, prevRecRes, prevInstRes] = await Promise.all([
    supabase.from("despesas").select("user_id, responsavel, valor, recorrente, is_parcelada, data").in("user_id", householdUserIds).gte("data", prevMonthStart).lte("data", prevMonthEnd).eq("is_parcelada", false),
    supabase.from("receitas").select("user_id, responsavel, categoria, valor, recorrente, recorrente_ate, data").in("user_id", householdUserIds).gte("data", prevMonthStart).lte("data", prevMonthEnd),
    supabase.from("installment_instances" as any).select("user_id, amount, competencia, despesas(tipo_parcelamento, responsavel)").in("user_id", householdUserIds).eq("competencia", prevMonthRef),
  ]);

  const prevDespesasReais = (prevDespRes.data || []) as any[];
  const prevReceitasReais = (prevRecRes.data || []) as any[];

  // Filtrar templates recorrentes (recorrente=true) das listas reais — sao templates,
  // nao receitas/despesas pontuais. Eles sao projetados separadamente.
  const prevReceitasNaoRecorrentes = prevReceitasReais.filter((r: any) => !r.recorrente);
  const prevDespesasNaoRecorrentes = prevDespesasReais.filter((d: any) => !d.recorrente);

  // Projetar recorrentes pro mes anterior (igual logica do mes corrente).
  const prevDespesas = projectRecurringForPeriod(prevDespesasNaoRecorrentes, despesasRecorrentesFiltradas, prevMonthStart, prevMonthEnd);
  const prevReceitas = projectRecurringForPeriod(prevReceitasNaoRecorrentes, receitasRecorrentes, prevMonthStart, prevMonthEnd);

  const prevTotalRec = prevReceitas.reduce((s: number, r: any) => s + Number(r.valor), 0);
  const prevTotalDespSemParcelas = prevDespesas.reduce((s: number, d: any) => s + Number(d.valor), 0);
  const prevInstallmentTotal = (((prevInstRes as any)?.data || []) as any[])
    .reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
  const prevParcelasComResponsavel = (((prevInstRes as any)?.data || []) as any[])
    .map((i: any) => ({
      responsavel: i.despesas?.responsavel || "Compartilhado",
      valor: Number(i.amount || 0),
    }));
  const prevTotalDesp = prevTotalDespSemParcelas + prevInstallmentTotal;
  const prevPoupanca = prevTotalRec - prevTotalDesp;

  // Breakdown receitas mes anterior
  const prevReceitasPorCat = prevReceitas.reduce((acc: Record<string, number>, r: any) => {
    const cat = r.categoria || "Sem categoria";
    acc[cat] = (acc[cat] || 0) + Number(r.valor);
    return acc;
  }, {});
  const prevBreakdownReceitasBlock = Object.keys(prevReceitasPorCat).length === 0
    ? "  (nenhuma receita no mes anterior)"
    : Object.entries(prevReceitasPorCat)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([cat, total]) => `  • ${cat}: R$ ${(total as number).toLocaleString("pt-BR")}`)
        .join("\n");

  // Quebra por pessoa do mes anterior (mesma logica do mes corrente)
  const prevDespesasPorPessoa = agregarPorResponsavel([...prevDespesas, ...prevParcelasComResponsavel], "valor");
  const prevReceitasPorPessoa = agregarPorResponsavel(prevReceitas, "valor");

  // --- Historico dos ultimos 6 meses (totais simples) ---
  const historicoMeses: { mes: string; nomeMes: string; receitas: number; despesas: number; poupanca: number }[] = [];
  for (let i = 2; i <= 5; i++) {
    const hDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const hStart = `${hDate.getFullYear()}-${String(hDate.getMonth() + 1).padStart(2, "0")}-01`;
    const hEnd = new Date(hDate.getFullYear(), hDate.getMonth() + 1, 0).toISOString().split("T")[0];
    const hRef = hStart.substring(0, 7);
    const hNomeMes = nomesMeses[hDate.getMonth()];
    const hAno = hDate.getFullYear();

    const [hDespRes, hRecRes, hInstRes] = await Promise.all([
      supabase.from("despesas").select("valor").in("user_id", householdUserIds).gte("data", hStart).lte("data", hEnd).eq("is_parcelada", false).eq("recorrente", false),
      supabase.from("receitas").select("valor").in("user_id", householdUserIds).gte("data", hStart).lte("data", hEnd).eq("recorrente", false),
      supabase.from("installment_instances" as any).select("amount").in("user_id", householdUserIds).eq("competencia", hRef),
    ]);

    // Buscar recorrentes ativos naquele mes (mesma logica de projectRecurringForPeriod)
    const hDespRecurrentes = despesasRecorrentesFiltradas.filter((d: any) => d.data <= hEnd);
    const hRecRecurrentes = receitasRecorrentes.filter((r: any) => r.data <= hEnd);

    const hDespTotal = ((hDespRes.data || []) as any[]).reduce((s: number, d: any) => s + Number(d.valor), 0)
      + hDespRecurrentes.reduce((s: number, d: any) => s + Number(d.valor), 0)
      + ((hInstRes.data || []) as any[]).reduce((s: number, i: any) => s + Number(i.amount || 0), 0);
    const hRecTotal = ((hRecRes.data || []) as any[]).reduce((s: number, r: any) => s + Number(r.valor), 0)
      + hRecRecurrentes.reduce((s: number, r: any) => s + Number(r.valor), 0);

    historicoMeses.push({
      mes: hRef,
      nomeMes: `${hNomeMes} de ${hAno}`,
      receitas: hRecTotal,
      despesas: hDespTotal,
      poupanca: hRecTotal - hDespTotal,
    });
  }

  const historicoBlock = historicoMeses.length > 0
    ? historicoMeses.map(h => `  • ${h.nomeMes} (${h.mes}): receitas R$ ${Math.round(h.receitas).toLocaleString("pt-BR")}, despesas R$ ${Math.round(h.despesas).toLocaleString("pt-BR")}, poupanca R$ ${Math.round(h.poupanca).toLocaleString("pt-BR")}`).join("\n")
    : "  (sem dados historicos)";

  // Top 5 despesas individuais do mes (com data)
  const todasDespesasComData = [
    ...despesas.map((d: any) => ({
      categoria: d.categoria || "Sem categoria",
      valor: Number(d.valor),
      dia: (d.data || "").substring(8, 10),
    })),
    ...((instRes as any)?.data || [])
      .map((i: any) => ({
        categoria: "Parcelamento",
        valor: Number(i.amount || 0),
        dia: "varios",
      })),
  ].sort((a, b) => b.valor - a.valor).slice(0, 5);

  const topDespesasBlock = todasDespesasComData.length === 0
    ? "  (nenhuma despesa registrada este mes)"
    : todasDespesasComData
        .map((d: any) => `  • R$ ${d.valor.toLocaleString("pt-BR")} em ${d.categoria}${d.dia !== "varios" ? ` (dia ${d.dia})` : ""}`)
        .join("\n");

  // Breakdown de receitas por categoria
  const receitasPorCat = receitas.reduce((acc: Record<string, number>, r: any) => {
    const cat = r.categoria || "Sem categoria";
    acc[cat] = (acc[cat] || 0) + Number(r.valor);
    return acc;
  }, {});
  const breakdownReceitasBlock = Object.keys(receitasPorCat).length === 0
    ? "  (nenhuma receita registrada este mes)"
    : Object.entries(receitasPorCat)
        .sort(([, a], [, b]) => (b as number) - (a as number))
        .map(([cat, total]) => `  • ${cat}: R$ ${(total as number).toLocaleString("pt-BR")}`)
        .join("\n");

    // --- Fetch business transactions for ALL active companies in the current month ---
    const companies = ((companiesRes as any)?.data || []) as any[];
    const companyIds = companies.map((c: any) => c.id);
    let allBizTx: any[] = [];
    if (companyIds.length > 0) {
      const { data: bizTxData } = await supabase
        .from("business_transactions")
        .select("company_id,direction,amount,date")
        .in("company_id", companyIds)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      allBizTx = bizTxData || [];
    }

    const empresasBlock = companies.length === 0
      ? "- Empresas: nenhuma cadastrada"
      : `- Empresas (${companies.length}):\n` + companies.map((c: any) => {
          const tx = allBizTx.filter((t: any) => t.company_id === c.id);
          const rec = tx.filter((t: any) => t.direction === "in").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
          const desp = tx.filter((t: any) => t.direction === "out").reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
          return `  • ${c.name} (${c.business_type || "tipo nao definido"}): receita R$ ${rec.toLocaleString("pt-BR")}, despesa R$ ${desp.toLocaleString("pt-BR")}, resultado R$ ${(rec - desp).toLocaleString("pt-BR")}`;
        }).join("\n");

    // Helper para agregar valores por user_id (usado em investimentos/bens, que nao tem coluna responsavel)
    function agregarPorPessoa(items: any[], valorKey: string = "valor"): string {
      const porPessoa = householdUserIds.map((uid: string) => {
        const total = items
          .filter((i: any) => i.user_id === uid)
          .reduce((s: number, i: any) => s + Number(i[valorKey] || 0), 0);
        return { name: userNameMap[uid] || "Pessoa", total };
      }).filter(p => p.total > 0);

      if (porPessoa.length === 0) return "  (nenhum dado)";
      if (porPessoa.length === 1) return `  • ${porPessoa[0].name}: R$ ${porPessoa[0].total.toLocaleString("pt-BR")}`;

      const totalGeral = porPessoa.reduce((s, p) => s + p.total, 0);
      return porPessoa.map(p => `  • ${p.name}: R$ ${p.total.toLocaleString("pt-BR")}`).join("\n")
        + `\n  • Total da casa: R$ ${totalGeral.toLocaleString("pt-BR")}`;
    }

    // Agrega por coluna responsavel ("Pessoa 1" | "Pessoa 2" | "Compartilhado").
    // Retorna 3 linhas limpas, sem explicacao inline (que confundia a IA).
    function agregarPorResponsavel(items: any[], valorKey: string = "valor"): string {
      let p1 = 0, p2 = 0, compart = 0;
      for (const item of items) {
        const v = Number(item[valorKey] || 0);
        const r = item.responsavel;
        if (r === "Pessoa 1") p1 += v;
        else if (r === "Pessoa 2") p2 += v;
        else if (r === "Compartilhado") compart += v;
        else compart += v;
      }
      const totalCasal = p1 + p2 + compart;
      if (totalCasal === 0) return "  (nenhum dado registrado)";
      return [
        `  • ${nomePessoa1}: R$ ${(p1 + compart).toLocaleString("pt-BR")}`,
        `  • ${nomePessoa2}: R$ ${(p2 + compart).toLocaleString("pt-BR")}`,
        `  • Casal (total da casa): R$ ${totalCasal.toLocaleString("pt-BR")}`,
      ].join("\n");
    }

    contextBlock = `
ANCORAGEM TEMPORAL — LEIA ANTES DE QUALQUER RESPOSTA:
- DATA DE HOJE: ${dataHojeBR}
- MES CORRENTE: ${nomeMesCorrente} de ${anoCorrente} (${monthRef}) — voce tem DADOS DETALHADOS deste mes
- MES ANTERIOR: ${nomeMesAnterior} de ${anoAnterior} (${prevMonthRef}) — voce tem APENAS SUMARIO AGREGADO
- MESES ANTERIORES: voce tem SUMARIOS SIMPLES (totais da casa) dos ultimos 6 meses

REGRAS CRITICAS DE DATA — IGNORAR ESTAS REGRAS E UM ERRO GRAVE:
1. "Mes passado" / "mes anterior" SEMPRE significa ${nomeMesAnterior} de ${anoAnterior}, NUNCA ${nomeMesCorrente}.
2. "Este mes" / "mes corrente" / "mes atual" SEMPRE significa ${nomeMesCorrente} de ${anoCorrente}.
3. Para meses alem de ${nomeMesCorrente} e ${nomeMesAnterior}, voce tem APENAS totais simples (receita, despesa, poupanca) sem detalhes de categorias ou por pessoa.
4. NUNCA mencione meses futuros (depois de ${nomeMesCorrente} de ${anoCorrente}) sob NENHUMA circunstancia. Eles ainda nao aconteceram.
5. Se o usuario perguntar detalhes (categorias, por pessoa) de meses anteriores a ${nomeMesAnterior}, responda: "Tenho apenas os totais desse mes. Para detalhes, consulte o historico no app."

GLOSSARIO (use para mapear o vocabulario do usuario):
- "investido", "investimentos", "carteira" = Patrimonio financeiro
- "patrimonio liquido", "vale quanto" = Patrimonio total
- "salario", "renda" = veja breakdown de receitas por categoria abaixo
- "contas", "boletos", "vencimentos" = Despesas individuais + Parcelamentos (lista abaixo)
- "reserva", "fundo emergencia" = Reserva de emergencia
- "PJ", "empresa", "negocio" = secao Empresas

IDENTIDADE DA SESSAO:
- Voce esta conversando com: ${loggedUserName}
- Outras pessoas na casa: ${otherHouseholdMembers.length > 0 ? otherHouseholdMembers.map(p => p.name).join(", ") : "nenhuma"}

INSTRUCAO IMPORTANTE: Use "voce" para se referir a ${loggedUserName}. Use o nome proprio para se referir aos outros da casa (${otherHouseholdMembers.map(p => p.name).join(", ") || "ninguem mais"}). Quando o usuario perguntar sobre totais (gastos, receitas, investimentos), SEMPRE mostre a quebra por pessoa primeiro e depois o total do casal/casa.

ESCOPO PADRAO DAS RESPOSTAS (CRITICO — leia com atencao):

Os totais de despesas/receitas tem TRES escopos no Atlas, baseados na coluna "responsavel":
- ${nomePessoa1}: tudo do "${nomePessoa1}" individual + as despesas Compartilhadas do casal
- ${nomePessoa2}: tudo do "${nomePessoa2}" individual + as despesas Compartilhadas do casal
- Casal (total da casa): TUDO somado

REGRAS:
1. Quando ${loggedUserName} perguntar "quanto EU gastei/recebi", USE o numero do "${loggedUserName}" (que ja inclui as compartilhadas).
2. Quando perguntar "casal" / "nos juntos" / "a gente" / "casa" / "total", use "Casal (total da casa)".
3. Quando perguntar "quanto a ${otherHouseholdMembers[0]?.name || nomePessoa2} gastou/recebeu", use o numero da pessoa correspondente.
4. ATENCAO MATEMATICA: ${nomePessoa1} + ${nomePessoa2} > Casal, porque o "Compartilhado" e contado nos DOIS individuais. NUNCA tente somar os dois individuais — use sempre o "Casal (total da casa)" como resposta de soma.
5. Se quiser explicar pro usuario, pode dizer: "Esse total ja inclui as despesas do casal. Se quiser ver so o que e seu individual, sao R$ X."
6. CAPACIDADE DE POUPANCA NAO E DESPESA NEM RECEITA. E o que sobra (receitas - despesas). Quando o usuario perguntar sobre "quanto gastou", responda com DESPESAS. Quando perguntar "quanto sobrou" ou "quanto sobrou pra poupar", aí sim use a capacidade de poupanca. Nunca confunda esses conceitos.

IMPORTANTE: Os dados abaixo incluem dados PESSOAIS (PF) e dados das EMPRESAS (PJ) do usuario. Quando o usuario perguntar sem especificar, separe claramente PF vs cada empresa. NUNCA misture totais PF+PJ. NUNCA invente valores.

DADOS FINANCEIROS DE ${userName}:

Perfil:
- Idade: ${aposentadoria?.idade_atual || profile?.age || "nao informada"}
- Dependentes: ${dependentes.length > 0 ? dependentes.map((d: any) => `${d.nome} (${d.parentesco})`).join(", ") : "nenhum registrado"}

Patrimonio:
- Investido (financeiro) por pessoa:
${investidoBreakdown}
- Bens (imoveis, veiculos) por pessoa:
${bensBreakdown}
- Reserva de emergencia: R$ ${reserva.toLocaleString("pt-BR")} (${mesesReserva} meses de despesas)

Fluxo do mes corrente (${monthRef}):
- DESPESAS POR PESSOA (inclui despesas + parcelamentos + compartilhadas — bate com o card "Despesas+Parcelamentos" do Dashboard do Atlas):
${despesasMesPorPessoa}
- RECEITAS POR PESSOA (cada linha ja inclui as receitas Compartilhadas):
${receitasMesPorPessoa}
- Receitas (breakdown por categoria - casa): ${breakdownReceitasBlock}
- Nota: parcelamentos da casa (R$ ${installmentTotal.toLocaleString("pt-BR")}) JA ESTAO inclusos nas linhas de DESPESAS POR PESSOA acima. Nao some duas vezes.
- Despesa corrente da casa (fixas+variáveis+parcelas, SEM dívida): R$ ${despesaCorrente.toLocaleString("pt-BR")}
- Dívidas da casa (empréstimo/agiota — categoria à parte): R$ ${dividasTotal.toLocaleString("pt-BR")}
- Saídas totais (despesa corrente + dívidas): R$ ${totalDesp.toLocaleString("pt-BR")}
- Capacidade de poupanca da casa: R$ ${poupanca.toLocaleString("pt-BR")}
  (= poupança = receitas − saídas totais (inclui dívida) - NAO confundir com totais individuais ou de despesas)

Top 5 maiores despesas/parcelas do mes:
${topDespesasBlock}

Objetivos de vida: ${objetivos.length > 0 ? objetivos.map((o: any) => `${o.nome} (meta R$ ${Number(o.valor_objetivo).toLocaleString("pt-BR")}, acumulado R$ ${Number(o.valor_acumulado || 0).toLocaleString("pt-BR")}, aporte R$ ${Number(o.aporte_mensal || 0).toLocaleString("pt-BR")}/mes)`).join("; ") : "nenhum registrado"}
- Total de aportes mensais para objetivos: R$ ${totalAportesObj.toLocaleString("pt-BR")}

${empresasBlock}

Aposentadoria:
- Idade desejada: ${aposentadoria?.idade_aposentadoria || "nao definida"}
- Renda mensal desejada: R$ ${Number(aposentadoria?.renda_desejada || 0).toLocaleString("pt-BR")}
- Poupanca mensal atual: R$ ${Number(aposentadoria?.poupanca_mensal || 0).toLocaleString("pt-BR")}

Mes anterior (${prevMonthRef}) — sumario:
- DESPESAS POR PESSOA (inclui despesas + parcelamentos + compartilhadas — bate com o card "Despesas+Parcelamentos" do Dashboard do Atlas):
${prevDespesasPorPessoa}
- RECEITAS POR PESSOA:
${prevReceitasPorPessoa}
- Receitas (breakdown por categoria):
${prevBreakdownReceitasBlock}
- Capacidade de poupanca da casa: R$ ${prevPoupanca.toLocaleString("pt-BR")}
  (= receitas - despesas - NAO confundir com totais individuais ou de despesas)

Historico mensal dos ultimos meses (totais da casa, sem breakdown por pessoa):
${historicoBlock}

NOTA FINAL OBRIGATORIA:
Releia a ANCORAGEM TEMPORAL no inicio antes de mencionar qualquer mes na resposta. Voce tem dados detalhados de ${nomeMesCorrente}/${anoCorrente}, sumario agregado de ${nomeMesAnterior}/${anoAnterior}, e totais simples dos ultimos 6 meses (historico acima). NUNCA mencione meses fora desse historico ou meses futuros. Para detalhes (categorias, por pessoa) de meses anteriores a ${nomeMesAnterior}, redirecione ao historico do app.
`;

    const systemPromptTemplate = Deno.env.get("ATLAS_CHAT_SYSTEM_PROMPT");
    if (!systemPromptTemplate) throw new Error("ATLAS_CHAT_SYSTEM_PROMPT not configured");

    const systemPrompt = systemPromptTemplate
      .replace("{{USER_NAME}}", () => userName)
      .replace("{{CONTEXT_BLOCK}}", () => contextBlock);

    const response = await aiFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          ...sanitizedMessages,
        ],
        stream: true,
        max_completion_tokens: 4096,
        temperature: 0,
      }),
    }, 60_000);

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas perguntas em pouco tempo. Aguarde um momento e tente novamente." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Limite de uso atingido. Entre em contato com o suporte." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorBody = await response.text();
      console.error("[atlas-chat] AI gateway error:", response.status, "body:", errorBody.substring(0, 500));
      return new Response(JSON.stringify({ error: "Erro ao consultar assistente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    if (e instanceof AiTimeoutError) {
      return new Response(JSON.stringify({ error: "A IA demorou para responder. Tente novamente em instantes." }), {
        status: 504,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.error("[atlas-chat] error:", e instanceof Error ? e.message : "unknown");
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});