import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Agregação mínima da carteira para widgets fora do InvestimentosProvider
 * (ex: DashboardHome). Soma valor_atual e total_aportado, mesma base da VisaoGeral.
 */
export function useInvestimentosResumo() {
  const { user } = useAuth();
  const [totalAtual, setTotalAtual] = useState(0);
  const [totalAportado, setTotalAportado] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      const { data } = await supabase
        .from("investimentos_financeiros")
        .select("valor_atual,total_aportado")
        .eq("user_id", user.id);
      if (cancel) return;
      const atual = (data || []).reduce((s: number, i: any) => s + Number(i.valor_atual || 0), 0);
      const aportado = (data || []).reduce((s: number, i: any) => s + Number(i.total_aportado || 0), 0);
      setTotalAtual(atual);
      setTotalAportado(aportado);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.id]);

  const rentabilidade = totalAportado > 0 ? ((totalAtual - totalAportado) / totalAportado) * 100 : 0;
  return { totalAtual, totalAportado, rentabilidade, loading };
}
