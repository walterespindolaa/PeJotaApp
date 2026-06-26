import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type ExpenseLink = {
  id: string;
  user_id: string;
  investment_id: string;
  expense_id: string;
  valor_vinculado: number;
  tipo_despesa: string;
  created_at: string;
  updated_at: string;
};

export const useExpenseLinks = () => {
  const { user } = useAuth();
  const [links, setLinks] = useState<ExpenseLink[]>([]);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("investment_expense_links")
      .select("*")
      .eq("user_id", user.id);
    setLinks((data as ExpenseLink[]) || []);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const upsertLink = async (investmentId: string, expenseId: string, valor: number, tipo: string) => {
    if (!user) return;
    // Check if link exists
    const existing = links.find(l => l.expense_id === expenseId);
    if (existing) {
      await supabase.from("investment_expense_links").update({
        investment_id: investmentId, valor_vinculado: valor, tipo_despesa: tipo,
      } as any).eq("id", existing.id);
    } else {
      await supabase.from("investment_expense_links").insert({
        user_id: user.id, investment_id: investmentId, expense_id: expenseId,
        valor_vinculado: valor, tipo_despesa: tipo,
      } as any);
    }
    fetch();
  };

  const removeLink = async (expenseId: string) => {
    const existing = links.find(l => l.expense_id === expenseId);
    if (existing) {
      await supabase.from("investment_expense_links").delete().eq("id", existing.id);
      fetch();
    }
  };

  const getLinkForExpense = (expenseId: string) => links.find(l => l.expense_id === expenseId);

  return { links, upsertLink, removeLink, getLinkForExpense, refetch: fetch };
};
