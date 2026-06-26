import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeAposentadoriaGap } from "@/lib/aposentadoria";

// Resumo da aposentadoria do titular (pessoa1) pro dashboard. Lê os dados SALVOS
// e calcula o gap pela MESMA fórmula da página (computeAposentadoriaGap).
export function useAposentadoriaResumo() {
  const { user } = useAuth();
  const [gapMensal, setGapMensal] = useState(0);
  const [rendaDesejada, setRendaDesejada] = useState(0);
  const [rendaPassivaTotal, setRendaPassivaTotal] = useState(0);
  const [poupancaMensal, setPoupancaMensal] = useState(0);
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancel = false;
    (async () => {
      const [apoRes, bensRes] = await Promise.all([
        supabase.from("aposentadoria")
          .select("renda_desejada, renda_passiva_atual, incluir_bens, poupanca_mensal")
          .eq("user_id", user.id).eq("pessoa", "pessoa1").maybeSingle(),
        supabase.from("investimentos_nao_financeiros")
          .select("valor_renda, gera_renda").eq("user_id", user.id),
      ]);
      if (cancel) return;

      const row = apoRes.data as any;
      const rendaPassivaBens = ((bensRes.data as any[]) || [])
        .filter(b => b.gera_renda)
        .reduce((s, b) => s + Number(b.valor_renda || 0), 0);

      const rendaDes = Number(row?.renda_desejada || 0);
      const rendaPassivaAtual = Number(row?.renda_passiva_atual || 0);
      const incluirBens = !!row?.incluir_bens;

      const { rendaPassivaTotal: total, gapMensal: gap } = computeAposentadoriaGap({
        rendaDesejada: rendaDes,
        rendaPassivaAtual,
        rendaPassivaBens,
        incluirBens,
      });

      setRendaDesejada(rendaDes);
      setRendaPassivaTotal(total);
      setGapMensal(gap);
      setPoupancaMensal(Number(row?.poupanca_mensal || 0));
      setHasData(!!row);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [user?.id]);

  return { gapMensal, rendaDesejada, rendaPassivaTotal, poupancaMensal, hasData, loading };
}
