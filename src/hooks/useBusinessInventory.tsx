import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface InventoryItem {
  id: string;
  company_id: string;
  user_id: string;
  nome: string;
  tipo: "insumo" | "produto";
  unidade: string;
  custo_unitario: number;
  preco_venda: number;
  saldo: number;
  estoque_minimo: number;
  categoria: string | null;
  ficha_descricao: string | null;
}

export const INSUMO_CATEGORIAS = ["Hortifruti", "Açougue / Proteínas", "Secos / Grãos", "Laticínios", "Bebidas", "Embalagem", "Limpeza", "Outros"];

export interface RecipeLine {
  id: string;
  produto_id: string;
  insumo_id: string;
  quantidade: number;
}

export function useBusinessInventory(companyId: string | null) {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [recipes, setRecipes] = useState<RecipeLine[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user || !companyId) { setItems([]); setRecipes([]); setLoading(false); return; }
    setLoading(true);
    const [itemsRes, recipesRes] = await Promise.all([
      supabase.from("business_inventory_items" as any).select("*").eq("company_id", companyId).order("nome").limit(1000),
      supabase.from("business_recipes" as any).select("*").eq("company_id", companyId).limit(2000),
    ]);
    setItems(((itemsRes.data as unknown) as InventoryItem[]) || []);
    setRecipes(((recipesRes.data as unknown) as RecipeLine[]) || []);
    setLoading(false);
  }, [user, companyId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const addItem = useCallback(async (data: Partial<InventoryItem>) => {
    if (!user || !companyId) return;
    await supabase.from("business_inventory_items" as any).insert({ ...data, user_id: user.id, company_id: companyId } as any);
    await fetchAll();
  }, [user, companyId, fetchAll]);

  const updateItem = useCallback(async (id: string, data: Partial<InventoryItem>) => {
    await supabase.from("business_inventory_items" as any).update({ ...data, updated_at: new Date().toISOString() } as any).eq("id", id);
    await fetchAll();
  }, [fetchAll]);

  const deleteItem = useCallback(async (id: string) => {
    await supabase.from("business_inventory_items" as any).delete().eq("id", id);
    await fetchAll();
  }, [fetchAll]);

  // Movimenta o saldo de um item e registra o histórico.
  const registerMovement = useCallback(async (item: InventoryItem, tipo: "entrada" | "saida" | "ajuste", quantidade: number, motivo?: string): Promise<boolean> => {
    if (!user || !companyId || quantidade <= 0) return false;
    const delta = tipo === "entrada" ? quantidade : -quantidade;
    const novoSaldo = Math.max(0, Number(item.saldo) + delta);
    const { error: e1 } = await supabase.from("business_stock_movements" as any).insert({
      user_id: user.id, company_id: companyId, item_id: item.id, tipo, quantidade, custo: item.custo_unitario, motivo: motivo || null,
    } as any);
    if (e1) return false;
    const { error: e2 } = await supabase.from("business_inventory_items" as any).update({ saldo: novoSaldo, updated_at: new Date().toISOString() } as any).eq("id", item.id);
    if (e2) return false;
    await fetchAll();
    return true;
  }, [user, companyId, fetchAll]);

  // Substitui a ficha técnica de um produto.
  const setRecipe = useCallback(async (produtoId: string, lines: { insumo_id: string; quantidade: number }[]) => {
    if (!user || !companyId) return;
    await supabase.from("business_recipes" as any).delete().eq("produto_id", produtoId);
    const valid = lines.filter(l => l.insumo_id && l.quantidade > 0);
    if (valid.length > 0) {
      await supabase.from("business_recipes" as any).insert(
        valid.map(l => ({ user_id: user.id, company_id: companyId, produto_id: produtoId, insumo_id: l.insumo_id, quantidade: l.quantidade })) as any
      );
    }
    await fetchAll();
  }, [user, companyId, fetchAll]);

  // Registra a venda de N unidades de um produto: baixa os insumos pela ficha técnica.
  const registerSale = useCallback(async (produtoId: string, qtd: number): Promise<boolean> => {
    if (!user || !companyId || qtd <= 0) return false;
    const lines = recipes.filter(r => r.produto_id === produtoId);
    let ok = true;
    for (const line of lines) {
      const insumo = items.find(i => i.id === line.insumo_id);
      if (!insumo) { ok = false; continue; }
      const baixa = Number(line.quantidade) * qtd;
      const novoSaldo = Math.max(0, Number(insumo.saldo) - baixa);
      const { error: e1 } = await supabase.from("business_stock_movements" as any).insert({
        user_id: user.id, company_id: companyId, item_id: insumo.id, tipo: "venda", quantidade: baixa, custo: insumo.custo_unitario, motivo: `Venda de ${qtd}x produto`,
      } as any);
      if (e1) { ok = false; continue; }
      const { error: e2 } = await supabase.from("business_inventory_items" as any).update({ saldo: novoSaldo, updated_at: new Date().toISOString() } as any).eq("id", insumo.id);
      if (e2) ok = false;
    }
    await fetchAll();
    return ok;
  }, [user, companyId, recipes, items, fetchAll]);

  return { items, recipes, loading, addItem, updateItem, deleteItem, registerMovement, setRecipe, registerSale, refetch: fetchAll };
}
