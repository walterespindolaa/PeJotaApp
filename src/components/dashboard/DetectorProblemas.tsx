import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TrendingDown, BarChart3, Loader2, Sparkles, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { lastDayOfMonth } from "@/lib/dateHelpers";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-chat`;

interface Alert {
  icon: React.ElementType;
  text: string;
  severity: "critical" | "warning" | "info";
  raw: string;
}

const severityStyles = {
  critical: "border-destructive/30 bg-destructive/5 text-destructive",
  warning: "border-warning/30 bg-warning/5 text-warning",
  info: "border-info/30 bg-info/5 text-info",
};

interface Props {
  companyId?: string | null;
  refreshKey?: number;
  mesRef?: string;
}

export default function DetectorProblemas({ companyId, refreshKey, mesRef }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const detectProblems = useCallback(async () => {
    if (!user || !companyId) return;
    setDataLoading(true);

    const now = mesRef ? new Date(Number(mesRef.slice(0, 4)), Number(mesRef.slice(5, 7)) - 1, 1) : new Date();
    const months: string[] = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    const { data: txData } = await supabase
      .from("business_transactions")
      .select("amount,direction,date,category_id")
      .eq("company_id", companyId)
      .gte("date", `${months[2]}-01`)
      .lte("date", lastDayOfMonth(months[0]));

    const txList = txData || [];

    const recByMonth: Record<string, number> = {};
    const despByMonth: Record<string, number> = {};
    months.forEach(m => { recByMonth[m] = 0; despByMonth[m] = 0; });

    txList.forEach((t: any) => {
      const m = t.date?.substring(0, 7);
      if (m && t.direction === "in" && recByMonth[m] !== undefined) recByMonth[m] += Number(t.amount);
      if (m && t.direction === "out" && despByMonth[m] !== undefined) despByMonth[m] += Number(t.amount);
    });

    const curMonth = months[0];
    const recCur = recByMonth[curMonth];
    const despCur = despByMonth[curMonth];
    const lucro = recCur - despCur;

    // Category concentration
    const catTotals: Record<string, number> = {};
    txList.filter((t: any) => t.date?.startsWith(curMonth) && t.direction === "out").forEach((t: any) => {
      const cat = t.category_id || "sem_categoria";
      catTotals[cat] = (catTotals[cat] || 0) + Number(t.amount);
    });

    const detected: Alert[] = [];

    if (lucro < 0 && recCur > 0) {
      detected.push({
        icon: TrendingDown, severity: "critical",
        text: `Lucro negativo este mês: R$ ${lucro.toFixed(0)}.`,
        raw: `Lucro negativo: R$ ${lucro.toFixed(0)}`,
      });
    }

    if (months.length >= 3 && despByMonth[months[0]] > despByMonth[months[1]] && despByMonth[months[1]] > despByMonth[months[2]]) {
      detected.push({
        icon: AlertTriangle, severity: "warning",
        text: "Despesas crescendo por 2 meses seguidos.",
        raw: `Despesas crescentes: ${months.map(m => `R$ ${despByMonth[m].toFixed(0)}`).reverse().join(" → ")}`,
      });
    }

    // Single category > 40% of revenue
    Object.entries(catTotals).forEach(([, val]) => {
      if (recCur > 0 && (val / recCur) * 100 > 40) {
        detected.push({
          icon: AlertTriangle, severity: "warning",
          text: `Uma categoria representa ${((val / recCur) * 100).toFixed(0)}% da receita.`,
          raw: `Concentração de categoria: ${((val / recCur) * 100).toFixed(0)}% da receita`,
        });
      }
    });

    const despDiaria = despCur / 30;
    const diasCaixa = despDiaria > 0 ? lucro / despDiaria : 999;
    if (diasCaixa < 30 && diasCaixa >= 0 && recCur > 0) {
      detected.push({
        icon: AlertTriangle, severity: "warning",
        text: `Caixa abaixo de 30 dias de operação (${diasCaixa.toFixed(0)} dias).`,
        raw: `Dias de caixa: ${diasCaixa.toFixed(0)}`,
      });
    }

    // Revenue declining
    if (months.length >= 3 && recByMonth[months[0]] < recByMonth[months[1]] && recByMonth[months[1]] < recByMonth[months[2]] && recByMonth[months[2]] > 0) {
      detected.push({
        icon: TrendingDown, severity: "warning",
        text: "Receita em queda por 2 meses seguidos.",
        raw: `Receita decrescente: ${months.map(m => `R$ ${recByMonth[m].toFixed(0)}`).reverse().join(" → ")}`,
      });
    }

    if (detected.length === 0 && recCur > 0) {
      detected.push({
        icon: ShieldCheck, severity: "info",
        text: "Nenhum alerta detectado este mês. Continue monitorando!",
        raw: "Sem alertas",
      });
    }

    setAlerts(detected);
    setDataLoading(false);
  }, [user, companyId, refreshKey, mesRef]);

  useEffect(() => { detectProblems(); }, [detectProblems]);

  const explainAlerts = useCallback(async () => {
    if (alerts.length === 0 || !user) return;
    setLoading(true);
    setExplanation("");

    const alertsContext = alerts.map(a => `- ${a.raw}`).join("\n");
    const contextMsg = `Explique estes alertas financeiros empresariais em linguagem simples (máx 120 palavras). Sugira ações práticas. Não invente números.
Alertas detectados:
${alertsContext}
Fonte: dados empresariais do mês atual registrados no Atlas Negócios. Sem promessas financeiras.`;

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
  }, [alerts, user]);

  const hasCritical = alerts.some(a => a.severity === "critical");

  if (!companyId) {
    return (
      <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
        <CardContent className="pt-5 pb-4 px-5">
          <p className="text-sm text-muted-foreground">Selecione uma empresa para ativar o detector.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
      <CardContent className="pt-5 pb-4 px-5 space-y-4">
        <div className="flex items-center gap-2">
          {hasCritical ? <AlertTriangle className="h-4 w-4 text-destructive" /> : <ShieldCheck className="h-4 w-4 text-success" />}
          <h3 className="font-heading font-bold text-sm">Detector de Problemas</h3>
        </div>

        {dataLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Registre dados para ativar a detecção automática de problemas.</p>
        ) : (
          <>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-start gap-2 p-2.5 rounded-xl border ${severityStyles[a.severity]}`}>
                  <a.icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <p className="text-xs leading-relaxed">{a.text}</p>
                </div>
              ))}
            </div>

            {explanation ? (
              <div className="bg-muted/30 rounded-xl p-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {explanation}
                {loading && <Loader2 className="h-3 w-3 animate-spin inline ml-1" />}
              </div>
            ) : !loading && hasCritical ? (
              <Button variant="outline" size="sm" className="text-xs" onClick={explainAlerts}>
                <Sparkles className="h-3 w-3 mr-1" /> Explicar com IA
              </Button>
            ) : loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
              </div>
            ) : null}

            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1" onClick={() => navigate("/dashboard/negocios")}>
                <BarChart3 className="h-3 w-3" /> Ver detalhes
              </Button>
            </div>
          </>
        )}

        <p className="text-[10px] text-muted-foreground/50 italic">
          Alertas calculados automaticamente com dados empresariais. A IA fornece orientações informativas.
        </p>
      </CardContent>
    </Card>
  );
}
