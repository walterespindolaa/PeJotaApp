import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Target, Calculator } from "lucide-react";
import { PMT } from "@/lib/financial";
import { usePremissas } from "@/hooks/usePremissas";
import { usePrivacyFmt } from "@/components/PrivacyValue";

const ExpressObjetivo = () => {
  const { user } = useAuth();
  const premissas = usePremissas();
  const { fmt } = usePrivacyFmt();
  const [idadeAtual, setIdadeAtual] = useState(30);
  const [idadeObjetivo, setIdadeObjetivo] = useState(40);
  const [valorObjetivo, setValorObjetivo] = useState(100000);
  const [aporteInicial, setAporteInicial] = useState(0);
  const [rentabilidade, setRentabilidade] = useState(0);

  useEffect(() => {
    if (!premissas.loading) {
      setRentabilidade(+(premissas.taxaRealAnual * 100).toFixed(2));
    }
  }, [premissas.loading, premissas.taxaRealAnual]);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("age").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data?.age) setIdadeAtual(data.age); });
  }, [user]);

  const taxaMensal = Math.pow(1 + rentabilidade / 100, 1 / 12) - 1;
  const meses = Math.max(1, (idadeObjetivo - idadeAtual) * 12);
  const aporteMensal = taxaMensal > 0 ? -PMT(taxaMensal, meses, -aporteInicial, valorObjetivo) : (valorObjetivo - aporteInicial) / meses;

  const numField = (label: string, value: number, onChange: (v: number) => void) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value} onChange={e => onChange(Math.max(0, +e.target.value))} className="rounded-xl mt-1" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" /> Express — Objetivo Financeiro
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Calcule rapidamente quanto precisa investir por mês para atingir um objetivo específico.</p>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {numField("Valor do objetivo (R$)", valorObjetivo, setValorObjetivo)}
            {numField("Idade atual", idadeAtual, setIdadeAtual)}
            {numField("Idade para atingir", idadeObjetivo, setIdadeObjetivo)}
            {numField("Aporte inicial (R$)", aporteInicial, setAporteInicial)}
            {numField("Rentabilidade real (% a.a.)", rentabilidade, setRentabilidade)}
          </div>

          {idadeObjetivo <= idadeAtual ? (
            <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 text-center">
              <p className="text-sm text-muted-foreground">A idade do objetivo deve ser maior que a idade atual.</p>
            </div>
          ) : (
            <Card className="border-2 border-primary/20 rounded-xl">
              <CardContent className="p-6 text-center">
                <Calculator className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-xs text-muted-foreground mb-1">Aporte mensal necessário</p>
                <p className="text-3xl font-heading font-bold text-primary">{fmt(Math.max(0, aporteMensal))}</p>
                <p className="text-xs text-muted-foreground mt-2">
                  durante {meses} meses ({idadeObjetivo - idadeAtual} anos) a {rentabilidade.toFixed(2)}% a.a.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpressObjetivo;
