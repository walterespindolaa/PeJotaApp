import { useState, useEffect, useCallback, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MoneyValue } from "@/components/PrivacyValue";
import { lastDayOfMonth } from "@/lib/dateHelpers";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-chat`;

interface Forecast {
  mediaReceita3m: number;
  mediaDespesa3m: number;
  saldoMensal: number;
  caixa30: number;
  caixa60: number;
  caixa90: number;
  saldoAtual: number;
}

interface Props {
  companyId?: string | null;
  refreshKey?: number;
  mesRef?: string;
}

function PrevisaoCaixa({ companyId, refreshKey, mesRef }: Props) {
  const { user } = useAuth();
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchForecast = useCallback(async () => {
    if (!user || !companyId) return;
    setDataLoading(true);

    const now = mesRef ? new Date(Number(mesRef.slice(0, 4)), Number(mesRef.slice(5, 7)) - 1, 1) : new Date();
    const months: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    const startDate = `${months[2]}-01`;
    const endDate = lastDayOfMonth(months[0]);

    const { data: txData } = await supabase
      .from("business_transactions")
      .select("amount,direction,date")
      .eq("company_id", companyId)
      .gte("date", startDate)
      .lte("date", endDate);

    const txList = txData || [];
    const recByMonth: Record<string, number> = {};
    const despByMonth: Record<string, number> = {};
    months.forEach(m => { recByMonth[m] = 0; despByMonth[m] = 0; });

    txList.forEach((t: any) => {
      const m = t.date?.substring(0, 7);
      if (m && t.direction === "in") recByMonth[m] = (recByMonth[m] || 0) + Number(t.amount);
      if (m && t.direction === "out") despByMonth[m] = (despByMonth[m] || 0) + Number(t.amount);
    });

    const mesesComDados = months.filter(m => recByMonth[m] > 0 || despByMonth[m] > 0).length || 1;
    const totalR = months.reduce((s, m) => s + (recByMonth[m] || 0), 0);
    const totalD = months.reduce((s, m) => s + (despByMonth[m] || 0), 0);

    const mediaReceita3m = totalR / mesesComDados;
    const mediaDespesa3m = totalD / mesesComDados;
    const saldoMensal = mediaReceita3m - mediaDespesa3m;

    const curMonth = months[0];
    const saldoAtual = (recByMonth[curMonth] || 0) - (despByMonth[curMonth] || 0);

    const f: Forecast = {
      mediaReceita3m,
      mediaDespesa3m,
      saldoMensal,
      saldoAtual,
      caixa30: saldoAtual + saldoMensal,
      caixa60: saldoAtual + saldoMensal * 2,
      caixa90: saldoAtual + saldoMensal * 3,
    };
    setForecast(f);
    setDataLoading(false);
  }, [user, companyId, refreshKey, mesRef]);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  const generateExplanation = useCallback(async () => {
    if (!forecast || !user) return;
    setLoading(true);
    setExplanation("");

    const contextMsg = `Explique esta previsão de caixa empresarial em linguagem simples (máx 120 palavras). Não invente números.
Média receita (3 meses): R$ ${forecast.mediaReceita3m.toFixed(0)}
Média despesas (3 meses): R$ ${forecast.mediaDespesa3m.toFixed(0)}
Saldo mensal médio: R$ ${forecast.saldoMensal.toFixed(0)}
Projeção 30 dias: R$ ${forecast.caixa30.toFixed(0)}
Projeção 60 dias: R$ ${forecast.caixa60.toFixed(0)}
Projeção 90 dias: R$ ${forecast.caixa90.toFixed(0)}
Fonte: dados empresariais dos últimos 3 meses registrados no Atlas Negócios.
Se o caixa ficará negativo, sugira reduzir despesas ou aumentar receita. Sem promessas financeiras.`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: [{ role: "user", content: contextMsg }], skipContext: true }),
      });

      if (!resp.ok || !resp.body) { setExplanation("Não foi possível gerar a análise."); setLoading(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "", text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const c = JSON.parse(json).choices?.[0]?.delta?.content; if (c) { text += c; setExplanation(text); } }
          catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch { setExplanation("Erro ao gerar análise."); }
    setLoading(false);
  }, [forecast, user]);

  const hasData = forecast && (forecast.mediaReceita3m > 0 || forecast.mediaDespesa3m > 0);
  const isNegative90 = forecast && forecast.caixa90 < 0;

  if (!companyId) {
    return (
      <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
        <CardContent className="pt-5 pb-4 px-5">
          <p className="text-sm text-muted-foreground">Selecione uma empresa para ver a previsão de caixa.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
      <CardContent className="pt-5 pb-4 px-5 space-y-4">
        <div className="flex items-center gap-2">
          {isNegative90 ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <TrendingUp className="h-4 w-4 text-info" />}
          <h3 className="font-heading font-bold text-sm">Previsão de Caixa</h3>
        </div>

        {dataLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Calculando...
          </div>
        ) : !hasData ? (
          <p className="text-sm text-muted-foreground">Registre receitas e despesas por pelo menos 1 mês para ver a previsão.</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "30 dias", value: forecast!.caixa30 },
                { label: "60 dias", value: forecast!.caixa60 },
                { label: "90 dias", value: forecast!.caixa90 },
              ].map(p => (
                <div key={p.label} className={`p-3 rounded-xl border ${p.value < 0 ? "border-destructive/30 bg-destructive/5" : "border-border/30 bg-muted/20"}`}>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">{p.label}</p>
                  <p className={`text-sm font-heading font-bold ${p.value >= 0 ? "text-success" : "text-destructive"}`}>
                    <MoneyValue value={p.value} />
                  </p>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground/60">
              Cálculo baseado na média dos últimos 3 meses de dados empresariais. Não é garantia de resultado futuro.
            </p>

            {explanation ? (
              <div className="bg-muted/30 rounded-xl p-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {explanation}
                {loading && <Loader2 className="h-3 w-3 animate-spin inline ml-1" />}
              </div>
            ) : !loading ? (
              <Button variant="outline" size="sm" className="text-xs" onClick={generateExplanation}>
                <Sparkles className="h-3 w-3 mr-1" /> Explicar com IA
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
              </div>
            )}
          </>
        )}

        <p className="text-[10px] text-muted-foreground/50 italic">
          A IA fornece orientações informativas e não substitui aconselhamento financeiro profissional.
        </p>
      </CardContent>
    </Card>
  );
}

export default memo(PrevisaoCaixa);
