import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BusinessLead {
  id: string;
  company_id: string;
  user_id: string;
  nome: string;
  contato: string | null;
  valor_proposta: number;
  produto: string | null;
  origem: string | null;
  estagio: string;
  proximo_passo: string | null;
  data_proximo_passo: string | null;
  notas: string | null;
  created_at: string;
}

export function useBusinessLeads(companyId: string | null) {
  const { user } = useAuth();
  const [leads, setLeads] = useState<BusinessLead[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLeads = useCallback(async () => {
    if (!user || !companyId) { setLeads([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("business_leads" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(500);
    setLeads(((data as unknown) as BusinessLead[]) || []);
    setLoading(false);
  }, [user, companyId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const addLead = useCallback(async (data: Partial<BusinessLead>) => {
    if (!user || !companyId) return;
    await supabase.from("business_leads" as any).insert({ ...data, user_id: user.id, company_id: companyId } as any);
    await fetchLeads();
  }, [user, companyId, fetchLeads]);

  const updateLead = useCallback(async (id: string, data: Partial<BusinessLead>) => {
    await supabase.from("business_leads" as any)
      .update({ ...data, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    await fetchLeads();
  }, [fetchLeads]);

  // Movimentação de estágio com atualização otimista (drag-and-drop fica fluido).
  // Se a gravação falhar, refaz o fetch pra reverter o "fantasma" na tela.
  const moveLead = useCallback(async (id: string, estagio: string) => {
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, estagio } : l)));
    const { error } = await supabase.from("business_leads" as any)
      .update({ estagio, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) await fetchLeads();
  }, [fetchLeads]);

  const deleteLead = useCallback(async (id: string) => {
    setLeads(prev => prev.filter(l => l.id !== id));
    const { error } = await supabase.from("business_leads" as any).delete().eq("id", id);
    if (error) await fetchLeads();
  }, [fetchLeads]);

  return { leads, loading, addLead, updateLead, moveLead, deleteLead, refetch: fetchLeads };
}
