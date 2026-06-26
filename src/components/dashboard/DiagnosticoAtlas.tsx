import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Wallet, BarChart3, Loader2, RefreshCw } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { MoneyValue, PercentValue } from "@/components/PrivacyValue";
import { lastDayOfMonth } from "@/lib/dateHelpers";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-chat`;

interface FinancialSnapshot {
  receitaMes: number;
  despesaMes: number;
  lucro: number;
  margem: number;
  receitaAnterior: number;
  despesaAnterior: number;
  lucroAnterior: number;
  variacaoLucro: number;
}

interface Props {
  companyId?: string | null;
  refreshKey?: number;
  mesRef?: string;
}

export default function DiagnosticoAtlas({ companyId, refreshKey, mesRef }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<FinancialSnapshot | null>(null);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  const fetchSnapshot = useCallback(async () => {
    if (!user || !companyId) return;
    setDataLoading(true);

    const base = mesRef ? new Date(Number(mesRef.slice(0, 4)), Number(mesRef.slice(5, 7)) - 1, 1) : new Date();
    const mesAtual = `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, "0")}`;
    const prev = new Date(base.getFullYear(), base.getMonth() - 1, 1);
    const mesAnterior = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;

    const [txCur, txPrev] = await Promise.all([
      supabase.from("business_transactions").select("amount,direction").eq("company_id", companyId).gte("date", `${mesAtual}-01`).lte("date", lastDayOfMonth(mesAtual)),
      supabase.from("business_transactions").select("amount,direction").eq("company_id", companyId).gte("date", `${mesAnterior}-01`).lte("date", lastDayOfMonth(mesAnterior)),
    ]);

    const curData = txCur.data || [];
    const prevData = txPrev.data || [];

    const receitaMes = curData.filter((t: any) => t.direction === "in").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const despesaMes = curData.filter((t: any) => t.direction === "out").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const receitaAnterior = prevData.filter((t: any) => t.direction === "in").reduce((s: number, t: any) => s + Number(t.amount), 0);
    const despesaAnterior = prevData.filter((t: any) => t.direction === "out").reduce((s: number, t: any) => s + Number(t.amount), 0);

    const lucro = receitaMes - despesaMes;
    const lucroAnterior = receitaAnterior - despesaAnterior;
    const margem = receitaMes > 0 ? (lucro / receitaMes) * 100 : 0;
    const variacaoLucro = lucroAnterior !== 0 ? ((lucro - lucroAnterior) / Math.abs(lucroAnterior)) * 100 : 0;

    const snap: FinancialSnapshot = { receitaMes, despesaMes, lucro, margem, receitaAnterior, despesaAnterior, lucroAnterior, variacaoLucro };
    setSnapshot(snap);
    setDataLoading(false);
    return snap;
  }, [user, companyId, refreshKey, mesRef]);

  useEffect(() => { fetchSnapshot(); }, [fetchSnapshot]);

  const generateExplanation = useCallback(async (snap?: FinancialSnapshot | null) => {
    const s = snap || snapshot;
    if (!s || !user || (s.receitaMes === 0 && s.despesaMes === 0)) return;
    setLoading(true);
    setExplanation("");

    const contextMsg = `Analise este diagnóstico financeiro empresarial e explique em linguagem simples (máx 150 palavras). Não invente números, use apenas estes dados.
Receita do mês: R$ ${s.receitaMes.toFixed(0)}
Despesas do mês: R$ ${s.despesaMes.toFixed(0)}
Lucro: R$ ${s.lucro.toFixed(0)}
Margem: ${s.margem.toFixed(1)}%
Receita mês anterior: R$ ${s.receitaAnterior.toFixed(0)}
Despesas mês anterior: R$ ${s.despesaAnterior.toFixed(0)}
Variação do lucro: ${s.variacaoLucro.toFixed(1)}%
Fonte: dados empresariais do mês atual registrados no PeJota Negócios.`;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: contextMsg }], skipContext: true }),
      });

      if (!resp.ok || !resp.body) {
        setExplanation("Não foi possível gerar a análise agora.");
        setLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let text = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n")) !== -1) {
          let line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const c = JSON.parse(json).choices?.[0]?.delta?.content;
            if (c) { text += c; setExplanation(text); }
          } catch { buf = line + "\n" + buf; break; }
        }
      }
    } catch {
      setExplanation("Erro ao gerar análise.");
    }
    setLoading(false);
  }, [snapshot, user]);

  const hasData = snapshot && (snapshot.receitaMes > 0 || snapshot.despesaMes > 0);

  if (!companyId) {
    return (
      <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
        <CardContent className="pt-5 pb-4 px-5">
          <p className="text-sm text-muted-foreground">Selecione uma empresa para ver o diagnóstico.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
      <CardContent className="pt-5 pb-4 px-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-heading font-bold text-sm">Diagnóstico do PeJota</h3>
          </div>
          {hasData && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => generateExplanation()} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        {dataLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados...
          </div>
        ) : !hasData ? (
          <p className="text-sm text-muted-foreground">Registre receitas e despesas no PeJota Negócios para receber seu diagnóstico.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Receita</p>
                <p className="text-sm font-heading font-bold text-success"><MoneyValue value={snapshot!.receitaMes} /></p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Despesas</p>
                <p className="text-sm font-heading font-bold text-destructive"><MoneyValue value={snapshot!.despesaMes} /></p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">Lucro</p>
                <p className={`text-sm font-heading font-bold ${snapshot!.lucro >= 0 ? "text-success" : "text-destructive"}`}>
                  <MoneyValue value={snapshot!.lucro} />
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide">vs anterior</p>
                <p className={`text-sm font-heading font-bold ${snapshot!.variacaoLucro >= 0 ? "text-success" : "text-destructive"}`}>
                  {snapshot!.variacaoLucro >= 0 ? "+" : ""}<PercentValue value={snapshot!.variacaoLucro} decimals={1} />
                </p>
              </div>
            </div>

            {explanation ? (
              <div className="bg-muted/30 rounded-xl p-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {explanation}
                {loading && <Loader2 className="h-3 w-3 animate-spin inline ml-1" />}
              </div>
            ) : !loading ? (
              <Button variant="outline" size="sm" className="text-xs" onClick={() => generateExplanation()}>
                <Sparkles className="h-3 w-3 mr-1" /> Gerar análise com IA
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Analisando...
              </div>
            )}

            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 gap-1" onClick={() => navigate("/dashboard/negocios")}>
                <BarChart3 className="h-3 w-3" /> Ver detalhes
              </Button>
            </div>
          </>
        )}

        <p className="text-[10px] text-muted-foreground/50 italic">
          A IA fornece orientações informativas e não substitui aconselhamento financeiro profissional.
        </p>
      </CardContent>
    </Card>
  );
}
