import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useExpenseSkips } from "@/hooks/useExpenseSkips";
import { buildPagamentosMap, applyDerivedStatus } from "@/lib/deriveItemStatus";
import { mergeRecurring } from "@/lib/mergeRecurring";

// Fonte dos "Próximos vencimentos" do dashboard. Reusa EXATAMENTE a lógica do
// Calendário (mergeRecurring + pagamentos como fonte de verdade de status) para
// que os itens batam. Ancorado no mês REAL de hoje: lista vencimentos de HOJE em
// diante, do mês atual + próximo mês (pra não esvaziar perto do fim do mês).
// Datas comparadas por string "YYYY-MM-DD" (local) pra evitar bug de fuso.

export type Vencimento = {
  id: string;
  descricao: string;
  valor: number;
  date: string; // YYYY-MM-DD
  isToday: boolean;
  detalhe: string;
};

type MesData = { mesAno: string; despesas: any[]; instances: any[] };

const pad = (n: number) => String(n).padStart(2, "0");

// Próximo mês via aritmética de string "YYYY-MM" (sem Date, sem fuso).
const proximoMes = (mesAno: string): string => {
  let [y, m] = mesAno.split("-").map(Number);
  m += 1;
  if (m > 12) { m = 1; y += 1; }
  return `${y}-${pad(m)}`;
};

export function useProximosVencimentos() {
  const { user } = useAuth();
  const { skips } = useExpenseSkips();
  const [mesesData, setMesesData] = useState<MesData[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const mesAtual = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const mesSeguinte = useMemo(() => proximoMes(mesAtual), [mesAtual]);

  const fetchData = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);

    // Carga de um mês: despesas não-parceladas + recorrentes projetadas (status via
    // pagamentos) + installment_instances daquela competência — igual ao Calendário.
    const carregarMes = async (mAno: string): Promise<MesData> => {
      const [year, month] = mAno.split("-").map(Number);
      const startDate = `${mAno}-01`;
      const endDate = `${mAno}-${pad(new Date(year, month, 0).getDate())}`;

      const [dRes, dRecRes, instRes, pagRes] = await Promise.all([
        supabase.from("despesas").select("*").eq("user_id", user.id).gte("data", startDate).lte("data", endDate).eq("is_parcelada", false),
        supabase.from("despesas").select("*").eq("user_id", user.id).eq("recorrente", true).lte("data", endDate).eq("is_parcelada", false).limit(300),
        supabase.from("installment_instances" as any).select("*").eq("user_id", user.id).eq("competencia", mAno),
        supabase.from("pagamentos").select("*").eq("user_id", user.id).eq("mes", mAno),
      ]);

      const merged = mergeRecurring((dRes.data as any[]) || [], (dRecRes.data as any[]) || [], "data", mAno);
      const pMap = buildPagamentosMap((pagRes.data as any[]) || []);
      const despesas = applyDerivedStatus(merged as any, pMap, "despesa", mAno) as any[];

      let instances = (instRes.data as any[]) || [];
      if (instances.length > 0) {
        const ids = [...new Set(instances.map(i => i.installment_id))];
        const { data: templates } = await supabase.from("despesas").select("id,descricao,categoria,total_parcelas").in("id", ids);
        const tMap = new Map((templates || []).map((t: any) => [t.id, t]));
        instances = instances.map(inst => {
          const t = tMap.get(inst.installment_id) as any;
          return { ...inst, descricao: t?.descricao || t?.categoria || "Parcela", total_parcelas: t?.total_parcelas || 1 };
        });
      }

      return { mesAno: mAno, despesas, instances };
    };

    const meses = await Promise.all([carregarMes(mesAtual), carregarMes(mesSeguinte)]);
    setMesesData(meses);
    setLoading(false);
  }, [user, mesAtual, mesSeguinte]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const skippedKeys = useMemo(
    () => new Set(skips.map(s => `${s.template_id}:${s.month_ref}`)),
    [skips]
  );

  const vencimentos = useMemo<Vencimento[]>(() => {
    const items: Vencimento[] = [];

    mesesData.forEach(({ mesAno, despesas, instances }) => {
      despesas.forEach((d: any) => {
        const baseId = d._originalId || d.id;
        if (d.recorrente && skippedKeys.has(`${baseId}:${mesAno}`)) return;
        if (d.status !== "a_pagar" && d.status !== "em_atraso") return;
        const dia = Number(d.dia_vencimento || d.vencimento || (d.data ? d.data.substring(8, 10) : 1)) || 1;
        const date = `${mesAno}-${pad(Math.min(Math.max(dia, 1), 31))}`;
        const detalhe = d.tipo === "fixa" ? "Despesa fixa" : d.tipo === "variavel" ? "Despesa variável" : "Despesa";
        items.push({
          id: String(d.id),
          descricao: d.descricao || d.categoria || "Despesa",
          valor: Number(d.valor || 0),
          date,
          isToday: date === todayStr,
          detalhe,
        });
      });

      instances.forEach((inst: any) => {
        if (inst.status === "paid") return;
        const date = inst.due_date || `${mesAno}-01`;
        items.push({
          id: String(inst.id),
          descricao: inst.descricao || "Parcela",
          valor: Number(inst.amount || 0),
          date,
          isToday: date === todayStr,
          detalhe: `Parcela ${inst.installment_number}/${inst.total_parcelas || "?"}`,
        });
      });
    });

    const seen = new Set<string>();
    return items
      .filter(i => i.date >= todayStr)          // só de hoje em diante (inclui hoje)
      .filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true; })
      .sort((a, b) => a.date.localeCompare(b.date))  // data crescente
      .slice(0, 5);
  }, [mesesData, skippedKeys, todayStr]);

  return { vencimentos, loading, refresh: fetchData };
}
