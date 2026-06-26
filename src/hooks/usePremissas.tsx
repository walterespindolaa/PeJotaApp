import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Premissas {
  taxaNominal: number;       // % (e.g. 10)
  inflacao: number;          // % (e.g. 5)
  taxaRealAnual: number;
  taxaRealMensal: number;
  taxaNominalMensal: number;
  inflacaoMensal: number;
  loading: boolean;
}

export const usePremissas = (): Premissas => {
  const { user } = useAuth();
  const [taxaNominal, setTaxaNominal] = useState(10);
  const [inflacao, setInflacao] = useState(5);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("aposentadoria")
      .select("taxa_nominal, inflacao")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      if (data.taxa_nominal != null) setTaxaNominal(Number(data.taxa_nominal) * 100);
      if (data.inflacao != null) setInflacao(Number(data.inflacao) * 100);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetch(); }, [fetch]);

  const L8 = taxaNominal / 100;
  const L9 = inflacao / 100;

  return useMemo(() => {
    const taxaRealAnual = ((1 + L8) / (1 + L9)) - 1;
    const taxaRealMensal = taxaRealAnual > 0 ? Math.pow(1 + taxaRealAnual, 1 / 12) - 1 : 0.0001;
    const taxaNominalMensal = Math.pow(1 + L8, 1 / 12) - 1;
    const inflacaoMensal = Math.pow(1 + L9, 1 / 12) - 1;
    return { taxaNominal, inflacao, taxaRealAnual, taxaRealMensal, taxaNominalMensal, inflacaoMensal, loading };
  }, [taxaNominal, inflacao, L8, L9, loading]);
};
