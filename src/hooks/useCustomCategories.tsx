import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { DESPESA_CATEGORIES } from "@/lib/categories";

export type CustomCategory = {
  id: string;
  user_id: string;
  nome: string;
  tipo: string; // fixa, variavel, ambas
  ordem: number;
  created_at: string;
};

export const useCustomCategories = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [customs, setCustoms] = useState<CustomCategory[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("custom_despesa_categories")
      .select("*")
      .eq("user_id", user.id)
      .order("ordem");
    setCustoms((data as CustomCategory[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const add = async (nome: string, tipo: string) => {
    if (!user || !nome.trim()) return;
    const maxOrdem = customs.length > 0 ? Math.max(...customs.map(c => c.ordem)) + 1 : 50;
    const { error } = await supabase.from("custom_despesa_categories").insert({
      user_id: user.id, nome: nome.trim(), tipo, ordem: maxOrdem,
    } as any);
    if (error) {
      toast({ title: "Categoria já existe", variant: "destructive" });
      return;
    }
    toast({ title: "Categoria criada" });
    fetch();
  };

  const update = async (id: string, data: Partial<CustomCategory>) => {
    await supabase.from("custom_despesa_categories").update(data as any).eq("id", id);
    fetch();
  };

  const remove = async (id: string) => {
    await supabase.from("custom_despesa_categories").delete().eq("id", id);
    toast({ title: "Categoria removida" });
    fetch();
  };

  const allFixas = useMemo(() => {
    const defaults = DESPESA_CATEGORIES
      .filter(c => c.tipo === "fixa" || c.tipo === "ambas")
      .map(c => c.nome);
    const custom = customs
      .filter(c => c.tipo === "fixa" || c.tipo === "ambas")
      .map(c => c.nome);
    return [...defaults, ...custom];
  }, [customs]);

  const allVariaveis = useMemo(() => {
    const defaults = DESPESA_CATEGORIES
      .filter(c => c.tipo === "variavel" || c.tipo === "ambas")
      .map(c => c.nome);
    const custom = customs
      .filter(c => c.tipo === "variavel" || c.tipo === "ambas")
      .map(c => c.nome);
    return [...defaults, ...custom];
  }, [customs]);

  return { customs, loading, add, update, remove, allFixas, allVariaveis, refetch: fetch };
};
