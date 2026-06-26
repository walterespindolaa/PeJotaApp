import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Dependente = {
  id: string;
  nome: string;
  data_nascimento: string | null;
  parentesco: string;
  tipo: string;
  observacoes: string | null;
  created_at: string;
};

const calcIdade = (dataNasc: string | null): number | null => {
  if (!dataNasc) return null;
  const birth = new Date(dataNasc + "T12:00:00");
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
};

export const useDependentes = () => {
  const { user } = useAuth();
  const [dependentes, setDependentes] = useState<Dependente[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("dependentes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at");
    setDependentes((data as Dependente[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const add = async (dep: Omit<Dependente, "id" | "created_at">) => {
    if (!user) return;
    await supabase.from("dependentes").insert({ ...dep, user_id: user.id } as any);
    fetchAll();
  };

  const update = async (id: string, dep: Partial<Dependente>) => {
    if (!user) return;
    await supabase.from("dependentes").update(dep as any).eq("id", id);
    fetchAll();
  };

  const remove = async (id: string) => {
    await supabase.from("dependentes").delete().eq("id", id);
    fetchAll();
  };

  return { dependentes, loading, fetchAll, add, update, remove, calcIdade };
};
