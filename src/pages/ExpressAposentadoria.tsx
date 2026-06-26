import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Umbrella, Calculator, Target } from "lucide-react";
import { PV, PMT } from "@/lib/financial";
import { usePremissas } from "@/hooks/usePremissas";
import { usePrivacyFmt } from "@/components/PrivacyValue";

const ExpressAposentadoria = () => {
  const { user } = useAuth();
  const premissas = usePremissas();
  const { fmt } = usePrivacyFmt();
  const [idadeAtual, setIdadeAtual] = useState(30);
  const [idadeAposentadoria, setIdadeAposentadoria] = useState(60);
  const [idadeFinal, setIdadeFinal] = useState(90);
  const [rendaDesejada, setRendaDesejada] = useState(10000);
  const [saldoAtual, setSaldoAtual] = useState(0);
  const [rentabilidade, setRentabilidade] = useState(0);

  useEffect(() => {
    if (!premissas.loading) {
      setRentabilidade(+(premissas.taxaRealAnual * 100).toFixed(2));
    }
  }, [premissas.loading, premissas.taxaRealAnual]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const [profRes, invRes] = await Promise.all([
          supabase.from("profiles").select("age").eq("user_id", user.id).maybeSingle(),
          supabase.from("investimentos_financeiros").select("valor_atual").eq("user_id", user.id),
        ]);
        if (profRes.data?.age) setIdadeAtual(profRes.data.age);
        const total = (invRes.data || []).reduce((s: number, i: any) => s + Number(i.valor_atual || 0), 0);
        setSaldoAtual(total);
      } catch (e) {
        console.error(e);
      }
    })();
  }, [user]);

  const rAnual = rentabilidade / 100;
  const taxaMensal = rAnual > 0 ? Math.pow(1 + rAnual, 1 / 12) - 1 : 0.0001;
  const mesesPos = Math.max(1, (idadeFinal - idadeAposentadoria) * 12);
  const mesesAte = Math.max(1, (idadeAposentadoria - idadeAtual) * 12);

  // PV(r, n, -renda, 0) returns positive = reserve needed
  const reservaNecessaria = PV(taxaMensal, mesesPos, -rendaDesejada, 0);

  // PMT(r, n, -saldo, reserva) returns negative = monthly payment needed
  const aporteMensal = -PMT(taxaMensal, mesesAte, -saldoAtual, reservaNecessaria);

  const valid = idadeAposentadoria > idadeAtual && idadeFinal > idadeAposentadoria;
  const taxaMuitoBaixa = rAnual <= 0;

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
          <Umbrella className="h-6 w-6 text-primary" /> Express — Aposentadoria
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Simule rapidamente quanto precisa investir para garantir sua renda futura.</p>
        <p className="text-xs text-muted-foreground mt-1 italic">Esta calculadora rápida ignora seu planejamento completo. Serve para simular cenários.</p>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {numField("Renda desejada (R$/mês)", rendaDesejada, setRendaDesejada)}
            {numField("Idade atual", idadeAtual, setIdadeAtual)}
            {numField("Idade aposentadoria", idadeAposentadoria, setIdadeAposentadoria)}
            {numField("Expectativa de vida", idadeFinal, setIdadeFinal)}
            {numField("Saldo atual (R$)", saldoAtual, setSaldoAtual)}
            {numField("Rentabilidade real (% a.a.)", rentabilidade, setRentabilidade)}
          </div>

          {taxaMuitoBaixa && (
            <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 text-center mb-3">
              <p className="text-sm text-muted-foreground">Taxa muito baixa. Usando fallback mínimo (0,01% a.m.).</p>
            </div>
          )}

          {!valid ? (
            <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 text-center">
              <p className="text-sm text-muted-foreground">Verifique as idades informadas.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card className="border-2 border-accent/20 rounded-xl">
                <CardContent className="p-5 text-center">
                  <Target className="h-6 w-6 text-accent mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">Reserva necessária</p>
                  <p className="text-2xl font-heading font-bold text-foreground">{fmt(Math.max(0, reservaNecessaria))}</p>
                  <p className="text-xs text-muted-foreground mt-1">para gerar {fmt(rendaDesejada)}/mês por {idadeFinal - idadeAposentadoria} anos</p>
                </CardContent>
              </Card>
              <Card className="border-2 border-primary/20 rounded-xl">
                <CardContent className="p-5 text-center">
                  <Calculator className="h-6 w-6 text-primary mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground mb-1">Aporte mensal necessário</p>
                  <p className="text-3xl font-heading font-bold text-foreground">{fmt(Math.max(0, aporteMensal))}</p>
                  <p className="text-xs text-muted-foreground mt-1">durante {mesesAte} meses ({idadeAposentadoria - idadeAtual} anos)</p>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ExpressAposentadoria;
