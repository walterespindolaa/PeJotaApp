import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth } from "date-fns";

export interface RecurringTemplate {
  id: string;
  user_id: string;
  company_id: string;
  type: "in" | "out";
  title: string;
  amount: number;
  category_id: string | null;
  frequency: string;
  due_day: number;
  start_month: string;
  end_month: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringInstance {
  id: string;
  template_id: string;
  user_id: string;
  company_id: string;
  month_ref: string;
  due_date: string;
  amount: number;
  status: "pending" | "confirmed" | "skipped";
  confirmed_at: string | null;
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
  template?: RecurringTemplate;
}

export function useBusinessRecurring(companyId: string | null) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<RecurringTemplate[]>([]);
  const [instances, setInstances] = useState<RecurringInstance[]>([]);
  const [loading, setLoading] = useState(false);

  const currentMonthRef = useMemo(() => format(startOfMonth(new Date()), "yyyy-MM-dd"), []);

  const fetchAll = useCallback(async () => {
    if (!user || !companyId) return;
    setLoading(true);
    const [tplRes, allTplRes, instRes] = await Promise.all([
      supabase
        .from("business_recurring_templates")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at") as any,
      supabase
        .from("business_recurring_templates")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at") as any,
      supabase
        .from("business_recurring_instances")
        .select("*")
        .eq("company_id", companyId)
        .eq("month_ref", currentMonthRef)
        .order("due_date") as any,
    ]);
    const tpls = (tplRes.data || []) as RecurringTemplate[];
    const all = (allTplRes.data || []) as RecurringTemplate[];
    const insts = (instRes.data || []) as RecurringInstance[];
    setTemplates(tpls);
    setAllTemplates(all);
    setInstances(insts);
    setLoading(false);
    return { tpls, insts };
  }, [user, companyId, currentMonthRef]);

  const ensureMonthInstances = useCallback(async () => {
    if (!user || !companyId) return;
    const { tpls, insts } = (await fetchAll()) || { tpls: [], insts: [] };

    const existingTemplateIds = new Set(insts.map((i: RecurringInstance) => i.template_id));
    const toCreate: any[] = [];

    for (const tpl of tpls) {
      if (existingTemplateIds.has(tpl.id)) continue;
      if (tpl.start_month > currentMonthRef) continue;
      if (tpl.end_month && tpl.end_month < currentMonthRef) continue;

      // Parse manual para evitar bug de timezone: new Date("YYYY-MM-DD") interpreta como UTC
      const [mrYear, mrMonth] = currentMonthRef.split("-").map(Number);
      const lastDayOfMonth = new Date(mrYear, mrMonth, 0).getDate();
      const safeDueDay = Math.min(tpl.due_day, lastDayOfMonth);
      const dueDate = new Date(mrYear, mrMonth - 1, safeDueDay);

      toCreate.push({
        template_id: tpl.id,
        user_id: user.id,
        company_id: companyId,
        month_ref: currentMonthRef,
        due_date: format(dueDate, "yyyy-MM-dd"),
        amount: tpl.amount,
        status: "pending",
      });
    }

    if (toCreate.length > 0) {
      await supabase.from("business_recurring_instances").insert(toCreate as any);
      await fetchAll();
    }
  }, [user, companyId, currentMonthRef, fetchAll]);

  useEffect(() => {
    if (companyId) ensureMonthInstances();
  }, [companyId, ensureMonthInstances]);

  const createTemplate = useCallback(async (data: {
    type: "in" | "out";
    title: string;
    amount: number;
    category_id: string | null;
    due_day: number;
    start_month?: string;
    end_month?: string | null;
  }) => {
    if (!user || !companyId) return;
    const startMonth = data.start_month || currentMonthRef;

    const { data: inserted, error } = await supabase
      .from("business_recurring_templates")
      .insert({
        user_id: user.id,
        company_id: companyId,
        type: data.type,
        title: data.title,
        amount: data.amount,
        category_id: data.category_id,
        frequency: "monthly",
        due_day: data.due_day,
        start_month: startMonth,
        end_month: data.end_month || null,
      } as any)
      .select()
      .single();

    if (error) {
      toast({ title: "Erro ao criar recorrência", variant: "destructive" });
      return;
    }

    const tpl = inserted as unknown as RecurringTemplate;
    if (startMonth <= currentMonthRef) {
      const [mrYear, mrMonth] = currentMonthRef.split("-").map(Number);
      const lastDayOfMonth = new Date(mrYear, mrMonth, 0).getDate();
      const safeDueDay = Math.min(data.due_day, lastDayOfMonth);
      const dueDate = new Date(mrYear, mrMonth - 1, safeDueDay);
      await supabase.from("business_recurring_instances").insert({
        template_id: tpl.id,
        user_id: user.id,
        company_id: companyId,
        month_ref: currentMonthRef,
        due_date: format(dueDate, "yyyy-MM-dd"),
        amount: data.amount,
        status: "pending",
      } as any);
    }

    toast({ title: "Recorrência criada!" });
    await fetchAll();
  }, [user, companyId, currentMonthRef, fetchAll, toast]);

  // Confirm with idempotency guard
  const confirmInstance = useCallback(async (instance: RecurringInstance, finalAmount?: number) => {
    if (!user || !companyId) return;
    // Idempotency: already confirmed
    if (instance.transaction_id || instance.status === "confirmed") {
      toast({ title: "Já confirmado anteriormente" });
      return;
    }
    const tpl = templates.find(t => t.id === instance.template_id);
    if (!tpl) return;

    const amount = finalAmount ?? instance.amount;

    const { data: tx, error: txErr } = await supabase
      .from("business_transactions")
      .insert({
        company_id: companyId,
        user_id: user.id,
        direction: tpl.type,
        description: tpl.title,
        amount,
        date: instance.due_date,
        category_id: tpl.category_id,
        source: "recurring",
      } as any)
      .select()
      .single();

    if (txErr) {
      toast({ title: "Erro ao confirmar", variant: "destructive" });
      return;
    }

    await supabase
      .from("business_recurring_instances")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        amount,
        transaction_id: (tx as any).id,
      } as any)
      .eq("id", instance.id);

    toast({ title: "Lançamento confirmado!" });
    await fetchAll();
    return true;
  }, [user, companyId, templates, fetchAll, toast]);

  const skipInstance = useCallback(async (instanceId: string) => {
    await supabase
      .from("business_recurring_instances")
      .update({ status: "skipped" } as any)
      .eq("id", instanceId);
    toast({ title: "Recorrência pulada neste mês" });
    await fetchAll();
  }, [fetchAll, toast]);

  const updateInstanceAmount = useCallback(async (instanceId: string, amount: number) => {
    await supabase
      .from("business_recurring_instances")
      .update({ amount } as any)
      .eq("id", instanceId);
    await fetchAll();
  }, [fetchAll]);

  // Template management
  const updateTemplate = useCallback(async (id: string, updates: Partial<Pick<RecurringTemplate, "amount" | "due_day" | "active" | "end_month" | "title">>) => {
    const { error } = await supabase
      .from("business_recurring_templates")
      .update(updates as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Erro ao atualizar", variant: "destructive" });
      return;
    }
    toast({ title: "Recorrência atualizada" });
    await fetchAll();
  }, [fetchAll, toast]);

  const deleteTemplate = useCallback(async (id: string) => {
    await supabase.from("business_recurring_instances").delete().eq("template_id", id).eq("status", "pending");
    await supabase.from("business_recurring_templates").delete().eq("id", id);
    toast({ title: "Recorrência excluída" });
    await fetchAll();
  }, [fetchAll, toast]);

  const pendingInstances = instances.filter(i => i.status === "pending");

  return {
    templates,
    allTemplates,
    instances,
    pendingInstances,
    loading,
    createTemplate,
    confirmInstance,
    skipInstance,
    updateInstanceAmount,
    updateTemplate,
    deleteTemplate,
    refresh: fetchAll,
  };
}
