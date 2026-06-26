import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface LeadTask {
  id: string;
  user_id: string;
  company_id: string;
  lead_id: string;
  titulo: string;
  data_prevista: string | null;
  concluida: boolean;
  created_at: string;
}

export function useBusinessLeadTasks(companyId: string | null) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<LeadTask[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user || !companyId) { setTasks([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("business_lead_tasks" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("data_prevista", { ascending: true, nullsFirst: false })
      .limit(1000);
    setTasks(((data as unknown) as LeadTask[]) || []);
    setLoading(false);
  }, [user, companyId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const addTask = useCallback(async (lead_id: string, titulo: string, data_prevista: string | null) => {
    if (!user || !companyId || !titulo.trim()) return;
    await supabase.from("business_lead_tasks" as any).insert({
      user_id: user.id, company_id: companyId, lead_id, titulo: titulo.trim(), data_prevista: data_prevista || null,
    } as any);
    await fetchTasks();
  }, [user, companyId, fetchTasks]);

  const toggleTask = useCallback(async (id: string, concluida: boolean) => {
    setTasks(prev => prev.map(t => (t.id === id ? { ...t, concluida } : t)));
    await supabase.from("business_lead_tasks" as any).update({ concluida } as any).eq("id", id);
  }, []);

  const deleteTask = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    await supabase.from("business_lead_tasks" as any).delete().eq("id", id);
  }, []);

  return { tasks, loading, addTask, toggleTask, deleteTask, refetch: fetchTasks };
}
