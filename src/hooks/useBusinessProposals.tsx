import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ProposalItem {
  product_id?: string | null;
  label: string;
  descricao?: string | null;
  valor: number;
  quantidade: number;
}

export interface Proposal {
  id: string;
  company_id: string;
  lead_id: string | null;
  client_id: string | null;
  token: string | null;
  status: string;
  titulo: string | null;
  terms: string | null;
  valid_until: string | null;
  desconto: number;
  stock_done: boolean;
  revenue_done?: boolean;
  bill_id?: string | null;
  created_at: string;
}

const randToken = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2))
    .replace(/-/g, "").slice(0, 24);

export function useBusinessProposals(companyId: string | null) {
  const { user } = useAuth();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProposals = useCallback(async () => {
    if (!user || !companyId) { setProposals([]); setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("business_proposals" as any)
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(500);
    setProposals(((data as unknown) as Proposal[]) || []);
    setLoading(false);
  }, [user, companyId]);

  useEffect(() => { fetchProposals(); }, [fetchProposals]);

  // Cria a proposta + itens, gera o token (status "enviada"). Se for lead, avança pra "proposta".
  const createAndSend = useCallback(async (input: {
    lead_id?: string | null;
    client_id?: string | null;
    titulo?: string;
    terms?: string;
    valid_until?: string | null;
    desconto?: number;
    payment_method?: string | null;
    installments?: number;
    items: ProposalItem[];
  }): Promise<string | null> => {
    if (!user || !companyId) return null;
    const token = randToken();
    const { data, error } = await supabase.from("business_proposals" as any).insert({
      user_id: user.id,
      company_id: companyId,
      lead_id: input.lead_id || null,
      client_id: input.client_id || null,
      token,
      status: "enviada",
      titulo: input.titulo || null,
      terms: input.terms || null,
      valid_until: input.valid_until || null,
      desconto: input.desconto || 0,
      payment_method: input.payment_method || null,
      installments: input.installments || 1,
      sent_at: new Date().toISOString(),
    } as any).select().single();
    if (error || !data) return null;
    const propId = (data as any).id;

    if (input.items.length) {
      await supabase.from("business_proposal_items" as any).insert(
        input.items.map((it, i) => ({
          user_id: user.id, proposal_id: propId,
          product_id: it.product_id || null, label: it.label,
          descricao: it.descricao || null, valor: it.valor, quantidade: it.quantidade, sort_order: i,
        }))
      );
    }
    if (input.lead_id) {
      await supabase.from("business_leads" as any)
        .update({ estagio: "proposta", updated_at: new Date().toISOString() } as any)
        .eq("id", input.lead_id);
    }
    await fetchProposals();
    return token;
  }, [user, companyId, fetchProposals]);

  const updateProposal = useCallback(async (id: string, input: {
    client_id?: string | null;
    lead_id?: string | null;
    titulo?: string;
    terms?: string;
    valid_until?: string | null;
    desconto?: number;
    payment_method?: string | null;
    installments?: number;
    items: ProposalItem[];
  }): Promise<boolean> => {
    if (!user) return false;
    // Como os itens mudaram, a baixa de estoque / receita lançada anteriores não
    // batem mais com o novo total — resetamos os flags pra evitar inconsistência.
    const { error } = await supabase.from("business_proposals" as any).update({
      lead_id: input.lead_id || null,
      client_id: input.client_id || null,
      titulo: input.titulo || null,
      terms: input.terms || null,
      valid_until: input.valid_until || null,
      desconto: input.desconto || 0,
      payment_method: input.payment_method || null,
      installments: input.installments || 1,
      stock_done: false,
      revenue_done: false,
    } as any).eq("id", id);
    if (error) return false;
    // Substitui os itens ATOMICAMENTE (delete+insert numa transação no banco).
    // Se falhar, a proposta NÃO fica sem itens.
    const { error: itemsErr } = await supabase.rpc("replace_proposal_items" as any, {
      _proposal_id: id,
      _items: input.items.map((it, i) => ({
        product_id: it.product_id || null, label: it.label,
        descricao: it.descricao || null, valor: it.valor, quantidade: it.quantidade, sort_order: i,
      })),
    });
    if (itemsErr) return false;
    await fetchProposals();
    return true;
  }, [user, fetchProposals]);

  const deleteProposal = useCallback(async (id: string) => {
    setProposals(prev => prev.filter(p => p.id !== id));
    const { error } = await supabase.from("business_proposals" as any).delete().eq("id", id);
    if (error) await fetchProposals(); // reverte se a exclusão falhar
  }, [fetchProposals]);

  return { proposals, loading, createAndSend, updateProposal, deleteProposal, refetch: fetchProposals };
}
