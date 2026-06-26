import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Receita, Despesa } from "@/hooks/useOrganiza";

export const QUICK_ADD_REFETCH_EVENT = "atlas:organiza-refetch";

const dispatchRefetch = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(QUICK_ADD_REFETCH_EVENT));
};

const todayISO = (): string => new Date().toISOString().slice(0, 10);

const monthFromDate = (iso: string): string => iso.slice(0, 7);

export const useQuickAddMutations = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const addReceita = useCallback(async (data: Partial<Receita>, options?: { silent?: boolean }): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from("receitas")
      .insert({ ...data, user_id: user.id } as any);
    if (error) {
      toast({ title: "Erro ao salvar ganho", description: error.message, variant: "destructive" });
      return false;
    }
    if (!options?.silent) toast({ title: "Ganho registrado" });
    dispatchRefetch();
    return true;
  }, [user, toast]);

  const addDespesa = useCallback(async (data: Partial<Despesa>, options?: { silent?: boolean }): Promise<boolean> => {
    if (!user) return false;
    const { error } = await supabase
      .from("despesas")
      .insert({ ...data, user_id: user.id } as any);
    if (error) {
      toast({ title: "Erro ao salvar despesa", description: error.message, variant: "destructive" });
      return false;
    }
    if (!options?.silent) toast({ title: "Despesa registrada" });
    dispatchRefetch();
    return true;
  }, [user, toast]);

  const addParcela = useCallback(async (data: Partial<Despesa>): Promise<boolean> => {
    if (!user) return false;

    const { data: inserted, error } = await supabase
      .from("despesas")
      .insert({ ...data, user_id: user.id } as any)
      .select("id")
      .single();

    if (error || !inserted) {
      toast({ title: "Erro ao salvar parcela", description: error?.message, variant: "destructive" });
      return false;
    }

    const totalP = Number(data.total_parcelas || 1);
    const parcelaAtual = Number(data.parcela_atual || 1);
    const valorParcela = Number(data.valor || 0);
    const startDateStr = data.data_inicio_parcelas || data.data || `${monthFromDate(todayISO())}-01`;
    const startD = new Date(startDateStr + "T12:00:00");
    const vencDia = startD.getDate();
    const todayStr = todayISO();

    const instances: any[] = [];
    for (let i = 0; i <= totalP - parcelaAtual; i++) {
      const instDate = new Date(startD.getFullYear(), startD.getMonth() + i, 1);
      const comp = `${instDate.getFullYear()}-${String(instDate.getMonth() + 1).padStart(2, "0")}`;
      const lastDay = new Date(instDate.getFullYear(), instDate.getMonth() + 1, 0).getDate();
      const dia = Math.min(vencDia, lastDay);
      const dueDate = `${comp}-${String(dia).padStart(2, "0")}`;
      instances.push({
        user_id: user.id,
        installment_id: (inserted as any).id,
        competencia: comp,
        due_date: dueDate,
        installment_number: parcelaAtual + i,
        amount: valorParcela,
        status: dueDate < todayStr ? "late" : "pending",
      });
    }

    if (instances.length > 0) {
      const { error: instErr } = await supabase
        .from("installment_instances" as any)
        .insert(instances);
      if (instErr) {
        toast({
          title: "Parcela salva, mas falhou ao criar instâncias",
          description: instErr.message,
          variant: "destructive",
        });
        return false;
      }
    }

    toast({ title: "Parcelamento registrado" });
    dispatchRefetch();
    return true;
  }, [user, toast]);

  return { addReceita, addDespesa, addParcela };
};
