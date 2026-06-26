import { useState, useEffect, useCallback, useMemo } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import TabCalendario from "@/components/organiza/TabCalendario";
import type { Despesa, Receita, InstallmentInstance } from "@/hooks/useOrganiza";
import { buildPagamentosMap, applyDerivedStatus } from "@/lib/deriveItemStatus";
import { mergeRecurring } from "@/lib/mergeRecurring";
import { upsertPagamentoMensal } from "@/lib/pagamentos";
import { useExpenseSkips } from "@/hooks/useExpenseSkips";
import { CalendarDays } from "lucide-react";

const now = new Date();
const currentMesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(now.getFullYear(), i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
});

const Calendario = () => {
  const { user } = useAuth();
  const { view } = useHouseholdView();
  const [mesAno, setMesAno] = useState(currentMesAno);
  const [despesasRaw, setDespesasRaw] = useState<Despesa[]>([]);
  const [receitas, setReceitas] = useState<Receita[]>([]);
  const [installmentInstances, setInstallmentInstances] = useState<(InstallmentInstance & { descricao?: string; total_parcelas?: number })[]>([]);
  const [mesFechado, setMesFechado] = useState(false);
  const [loading, setLoading] = useState(true);

  const { skips } = useExpenseSkips();
  const skippedKeys = useMemo(
    () => new Set(skips.map(s => `${s.template_id}:${s.month_ref}`)),
    [skips]
  );

  const despesas = useMemo(() => {
    return despesasRaw.map((item: any) => {
      if (!item.recorrente) return item;
      const baseId = item._originalId || item.id;
      const key = `${baseId}:${mesAno}`;
      return skippedKeys.has(key) ? { ...item, _skipped: true } : item;
    });
  }, [despesasRaw, skippedKeys, mesAno]);

  // casal = Pessoa 1 + Pessoa 2 + Compartilhado (no filter needed, same as geral for couples)
  const responsavelFilter = view === "geral" || view === "casal" ? undefined
    : view === "pessoa1" ? "Pessoa 1"
    : "Pessoa 2";

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [year, month] = mesAno.split("-").map(Number);
    const startDate = `${mesAno}-01`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-${new Date(year, month, 0).getDate()}`;

    // Fetch month items + all recurring items for merging
    let dQuery = supabase.from("despesas").select("*").eq("user_id", user.id).gte("data", startDate).lte("data", endDate).eq("is_parcelada", false);
    let rQuery = supabase.from("receitas").select("*").eq("user_id", user.id).gte("data", startDate).lte("data", endDate);
    let dRecurringQuery = supabase.from("despesas").select("*").eq("user_id", user.id).eq("recorrente", true).lte("data", endDate).eq("is_parcelada", false);
    let rRecurringQuery = supabase.from("receitas").select("*").eq("user_id", user.id).eq("recorrente", true).lte("data", endDate);

    if (responsavelFilter) {
      dQuery = dQuery.eq("responsavel", responsavelFilter);
      rQuery = rQuery.eq("responsavel", responsavelFilter);
      dRecurringQuery = dRecurringQuery.eq("responsavel", responsavelFilter);
      rRecurringQuery = rRecurringQuery.eq("responsavel", responsavelFilter);
    }

    const [dRes, rRes, dRecRes, rRecRes, fRes, instRes, pagRes] = await Promise.all([
      dQuery, rQuery, dRecurringQuery, rRecurringQuery,
      supabase.from("fechamentos_mensais").select("id").eq("user_id", user.id).eq("mes_ano", mesAno).maybeSingle(),
      supabase.from("installment_instances" as any).select("*").eq("user_id", user.id).eq("competencia", mesAno),
      supabase.from("pagamentos").select("*").eq("user_id", user.id).eq("mes", mesAno),
    ]);

    // Merge recurring items into current month
    const monthDespesas = (dRes.data as Despesa[]) || [];
    const monthReceitas = (rRes.data as Receita[]) || [];
    const allRecurringDespesas = (dRecRes.data as Despesa[]) || [];
    const allRecurringReceitas = (rRecRes.data as Receita[]) || [];

    const mergedDespesas = mergeRecurring(monthDespesas, allRecurringDespesas, "data", mesAno);
    const mergedReceitas = mergeRecurring(monthReceitas, allRecurringReceitas, "data", mesAno);

    const pagamentosData = (pagRes.data as any[]) || [];
    const pMap = buildPagamentosMap(pagamentosData);

    const derivedDespesas = applyDerivedStatus(mergedDespesas as any, pMap, "despesa", mesAno);
    const derivedReceitas = applyDerivedStatus(mergedReceitas as any, pMap, "ganho", mesAno);

    setDespesasRaw(derivedDespesas as Despesa[]);
    setReceitas(derivedReceitas as Receita[]);
    setMesFechado(!!fRes.data);

    // Enrich instances
    const instances = (instRes.data as unknown as InstallmentInstance[]) || [];
    if (instances.length > 0) {
      const ids = [...new Set(instances.map(i => i.installment_id))];
      const { data: templates } = await supabase.from("despesas").select("id,descricao,categoria,total_parcelas").in("id", ids);
      const tMap = new Map((templates || []).map((t: any) => [t.id, t]));
      setInstallmentInstances(instances.map(inst => {
        const t = tMap.get(inst.installment_id) as any;
        return { ...inst, descricao: t?.descricao || t?.categoria || "Parcela", total_parcelas: t?.total_parcelas || 1 };
      }));
    } else {
      setInstallmentInstances([]);
    }

    setLoading(false);
  }, [user, mesAno, responsavelFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdateDespesa = async (id: string, data: Partial<Despesa>) => {
    if (!user) return;

    // Status: usa upsert correto na tabela pagamentos (fonte de verdade mensal)
    if (data.status !== undefined) {
      await upsertPagamentoMensal({
        userId: user.id,
        refType: "despesa",
        refId: id,
        mesAno,
        status: data.status as string,
      });
      // Se houver outros campos além de status, atualiza separadamente
      const { status, ...rest } = data as any;
      if (Object.keys(rest).length > 0) {
        const realId = id.startsWith("virtual_") ? id.split("_")[1] : id;
        await supabase.from("despesas").update(rest as any).eq("id", realId);
      }
    } else {
      // Update normal sem mexer em status
      const realId = id.startsWith("virtual_") ? id.split("_")[1] : id;
      await supabase.from("despesas").update(data as any).eq("id", realId);
    }
    fetchData();
  };

  const handleUpdateReceita = async (id: string, data: Partial<Receita>) => {
    if (!user) return;

    if (data.status !== undefined) {
      await upsertPagamentoMensal({
        userId: user.id,
        refType: "ganho",
        refId: id,
        mesAno,
        status: data.status as string,
      });
      const { status, ...rest } = data as any;
      if (Object.keys(rest).length > 0) {
        const realId = id.startsWith("virtual_") ? id.split("_")[1] : id;
        await supabase.from("receitas").update(rest as any).eq("id", realId);
      }
    } else {
      const realId = id.startsWith("virtual_") ? id.split("_")[1] : id;
      await supabase.from("receitas").update(data as any).eq("id", realId);
    }
    fetchData();
  };

  const handleUpdateInstance = async (id: string, status: string) => {
    if (!user) return;
    const update: any = { status };
    if (status === "paid") update.paid_at = new Date().toISOString();
    else update.paid_at = null;
    await supabase.from("installment_instances" as any).update(update).eq("id", id);
    fetchData();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-4 animate-fade-in max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Calendário Financeiro
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe vencimentos, recebimentos e status dos lançamentos.</p>
        </div>
        <Select value={mesAno} onValueChange={setMesAno}>
          <SelectTrigger className="w-[200px] rounded-xl"><SelectValue /></SelectTrigger>
          <SelectContent>
            {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <TabCalendario
        despesas={despesas}
        receitas={receitas}
        installmentInstances={installmentInstances}
        mesAno={mesAno}
        mesFechado={mesFechado}
        onUpdateDespesa={handleUpdateDespesa}
        onUpdateReceita={handleUpdateReceita}
        onUpdateInstance={handleUpdateInstance}
      />
    </div>
  );
};

export default Calendario;
