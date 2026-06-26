/**
 * Unified cashflow data provider that pulls from Organiza 2026 tables
 * (receitas + despesas) as the single source of truth.
 * Returns normalized entries for the report to consume read-only.
 */
import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { type PeriodFilter, getDateRange } from "@/lib/dateRange";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { projectParcelasForDateRange, type ParcelaProjetada } from "@/lib/parcelaProjector";

export interface CashflowEntry {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
  person: string;
}

export interface CashflowMetrics {
  receita: number;
  despesa: number;
  economia: number;
  taxaPoupanca: number;
}

export function useOrganizaCashflow(period: PeriodFilter) {
  const { user } = useAuth();
  const { view } = useHouseholdView();
  const [entries, setEntries] = useState<CashflowEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { start, end } = getDateRange(period);

    const responsavelFilter = view === "geral" || view === "casal" ? undefined
      : view === "pessoa1" ? "Pessoa 1"
      : view === "pessoa2" ? "Pessoa 2"
      : undefined;

    // Build queries for receitas and despesas within the period
    let recQuery = supabase
      .from("receitas")
      .select("id,data,categoria,descricao,valor,responsavel,recorrente")
      .eq("user_id", user.id)
      .lte("data", end)
      .order("data", { ascending: false });
    if (start) recQuery = recQuery.gte("data", start);
    if (responsavelFilter) recQuery = recQuery.eq("responsavel", responsavelFilter);

    let despQuery = supabase
      .from("despesas")
      .select("id,data,categoria,descricao,valor,responsavel,recorrente")
      .eq("user_id", user.id)
      .eq("is_parcelada", false)
      .lte("data", end)
      .order("data", { ascending: false });
    if (start) despQuery = despQuery.gte("data", start);
    if (responsavelFilter) despQuery = despQuery.eq("responsavel", responsavelFilter);

    // Despesas parceladas (compra plan): projetadas separadamente pelo parcela-projector
    let despParceladasQuery = supabase
      .from("despesas")
      .select("id,data,data_inicio_parcelas,parcela_atual,total_parcelas,categoria,descricao,valor,responsavel")
      .eq("user_id", user.id)
      .eq("is_parcelada", true);
    if (responsavelFilter) despParceladasQuery = despParceladasQuery.eq("responsavel", responsavelFilter);

    // Recurring queries (recorrente=true, qualquer data) para projeção
    let recRecurringQuery = supabase
      .from("receitas")
      .select("id,data,categoria,descricao,valor,responsavel,recorrente")
      .eq("user_id", user.id)
      .eq("recorrente", true);
    if (responsavelFilter) recRecurringQuery = recRecurringQuery.eq("responsavel", responsavelFilter);

    let despRecurringQuery = supabase
      .from("despesas")
      .select("id,data,categoria,descricao,valor,responsavel,recorrente")
      .eq("user_id", user.id)
      .eq("recorrente", true);
    if (responsavelFilter) despRecurringQuery = despRecurringQuery.eq("responsavel", responsavelFilter);

    const [recRes, despRes, recRecurringRes, despRecurringRes, despParceladasRes] = await Promise.all([
      recQuery, despQuery, recRecurringQuery, despRecurringQuery, despParceladasQuery
    ]);

    const normalized: CashflowEntry[] = [];

    // Lista de meses YYYY-MM dentro do período
    const months: string[] = [];
    if (start) {
      const [sY, sM] = start.substring(0, 7).split("-").map(Number);
      const [eY, eM] = end.substring(0, 7).split("-").map(Number);
      let y = sY, m = sM;
      while (y < eY || (y === eY && m <= eM)) {
        months.push(`${y}-${String(m).padStart(2, "0")}`);
        m++; if (m > 12) { m = 1; y++; }
      }
    }

    const recReais = (recRes.data || []) as any[];
    const despReais = (despRes.data || []) as any[];
    const recRecorrentes = (recRecurringRes.data || []) as any[];
    const despRecorrentes = (despRecurringRes.data || []) as any[];

    // Projeta recorrentes anteriores ao mês alvo que ainda não têm row real
    const projectForMonths = (reais: any[], recorrentes: any[]): any[] => {
      if (months.length === 0) return reais;
      const realByIdMes = new Set<string>();
      reais.forEach(i => {
        const mes = i.data?.substring(0, 7);
        if (mes) realByIdMes.add(`${i.id}:${mes}`);
      });
      const extras: any[] = [];
      recorrentes.forEach(item => {
        const itemStartMes = item.data?.substring(0, 7);
        if (!itemStartMes) return;
        const day = item.data.substring(8, 10) || "01";
        months.forEach(targetMes => {
          if (itemStartMes > targetMes) return;
          if (realByIdMes.has(`${item.id}:${targetMes}`)) return;
          extras.push({
            ...item,
            id: `virtual_${item.id}_${targetMes}`,
            data: `${targetMes}-${day}`,
            _virtual: true,
            _originalId: item.id,
          });
        });
      });
      return [...reais, ...extras];
    };

    const recFinal = projectForMonths(recReais, recRecorrentes);
    const despFinal = projectForMonths(despReais, despRecorrentes);

    recFinal.forEach((r: any) => {
      normalized.push({
        id: r.id,
        date: r.data,
        type: "income",
        category: r.categoria || "Outros",
        description: r.descricao || "",
        amount: Number(r.valor || 0),
        person: r.responsavel || "Pessoa 1",
      });
    });

    despFinal.forEach((d: any) => {
      normalized.push({
        id: d.id,
        date: d.data,
        type: "expense",
        category: d.categoria || "Outros",
        description: d.descricao || "",
        amount: Number(d.valor || 0),
        person: d.responsavel || "Pessoa 1",
      });
    });

    // Parcelas projetadas pelo período (fonte: despesas is_parcelada)
    const despParceladas = (despParceladasRes.data || []) as any[];
    if (start && despParceladas.length > 0) {
      const parcelasProjetadas = projectParcelasForDateRange(despParceladas, start, end);
      const parcelaMeta = new Map<string, any>();
      despParceladas.forEach(p => parcelaMeta.set(p.id, p));
      parcelasProjetadas.forEach((p: ParcelaProjetada) => {
        const meta = parcelaMeta.get(p.installmentId);
        normalized.push({
          id: `parcela_${p.installmentId}_${p.mes}`,
          date: p.dueDate,
          type: "expense",
          category: p.categoria || meta?.categoria || "Outros",
          description: meta?.descricao ? `${meta.descricao} (${p.parcelaNumero}/${meta.total_parcelas})` : `Parcela ${p.parcelaNumero}`,
          amount: p.valor,
          person: p.responsavel || meta?.responsavel || "Pessoa 1",
        });
      });
    }

    // Sort by date descending
    normalized.sort((a, b) => b.date.localeCompare(a.date));
    setEntries(normalized);
    setLoading(false);
  }, [user, period, view]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const metrics = useMemo<CashflowMetrics>(() => {
    const receita = entries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const despesa = entries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    const economia = receita - despesa;
    const taxaPoupanca = receita > 0 ? (economia / receita) * 100 : 0;
    return { receita, despesa, economia, taxaPoupanca };
  }, [entries]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    entries.filter(e => e.type === "expense").forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + e.amount);
    });
    const sorted = Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    if (sorted.length <= 6) return sorted;
    const top6 = sorted.slice(0, 6);
    const outros = sorted.slice(6).reduce((s, c) => s + c.value, 0);
    if (outros > 0) top6.push({ name: "Outros", value: outros });
    return top6;
  }, [entries]);

  const monthlyAvg = useMemo(() => {
    if (entries.length === 0) return { receita: 0, despesa: 0, economia: 0 };
    const months = new Set(entries.map(e => e.date.slice(0, 7)));
    const n = Math.max(1, months.size);
    return {
      receita: metrics.receita / n,
      despesa: metrics.despesa / n,
      economia: metrics.economia / n,
    };
  }, [entries, metrics]);

  return { entries, loading, metrics, categoryData, monthlyAvg };
}
