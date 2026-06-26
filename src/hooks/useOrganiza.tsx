import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useExpenseSkips } from "@/hooks/useExpenseSkips";
import { applyDerivedStatus } from "@/lib/deriveItemStatus";
import { mergeRecurring as mergeRecurringShared } from "@/lib/mergeRecurring";
import { upsertPagamentoMensal } from "@/lib/pagamentos";
import { logError, logWarn } from "@/lib/log";
import { computeMonthTotals } from "@/lib/computeMonthTotals";

export type Receita = {
  id: string;
  user_id: string;
  data: string;
  categoria: string;
  descricao: string | null;
  valor: number;
  tipo: string;
  status: string;
  corresponde: string | null;
  recorrente: boolean;
  dia_recebimento: number | null;
  porcentagem_economia: number | null;
  responsavel: string;
  created_at: string;
  updated_at: string;
  _virtual?: boolean;
  _originalId?: string;
};

export type Despesa = {
  id: string;
  user_id: string;
  data: string;
  categoria: string;
  subcategoria: string | null;
  descricao: string | null;
  valor: number;
  tipo: string;
  status: string;
  vencimento: number | null;
  forma_pagamento: string | null;
  is_parcelada: boolean;
  valor_total: number;
  total_parcelas: number;
  parcela_atual: number;
  data_inicio_parcelas: string | null;
  recorrente: boolean;
  dia_vencimento: number | null;
  ajuste_variacao: boolean;
  valor_base: number | null;
  mes_referencia: string | null;
  responsavel: string;
  tipo_parcelamento: string;
  created_at: string;
  updated_at: string;
  _virtual?: boolean;
  _originalId?: string;
};

export type Economia = {
  id: string;
  user_id: string;
  valor: number;
  destino_tipo: string;
  destino_id: string | null;
  descricao: string | null;
  data: string;
  responsavel: string;
  created_at: string;
  updated_at: string;
};

export type OrcamentoCategoria = {
  id: string | null;
  user_id: string;
  mes_ano: string;
  categoria: string;
  valor_limite: number;
  created_at: string;
  updated_at: string;
  _inherited?: boolean;
  _inheritedFromMonth?: string;
};

type BudgetWithFallbackRow = {
  id: string | null;
  categoria: string;
  valor_limite: number;
  is_inherited: boolean;
  inherited_from_month: string | null;
};

export type Pagamento = {
  id: string;
  user_id: string;
  ref_type: string;
  ref_id: string;
  mes: string;
  status: string;
  pago_em: string | null;
};

export type InstallmentInstance = {
  id: string;
  user_id: string;
  installment_id: string;
  competencia: string;
  due_date: string;
  installment_number: number;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
};

export type VisaoPessoa = "geral" | "pessoa1" | "pessoa2" | "casal";

export const useOrganiza = (mesAno: string, visaoPessoa: VisaoPessoa = "geral", enableInheritance: boolean = false) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [receitasRaw, setReceitasRaw] = useState<Receita[]>([]);
  const [despesasRaw, setDespesasRaw] = useState<Despesa[]>([]);
  const [economiasRaw, setEconomiasRaw] = useState<Economia[]>([]);
  const [orcamentos, setOrcamentos] = useState<OrcamentoCategoria[]>([]);
  const [pagamentosMap, setPagamentosMap] = useState<Record<string, Pagamento>>({});
  const [mesFechado, setMesFechado] = useState(false);
  const [mesIniciado, setMesIniciado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refetching, setRefetching] = useState(false);
  const isFirstLoad = useRef(true);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [nomePessoa1, setNomePessoa1] = useState("Pessoa 1");
  const [nomePessoa2, setNomePessoa2] = useState("Pessoa 2");
  const [fotoPessoa1, setFotoPessoa1] = useState("");
  const [fotoPessoa2, setFotoPessoa2] = useState("");
  const [vinculoPessoa2, setVinculoPessoa2] = useState("Cônjuge");

  const startDate = `${mesAno}-01`;
  const [year, month] = mesAno.split("-").map(Number);
  const endDate = new Date(year, month, 0).toISOString().split("T")[0];

  const [historico, setHistorico] = useState<{ mes: string; receitas: number; despesas: number; parcelas: number; economias: number; saldo: number }[]>([]);

  const filterByPessoa = useCallback(<T extends { responsavel?: string }>(items: T[]): T[] => {
    if (visaoPessoa === "geral") return items;
    if (visaoPessoa === "pessoa1") return items.filter(i => i.responsavel === "Pessoa 1" || i.responsavel === "Compartilhado");
    if (visaoPessoa === "pessoa2") return items.filter(i => i.responsavel === "Pessoa 2" || i.responsavel === "Compartilhado");
    if (visaoPessoa === "casal") return items; // casal = all members
    return items;
  }, [visaoPessoa]);

  // Build pagamento lookup key
  const pagKey = (refType: string, refId: string) => `${refType}:${refId}`;

  // Resolve status from pagamentos table for virtual items, or use item's own status
  const resolveStatus = useCallback((item: any, refType: string, today: string): string => {
    const realId = item._originalId || item.id;
    const key = pagKey(refType, realId);
    const pag = pagamentosMap[key];
    if (pag) return pag.status;
    // For non-virtual items, use their own status
    if (!item._virtual) return item.status || "pendente";
    // Virtual items WITHOUT pagamento: always start unpaid, never inherit "pago"
    let status = refType === "ganho" ? "pendente" : "a_pagar";
    const vencDia = item.dia_vencimento || item.vencimento || item.dia_recebimento;
    if (vencDia) {
      const vencDate = `${mesAno}-${String(vencDia).padStart(2, "0")}`;
      if (vencDate < today) {
           status = "em_atraso";
      }
    }
    return status;
  }, [pagamentosMap, mesAno]);

  const { skips } = useExpenseSkips();
  const skippedKeys = useMemo(
    () => new Set(skips.map(s => `${s.template_id}:${s.month_ref}`)),
    [skips]
  );

  const receitas = useMemo(() => filterByPessoa(receitasRaw), [receitasRaw, filterByPessoa]);
  const despesas = useMemo(() => filterByPessoa(despesasRaw), [despesasRaw, filterByPessoa]);
  const economias = useMemo(() => filterByPessoa(economiasRaw), [economiasRaw, filterByPessoa]);

  const anuais = useMemo(() => {
    const totR = historico.reduce((s, h) => s + h.receitas, 0);
    const totD = historico.reduce((s, h) => s + h.despesas, 0);
    const totE = historico.reduce((s, h) => s + h.economias, 0);
    const mesesAtivos = historico.filter(h => h.receitas > 0 || h.despesas > 0).length || 1;
    return {
      totalReceitas: totR, totalDespesas: totD, totalEconomias: totE,
      saldo: totR - totD,
      mediaReceitas: totR / mesesAtivos, mediaDespesas: totD / mesesAtivos,
      mediaEconomias: totE / mesesAtivos, mediaSaldo: (totR - totD) / mesesAtivos,
    };
  }, [historico]);

  const [todasParcelas, setTodasParcelas] = useState<Despesa[]>([]);

  const getParcelaForMonth = useCallback((parcela: Despesa, targetMesAno: string): Despesa | null => {
    if (!parcela.is_parcelada) return null;
    const startDateStr = parcela.data_inicio_parcelas || parcela.data;
    const [startY, startM] = startDateStr.substring(0, 7).split("-").map(Number);
    const [targetY, targetM] = targetMesAno.split("-").map(Number);
    const monthOffset = (targetY - startY) * 12 + (targetM - startM);
    const parcelaAtualOriginal = Number(parcela.parcela_atual) || 1;
    const totalParcelas = Number(parcela.total_parcelas) || 1;
    const parcelaNestesMes = parcelaAtualOriginal + monthOffset;
    if (parcelaNestesMes < 1 || parcelaNestesMes > totalParcelas) return null;
    return {
      ...parcela,
      id: monthOffset === 0 ? parcela.id : `virtual_parc_${parcela.id}_${targetMesAno}`,
      parcela_atual: parcelaNestesMes,
      _virtual: monthOffset !== 0,
      _originalId: parcela.id,
    } as any;
  }, []);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    if (isFirstLoad.current) setLoading(true);
    else setRefetching(true);
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    const [r, d, e, f, m, rYear, dYear, eYear, orc, allParcelas, profileRes, recDespesas, recReceitas, pagRes, instRes] = await Promise.all([
      supabase.from("receitas").select("*").eq("user_id", user.id).gte("data", startDate).lte("data", endDate),
      supabase.from("despesas").select("*").eq("user_id", user.id).gte("data", startDate).lte("data", endDate).eq("is_parcelada", false),
      supabase.from("economias").select("*").eq("user_id", user.id).gte("data", startDate).lte("data", endDate),
      supabase.from("fechamentos_mensais").select("id").eq("user_id", user.id).eq("mes_ano", mesAno).maybeSingle(),
      supabase.from("meses_iniciados").select("id").eq("user_id", user.id).eq("mes_ano", mesAno).maybeSingle(),
      supabase.from("receitas").select("data,valor,status").eq("user_id", user.id).gte("data", yearStart).lte("data", yearEnd),
      supabase.from("despesas").select("data,valor").eq("user_id", user.id).gte("data", yearStart).lte("data", yearEnd),
      supabase.from("economias").select("data,valor").eq("user_id", user.id).gte("data", yearStart).lte("data", yearEnd),
      enableInheritance
        ? supabase.rpc("get_budget_with_fallback", { p_user_id: user.id, p_mes_ano: mesAno })
        : supabase.from("orcamentos_categorias").select("*").eq("user_id", user.id).eq("mes_ano", mesAno),
      supabase.from("despesas").select("*").eq("user_id", user.id).eq("is_parcelada", true),
      supabase.from("profiles").select("nome_pessoa1,nome_pessoa2,foto_pessoa1,foto_pessoa2,vinculo_pessoa2").eq("user_id", user.id).maybeSingle(),
      supabase.from("despesas").select("*").eq("user_id", user.id).eq("recorrente", true).eq("is_parcelada", false),
      supabase.from("receitas").select("*").eq("user_id", user.id).eq("recorrente", true),
      supabase.from("pagamentos").select("*").eq("user_id", user.id).eq("mes", mesAno),
      supabase.from("installment_instances" as any).select("*").eq("user_id", user.id).eq("competencia", mesAno),
    ]);

    if (instRes.error) {
      logError("[useOrganiza] CRITICAL: instances query failed — skipping generation to avoid overwriting paid rows:", instRes.error);
      setLoading(false);
      setRefetching(false);
      isFirstLoad.current = false;
      return;
    }

    // Build pagamentos map
    const pMap: Record<string, Pagamento> = {};
    ((pagRes.data as Pagamento[]) || []).forEach(p => {
      pMap[pagKey(p.ref_type, p.ref_id)] = p;
    });
    setPagamentosMap(pMap);

    const today = new Date().toISOString().split("T")[0];

    const monthReceitas = (r.data as Receita[]) || [];
    const monthDespesasNonParc = (d.data as Despesa[]) || [];
    const recurringDespesas = (recDespesas.data as Despesa[]) || [];
    const recurringReceitas = (recReceitas.data as Receita[]) || [];
    const allParcelasData = (allParcelas.data as Despesa[]) || [];
    const existingInstances = ((instRes.data as unknown as InstallmentInstance[]) || []);

    // Build instance map by installment_id
    const instanceMap = new Map<string, InstallmentInstance>();
    existingInstances.forEach(inst => instanceMap.set(inst.installment_id, inst));

    // Auto-generate missing instances for active parcelas in this month
    const missingInstances: any[] = [];
    allParcelasData.forEach(p => {
      const computed = getParcelaForMonth(p, mesAno);
      if (computed && !instanceMap.has(p.id)) {
        const vencDia = p.dia_vencimento || p.vencimento || new Date(p.data + "T12:00:00").getDate();
        const lastDay = new Date(year, month, 0).getDate();
        const dia = Math.min(vencDia || 1, lastDay);
        const dueDate = `${mesAno}-${String(dia).padStart(2, "0")}`;
        missingInstances.push({
          user_id: user.id,
          installment_id: p.id,
          competencia: mesAno,
          due_date: dueDate,
          installment_number: computed.parcela_atual,
          amount: Number(p.valor),
          status: dueDate < today ? "late" : "pending",
        });
      }
    });

    if (missingInstances.length > 0) {
      const { data: inserted, error: upsertErr } = await supabase
        .from("installment_instances" as any)
        .upsert(missingInstances, {
          onConflict: "installment_id,competencia",
          ignoreDuplicates: true,
        })
        .select();
      if (upsertErr) {
        logError("[useOrganiza] failed to upsert missing installment_instances:", upsertErr, { missingCount: missingInstances.length });
      }
      ((inserted as unknown as InstallmentInstance[]) || []).forEach(inst => instanceMap.set(inst.installment_id, inst));
    }

    // Status derivado: "em_atraso" nao e um estado real no banco — e label visual.
    // Render calcula overdue a partir de _rawStatus + _dueDate.
    const statusMap: Record<string, string> = { paid: "pago", late: "em_atraso", pending: "a_pagar" };
    const parcelasDoMes: Despesa[] = [];
    allParcelasData.forEach(p => {
      const computed = getParcelaForMonth(p, mesAno);
      if (!computed) return;
      const inst = instanceMap.get(p.id);
      parcelasDoMes.push({
        ...computed,
        status: inst ? (statusMap[inst.status] || "a_pagar") : "a_pagar",
        _rawStatus: inst?.status || "pending",
        _dueDate: inst?.due_date,
        valor: inst ? inst.amount : Number(p.valor),
        _instanceId: inst?.id,
      } as any);
    });

    const mergedReceitas = mergeRecurringShared(monthReceitas, recurringReceitas, "data", mesAno) as Receita[];
    const mergedDespesas = mergeRecurringShared(monthDespesasNonParc, recurringDespesas, "data", mesAno) as Despesa[];

    // Apply pagamentos status to receitas and despesas (NOT parcelas - they use instances)
    const finalReceitas = applyDerivedStatus(mergedReceitas as any, pMap, "ganho", mesAno, today);
    const finalDespesas = applyDerivedStatus(mergedDespesas as any, pMap, "despesa", mesAno, today);
    // Parcelas already have status from installment_instances — no derivacao de pagamentos

    const allDespesasMes = [...finalDespesas, ...parcelasDoMes];
    const allDespesasMesMarked = allDespesasMes.map((item: any) => {
      if (item.is_parcelada) return item;
      if (!item.recorrente) return item;
      const baseId = item._originalId || item.id;
      const key = `${baseId}:${mesAno}`;
      if (skippedKeys.has(key)) {
        return { ...item, _skipped: true };
      }
      return item;
    });

    setReceitasRaw(finalReceitas as unknown as Receita[]);
    setDespesasRaw(allDespesasMesMarked as unknown as Despesa[]);
    setEconomiasRaw((e.data as Economia[]) || []);
    if (enableInheritance) {
      const rpcRows = (orc.data as BudgetWithFallbackRow[] | null) || [];
      const mapped: OrcamentoCategoria[] = rpcRows.map(row => ({
        id: row.id,
        user_id: user.id,
        mes_ano: mesAno,
        categoria: row.categoria,
        valor_limite: Number(row.valor_limite),
        created_at: "",
        updated_at: "",
        _inherited: row.is_inherited,
        _inheritedFromMonth: row.inherited_from_month || undefined,
      }));
      setOrcamentos(mapped);
    } else {
      setOrcamentos((orc.data as OrcamentoCategoria[]) || []);
    }
    setTodasParcelas(allParcelasData);
    setMesFechado(!!f.data);
    setMesIniciado(!!m.data);
    if (profileRes.data) {
      setNomePessoa1((profileRes.data as any).nome_pessoa1 || "Pessoa 1");
      setNomePessoa2((profileRes.data as any).nome_pessoa2 || "Pessoa 2");
      setFotoPessoa1((profileRes.data as any).foto_pessoa1 || "");
      setFotoPessoa2((profileRes.data as any).foto_pessoa2 || "");
      setVinculoPessoa2((profileRes.data as any).vinculo_pessoa2 || "Cônjuge");
    }

    // =============================================
    // HISTÓRICO PROJETADO (forecast) — usa mergeRecurring para todos os meses
    // =============================================
    const rawReceitasYear = (rYear.data || []) as any[];
    const rawDespesasYear = (dYear.data || []) as any[];
    const rawEconomiasYear = (eYear.data || []) as any[];

    const hist = [];
    for (let i = 1; i <= 12; i++) {
      const mm = String(i).padStart(2, "0");
      const targetMes = `${year}-${mm}`;

      // Receitas: physical items of this month + recurring projections
      const monthRec = rawReceitasYear.filter((x: any) => x.data?.substring(5, 7) === mm);
      const mergedRec = mergeRecurringShared(monthRec, recurringReceitas, "data", targetMes);
      const receitaTotal = mergedRec.reduce((s: number, x: any) => s + Number(x.valor), 0);

      // Despesas (non-parcelada): physical items + recurring projections
      const monthDesp = rawDespesasYear.filter((x: any) => x.data?.substring(5, 7) === mm);
      const mergedDesp = mergeRecurringShared(monthDesp, recurringDespesas, "data", targetMes);
      const mergedDespFiltered = mergedDesp.filter((item: any) => {
        if (item.is_parcelada) return true;
        if (!item.recorrente) return true;
        const baseId = item._originalId || item.id;
        const key = `${baseId}:${targetMes}`;
        return !skippedKeys.has(key);
      });
      const despesaTotal = mergedDespFiltered.reduce((s: number, x: any) => s + Number(x.valor), 0);

      // Parcelas: already projected via getParcelaForMonth
      let parcelasTotal = 0;
      allParcelasData.forEach(p => {
        const computed = getParcelaForMonth(p, targetMes);
        if (computed) parcelasTotal += Number(computed.valor);
      });

      // Economias planejadas: derived from projected receitas
      const economiaPlanejada = mergedRec.reduce((s: number, r: any) => {
        if (r.porcentagem_economia && r.porcentagem_economia > 0) {
          return s + (Number(r.valor) * Number(r.porcentagem_economia) / 100);
        }
        return s;
      }, 0);

      hist.push({
        mes: new Date(year, i - 1).toLocaleDateString("pt-BR", { month: "short" }),
        receitas: receitaTotal,
        despesas: despesaTotal,
        parcelas: parcelasTotal,
        economias: economiaPlanejada,
        saldo: receitaTotal - despesaTotal - parcelasTotal - economiaPlanejada,
      });
    }
    setHistorico(hist);
    setLoading(false);
    setRefetching(false);
    isFirstLoad.current = false;
  }, [user, startDate, endDate, mesAno, year, getParcelaForMonth, skippedKeys, enableInheritance]);

  useEffect(() => {
    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const load = async () => {
      try {
        setError(null);
        if (!cancelled) await fetchAll();
        retryCount = 0;
      } catch (err: any) {
        if (cancelled) return;
        logError("[useOrganiza] load error:", err);
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 8000);
          setTimeout(load, delay);
        } else {
          setError("Não foi possível carregar seus dados. Verifique sua conexão.");
          setLoading(false);
          setRefetching(false);
          isFirstLoad.current = false;
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [fetchAll]);

  // Refetch when external mutations (e.g. QuickAdd FAB) dispatch the event
  useEffect(() => {
    const handler = () => { fetchAll(); };
    window.addEventListener("atlas:organiza-refetch", handler);
    return () => window.removeEventListener("atlas:organiza-refetch", handler);
  }, [fetchAll]);

  // =============================================
  // CÁLCULOS — MODELO DUAL (REAL + PREVISTO)
  // =============================================

  // ============================================
  // CÁLCULOS — usa computeMonthTotals (regra centralizada em src/lib/computeMonthTotals.ts)
  // ============================================
  const totals = useMemo(
    () => computeMonthTotals({
      despesas: despesas as any,
      receitas: receitas as any,
    }),
    [despesas, receitas]
  );

  const totalGanhos = totals.totalReceitas;
  const ganhosRecebidos = totals.receitasRecebidas;

  const fixas = totals.fixas as any[];
  const variaveis = totals.variaveis as any[];
  const parcelas = totals.parcelas as any[];
  const dividas = totals.dividas as any[];

  const totalFixas = totals.totalFixas;
  const totalVariaveis = totals.totalVariaveis;
  const totalParcelas = totals.totalParcelas;
  const totalDividasMes = totals.totalDividas;

  const parcelasPagas = useMemo(
    () => parcelas.filter((p: any) => p.status === "pago").reduce((s: number, p: any) => s + Number(p.valor), 0),
    [parcelas]
  );
  const dividasPagas = totals.dividasPagas;

  const totalDespesasFixasVar = totalFixas + totalVariaveis;
  const despesasPagas = totals.despesasPagas;
  const totalDespesas = totals.totalDespesas;

  // ECONOMIAS
  const totalEconomias = useMemo(() => economias.reduce((s, e) => s + Number(e.valor), 0), [economias]);
  const economiasPlanejadas = useMemo(() => {
    return receitas.reduce((s, r) => {
      if (r.porcentagem_economia && r.porcentagem_economia > 0) {
        return s + (Number(r.valor) * Number(r.porcentagem_economia) / 100);
      }
      return s;
    }, 0);
  }, [receitas]);

  // SALDO
  // SALDO REAL: o que SAIU da conta. despesasPagas já inclui parcelas pagas (S3).
  // Economias são sempre realizadas (registradas só quando aportadas).
  const saldoReal = ganhosRecebidos - despesasPagas - totalEconomias;
  const saldoPrevisto = totalGanhos - totalDespesas - economiasPlanejadas;
  const saldoDisponivel = saldoPrevisto;

  // TAXA DE POUPANÇA
  const taxaPoupancaReal = ganhosRecebidos > 0 ? (totalEconomias / ganhosRecebidos) * 100 : 0;
  const taxaPoupancaPrev = totalGanhos > 0 ? (economiasPlanejadas / totalGanhos) * 100 : 0;
  const taxaPoupanca = taxaPoupancaPrev;

  // GRAU DE COMPROMISSO
  const grauCompromissoReal = ganhosRecebidos > 0
    ? ((despesasPagas + totalEconomias) / ganhosRecebidos) * 100
    : 0;
  const grauCompromissoPrev = totalGanhos > 0
    ? ((totalDespesas + economiasPlanejadas) / totalGanhos) * 100
    : 0;
  const grauCompromisso = grauCompromissoPrev;

  const orcamentoInheritanceState = useMemo(() => {
    const inheritedRow = orcamentos.find(o => o._inherited);
    return {
      isInherited: !!inheritedRow,
      fromMonth: inheritedRow?._inheritedFromMonth || null,
    };
  }, [orcamentos]);

  // Budget per category
  const orcamentoPorCategoria = useMemo(() => {
    const gastoPorCat: Record<string, number> = {};
    despesas.forEach(d => {
      const cat = d.categoria || "Outros";
      gastoPorCat[cat] = (gastoPorCat[cat] || 0) + Number(d.valor);
    });
    const limitePorCat: Record<string, number> = {};
    orcamentos.forEach(o => { limitePorCat[o.categoria] = Number(o.valor_limite); });
    const allCats = new Set([...Object.keys(gastoPorCat), ...Object.keys(limitePorCat)]);
    return Array.from(allCats).map(cat => ({
      categoria: cat, gasto: gastoPorCat[cat] || 0, limite: limitePorCat[cat] || 0,
      percentual: limitePorCat[cat] ? ((gastoPorCat[cat] || 0) / limitePorCat[cat]) * 100 : 0,
    })).sort((a, b) => b.gasto - a.gasto);
  }, [despesas, orcamentos]);

  // Installment projection
  const projecaoParcelas = useMemo(() => {
    const result: { mes: string; valor: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const m = ((month - 1 + i) % 12) + 1;
      const y = year + Math.floor((month - 1 + i) / 12);
      const targetMes = `${y}-${String(m).padStart(2, "0")}`;
      let total = 0;
      todasParcelas.forEach(p => {
        const computed = getParcelaForMonth(p, targetMes);
        if (computed) total += Number(computed.valor);
      });
      if (total > 0) {
        result.push({
          mes: new Date(y, m - 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
          valor: total,
        });
      }
    }
    return result;
  }, [todasParcelas, month, year, getParcelaForMonth]);

  const totalDividas = totalDividasMes;
  const totalDividasRestante = useMemo(() => {
    return todasParcelas
      .filter(p => p.tipo_parcelamento === "divida")
      .reduce((s, p) => {
        const remaining = Number(p.total_parcelas) - Number(p.parcela_atual) + 1;
        return s + Number(p.valor) * remaining;
      }, 0);
  }, [todasParcelas]);
  const mesesAteZerarParcelas = projecaoParcelas.length;

  const planejadoTotal = useMemo(() => orcamentos.reduce((s, o) => s + Number(o.valor_limite), 0), [orcamentos]);
  const dentroDoPlanejado = planejadoTotal > 0 ? totalDespesas <= planejadoTotal : true;

  const steps = useMemo(() => [
    { label: "Ganhos registrados", done: receitas.length > 0 },
    { label: "Recebimentos confirmados", done: receitas.length > 0 && receitas.some(r => r.status === "recebido") },
    { label: "Fixas quitadas", done: fixas.length > 0 && fixas.every(f => f.status === "pago") },
    { label: "Parcelas registradas", done: parcelas.length === 0 || parcelas.every(p => p.status === "pago") },
    { label: "Economia separada", done: economias.length > 0 },
  ], [receitas, fixas, parcelas, economias]);

  const progressPercent = useMemo(() => {
    const done = steps.filter(s => s.done).length;
    return Math.round((done / steps.length) * 100);
  }, [steps]);

  // =============================================
  // UPSERT PAGAMENTO (status mensal para virtuais e reais)
  // =============================================
  const upsertPagamento = async (refType: string, refId: string, status: string) => {
    if (!user) return;
    await upsertPagamentoMensal({
      userId: user.id,
      refType: refType as any,
      refId,
      mesAno,
      status,
    });
    fetchAll();
  };

  // CRUD helpers
  const addReceita = async (data: Partial<Receita>) => {
    if (!user) return;
    const { error } = await supabase.from("receitas").insert({ ...data, user_id: user.id } as any);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const updateReceita = async (id: string, data: Partial<Receita>) => {
    // Extract real ID for virtual items
    const realId = id.startsWith("virtual_")
      ? id.replace(/^virtual_/, "").split("_").filter(part =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
        )[0] || id
      : id;
    
    // If updating status on a virtual item, use pagamentos
    if (data.status && id.startsWith("virtual_")) {
      await upsertPagamento("ganho", id, data.status);

      // Se o drawer enviou tambem outros campos (valor, descricao, etc.), segue o fluxo
      // para gravar na template row (realId). So retorna cedo quando e update exclusivo de status.
      const hasOtherFields = Object.keys(data).some(k => k !== "status");
      if (!hasOtherFields) {
        return;
      }
    }

    const { error } = await supabase.from("receitas").update(data as any).eq("id", realId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const deleteReceita = async (id: string) => {
    const realId = id.startsWith("virtual_")
      ? id.replace(/^virtual_/, "").split("_").filter(part =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
        )[0] || id
      : id;
    const { error } = await supabase.from("receitas").delete().eq("id", realId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const generateInstances = async (installmentId: string, data: Partial<Despesa>) => {
    if (!user) return;
    const totalP = Number(data.total_parcelas || 1);
    const parcelaAtual = Number(data.parcela_atual || 1);
    const valorParcela = Number(data.valor || 0);
    const startDateStr = data.data_inicio_parcelas || data.data || `${mesAno}-01`;
    const startD = new Date(startDateStr + "T12:00:00");
    const vencDia = startD.getDate();
    const todayStr = new Date().toISOString().split("T")[0];

    const instances: any[] = [];
    for (let i = 0; i <= totalP - parcelaAtual; i++) {
      const instDate = new Date(startD.getFullYear(), startD.getMonth() + i, 1);
      const comp = `${instDate.getFullYear()}-${String(instDate.getMonth() + 1).padStart(2, "0")}`;
      const lastDay = new Date(instDate.getFullYear(), instDate.getMonth() + 1, 0).getDate();
      const dia = Math.min(vencDia, lastDay);
      const dueDate = `${comp}-${String(dia).padStart(2, "0")}`;
      instances.push({
        user_id: user.id,
        installment_id: installmentId,
        competencia: comp,
        due_date: dueDate,
        installment_number: parcelaAtual + i,
        amount: valorParcela,
        status: dueDate < todayStr ? "late" : "pending",
      });
    }
    if (instances.length > 0) {
      await supabase.from("installment_instances" as any).insert(instances);
    }
  };

  const updateInstanceStatus = async (instanceId: string, newStatus: string) => {
    if (!user) return;
    const mapStatus: Record<string, string> = {
      pago: "paid", a_pagar: "pending", em_atraso: "late",
      paid: "paid", pending: "pending", late: "late",
    };
    const dbStatus = mapStatus[newStatus];
    if (!dbStatus) {
      logWarn("[updateInstanceStatus] invalid status:", newStatus);
      toast({ title: "Erro", description: `Status inválido: ${newStatus}`, variant: "destructive" });
      return;
    }
    const paidAt = dbStatus === "paid" ? new Date().toISOString() : null;
    const { error } = await supabase
      .from("installment_instances" as any)
      .update({ status: dbStatus, paid_at: paidAt })
      .eq("id", instanceId);
    if (error) {
      logError("[useOrganiza] updateInstanceStatus error:", error);
      toast({ title: "Erro ao atualizar parcela", description: error.message, variant: "destructive" });
      return;
    }
    await fetchAll();
  };

  const addDespesa = async (data: Partial<Despesa>) => {
    if (!user) return;
    const { data: inserted, error } = await supabase
      .from("despesas")
      .insert({ ...data, user_id: user.id } as any)
      .select("id")
      .single();
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      // If parcelada, generate all installment instances
      if (data.is_parcelada && inserted) {
        await generateInstances((inserted as any).id, data);
      }
      fetchAll();
    }
  };

  const updateDespesa = async (id: string, data: Partial<Despesa>) => {
    const realId = id.startsWith("virtual_")
      ? id.replace(/^virtual_(parc_)?/, "").split("_").filter(part =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
        )[0] || id
      : id;
    
    // If updating status on a virtual item, use pagamentos
    if (data.status && id.startsWith("virtual_")) {
      const refType = id.includes("parc_") ? "parcela" : "despesa";
      await upsertPagamento(refType, id, data.status);

      // Se ha outros campos alem de status, segue para o update na template row.
      const hasOtherFields = Object.keys(data).some(k => k !== "status");
      if (!hasOtherFields) {
        return;
      }
    }

    const { error } = await supabase.from("despesas").update(data as any).eq("id", realId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const deleteDespesa = async (id: string) => {
    const realId = id.startsWith("virtual_")
      ? id.replace(/^virtual_(parc_)?/, "").split("_").filter(part =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part)
        )[0] || id
      : id;
    const { error } = await supabase.from("despesas").delete().eq("id", realId);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const addEconomia = async (data: Partial<Economia>) => {
    if (!user) return;
    const { error } = await supabase.from("economias").insert({ ...data, user_id: user.id } as any);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const deleteEconomia = async (id: string) => {
    const { error } = await supabase.from("economias").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const upsertOrcamento = async (categoria: string, valorLimite: number) => {
    if (!user) return;
    const existing = orcamentos.find(o => o.categoria === categoria);
    // UPDATE só com UUID real. Falsy id (null/""/undefined) ou _inherited força INSERT —
    // o default gen_random_uuid() da tabela cuida da PK.
    const hasRealId = !!existing && !!existing.id && !existing._inherited;
    if (hasRealId) {
      const { error } = await supabase.from("orcamentos_categorias").update({ valor_limite: valorLimite } as any).eq("id", existing!.id as string);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else {
        fetchAll();
        window.dispatchEvent(new Event("atlas:organiza-refetch"));
      }
    } else {
      const { error } = await supabase.from("orcamentos_categorias").insert({ user_id: user.id, mes_ano: mesAno, categoria, valor_limite: valorLimite } as any);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else {
        fetchAll();
        window.dispatchEvent(new Event("atlas:organiza-refetch"));
      }
    }
  };

  const confirmarOrcamentoHerdado = async (): Promise<number> => {
    if (!user || !orcamentoInheritanceState.fromMonth) return 0;
    const { data, error } = await supabase.rpc("confirm_inherited_budget", {
      p_user_id: user.id,
      p_mes_ano: mesAno,
      p_source_mes_ano: orcamentoInheritanceState.fromMonth,
    });
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return 0;
    }
    fetchAll();
    window.dispatchEvent(new Event("atlas:organiza-refetch"));
    return typeof data === "number" ? data : 0;
  };

  const deleteOrcamento = async (id: string) => {
    const { error } = await supabase.from("orcamentos_categorias").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else fetchAll();
  };

  const updateNomePessoa = async (pessoa: "pessoa1" | "pessoa2", nome: string) => {
    if (!user) return;
    const field = pessoa === "pessoa1" ? "nome_pessoa1" : "nome_pessoa2";
    const { error } = await supabase.from("profiles").update({ [field]: nome } as any).eq("user_id", user.id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      if (pessoa === "pessoa1") setNomePessoa1(nome);
      else setNomePessoa2(nome);
    }
  };

  const iniciarMes = async (mesDestino: string) => {
    if (!user) return;
    setInitiating(true);
    try {
      const { data, error } = await supabase.functions.invoke("virada-mes", {
        body: { mes_origem: mesAno, mes_destino: mesDestino },
      });
      if (error) throw error;
      if (data?.already_initiated) {
        toast({ title: "Mês já iniciado", description: "Este mês já foi criado anteriormente.", variant: "destructive" });
      } else {
        toast({
          title: "Novo mês iniciado!",
          description: `Replicados: ${data.replicated.fixas} fixas, ${data.replicated.ganhos} ganhos, ${data.replicated.parcelas} parcelas.`,
        });
      }
      fetchAll();
    } catch (err: any) {
      const msg = err?.message || "Erro ao iniciar mês";
      if (msg.includes("already_initiated") || msg.includes("já foi iniciado")) {
        toast({ title: "Mês já iniciado", description: "Este mês já foi criado anteriormente." });
      } else {
        toast({ title: "Erro", description: msg, variant: "destructive" });
      }
    } finally {
      setInitiating(false);
    }
  };

  const fecharMes = async () => {
    if (!user || mesFechado) return;
    setClosing(true);
    try {
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const mesDestino = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;

      const { data, error } = await supabase.functions.invoke("virada-mes", {
        body: { mes_origem: mesAno, mes_destino: mesDestino, fechar_mes: true },
      });

      if (error) throw error;
      if (data?.already_initiated) {
        await supabase.from("fechamentos_mensais").insert({ user_id: user.id, mes_ano: mesAno } as any);
        toast({ title: "Mês fechado", description: "Registros travados. O próximo mês já havia sido iniciado." });
      } else {
        toast({
          title: "Mês fechado com sucesso!",
          description: `Replicados: ${data.replicated.fixas} fixas, ${data.replicated.ganhos} ganhos, ${data.replicated.parcelas} parcelas.`,
        });
      }
      fetchAll();
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message || "Erro ao fechar mês", variant: "destructive" });
    } finally {
      setClosing(false);
    }
  };

  return {
    loading, refetching, error, closing, initiating, mesFechado, mesIniciado,
    receitas, despesas, economias, historico, orcamentos,
    fixas, variaveis, parcelas, dividas,
    totalGanhos, ganhosRecebidos,
    totalFixas, totalVariaveis, totalParcelas, parcelasPagas, totalDividasMes, dividasPagas, totalDespesas, totalEconomias,
    economiasPlanejadas,
    totalDespesasFixasVar, despesasPagas,
    despesaCorrente: totals.despesaCorrente,
    despesaCorrentePaga: totals.despesaCorrentePaga,
    totalDividas, totalDividasRestante,
    saldoDisponivel, saldoReal, saldoPrevisto,
    taxaPoupanca, taxaPoupancaReal, taxaPoupancaPrev,
    grauCompromisso, grauCompromissoReal, grauCompromissoPrev,
    anuais, orcamentoPorCategoria, orcamentoInheritanceState, projecaoParcelas, mesesAteZerarParcelas,
    planejadoTotal, dentroDoPlanejado,
    steps, progressPercent,
    nomePessoa1, nomePessoa2, fotoPessoa1, fotoPessoa2, vinculoPessoa2, updateNomePessoa,
    addReceita, updateReceita, deleteReceita,
    addDespesa, updateDespesa, deleteDespesa,
    addEconomia, deleteEconomia,
    upsertOrcamento, deleteOrcamento, confirmarOrcamentoHerdado,
    upsertPagamento, updateInstanceStatus,
    iniciarMes, fecharMes, refetch: fetchAll,
  };
};
