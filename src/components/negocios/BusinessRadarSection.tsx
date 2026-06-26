import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Sparkles, Loader2, Target, AlertTriangle, MessageCircle } from "lucide-react";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import type { BusinessTransaction, AllocationRule, BusinessCategory } from "@/hooks/useCompanies";
import { format, subMonths } from "date-fns";
import { logError } from "@/lib/log";

interface Props {
  transactions: BusinessTransaction[];
  allTransactions: BusinessTransaction[];
  categories: BusinessCategory[];
  revenue: number;
  expenses: number;
  allocationRules: AllocationRule[];
  companyName: string;
}

function clamp(v: number, min = 0, max = 100) { return Math.max(min, Math.min(max, v)); }

export default function BusinessRadarSection({
  transactions, allTransactions, categories,
  revenue, expenses, allocationRules, companyName,
}: Props) {
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  // Calculate radar dimensions
  const radarData = useMemo(() => {
    // 1) Margem (0-100)
    const marginVal = clamp(margin > 30 ? 100 : margin > 15 ? 60 : margin > 5 ? 30 : 10);

    // 2) Crescimento
    const now = new Date();
    const curMonth = format(now, "yyyy-MM");
    const prevMonth = format(subMonths(now, 1), "yyyy-MM");
    const curRev = allTransactions.filter(t => t.date.startsWith(curMonth) && t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);
    const prevRev = allTransactions.filter(t => t.date.startsWith(prevMonth) && t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);
    const growthPct = prevRev > 0 ? ((curRev - prevRev) / prevRev) * 100 : 0;
    const growthVal = clamp(growthPct > 20 ? 100 : growthPct > 10 ? 80 : growthPct >= 0 ? 50 : growthPct > -10 ? 30 : 10);

    // 3) Controle de custos
    const costRatio = revenue > 0 ? (expenses / revenue) * 100 : 100;
    const costVal = clamp(costRatio < 50 ? 100 : costRatio < 70 ? 70 : costRatio < 85 ? 40 : 15);

    // 4) Marketing eficiente
    const mktCats = categories.filter(c => c.name.toLowerCase().includes("marketing") || c.name.toLowerCase().includes("anúncio"));
    const mktSpend = mktCats.length > 0
      ? transactions.filter(t => t.direction === "out" && mktCats.some(mc => mc.id === t.category_id)).reduce((s, t) => s + Number(t.amount), 0)
      : 0;
    const mktPct = revenue > 0 ? (mktSpend / revenue) * 100 : 0;
    const mktVal = clamp(mktPct === 0 ? 50 : mktPct <= 15 ? 90 : mktPct <= 25 ? 60 : 25);

    // 5) Reserva financeira
    const reserveRule = allocationRules.find(r => r.active && (r.name.toLowerCase().includes("reserva") || r.name.toLowerCase().includes("caixa")));
    const reserveVal = clamp(reserveRule ? (reserveRule.percentage >= 20 ? 90 : reserveRule.percentage >= 10 ? 60 : 30) : 20);

    return [
      { dim: "Margem", value: marginVal, fullMark: 100 },
      { dim: "Crescimento", value: growthVal, fullMark: 100 },
      { dim: "Custos", value: costVal, fullMark: 100 },
      { dim: "Marketing", value: mktVal, fullMark: 100 },
      { dim: "Reserva", value: reserveVal, fullMark: 100 },
    ];
  }, [transactions, allTransactions, categories, revenue, expenses, margin, allocationRules]);

  const handleExplainBusiness = async () => {
    setAiLoading(true);
    setAiResponse(null);

    const context = `
Empresa: ${companyName}
Receita total: R$ ${revenue.toFixed(2)}
Despesas totais: R$ ${expenses.toFixed(2)}
Lucro: R$ ${profit.toFixed(2)}
Margem: ${margin.toFixed(1)}%
Radar: ${radarData.map(d => `${d.dim}: ${d.value}/100`).join(", ")}
Regras de alocação: ${allocationRules.filter(r => r.active).map(r => `${r.name} (${r.percentage}% do ${r.base === "revenue" ? "faturamento" : "lucro"})`).join(", ") || "Nenhuma configurada"}
Total de lançamentos no período: ${transactions.length}
    `.trim();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-chat`;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{
            role: "user",
            content: `Com base nos dados agregados abaixo, explique de forma simples a situação financeira deste negócio. Use linguagem de conversa, sem jargões. Máximo 150 palavras.\n\n${context}`,
          }],
          skipContext: true,
        }),
      });

      if (!resp.ok || !resp.body) {
        setAiResponse("Não foi possível gerar a análise agora.");
        setAiLoading(false);
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
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { setAiResponse(text); setAiLoading(false); return; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.message?.content || "";
            text += content;
            setAiResponse(text);
          } catch {}
        }
      }
      if (text) setAiResponse(text);
    } catch (e: any) {
      logError("AI explain error:", e);
      toast({ title: "Erro ao consultar IA", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  if (allTransactions.length < 3) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-heading flex items-center gap-1.5"><Target className="h-4 w-4" />Radar Financeiro</CardTitle>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Este radar mostra o equilíbrio do seu negócio em 5 dimensões. Quanto mais preenchido, mais equilibrado está.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <Button
            size="sm" variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={handleExplainBusiness}
            disabled={aiLoading}
          >
            {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
            Explicar meu negócio
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">Equilíbrio financeiro em 5 dimensões.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
            <Radar
              name="Score"
              dataKey="value"
              stroke="hsl(var(--primary))"
              fill="hsl(var(--primary))"
              fillOpacity={0.2}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>

        {/* AI Response */}
        {aiResponse && (
          <div className="bg-muted/50 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-heading font-semibold">Análise do PeJota</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{aiResponse}</p>
            <p className="text-[9px] text-muted-foreground italic inline-flex items-center gap-1"><AlertTriangle className="h-2.5 w-2.5 flex-shrink-0" />Análise informativa. Consulte seu contador para decisões fiscais.</p>
          </div>
        )}

        {/* AI Suggestions */}
        {!aiResponse && !aiLoading && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {[
              "Por que meu lucro caiu?",
              "Meu marketing está alto?",
              "Quanto posso tirar de pró-labore?",
            ].map(q => (
              <button
                key={q}
                onClick={async () => {
                  setAiLoading(true);
                  setAiResponse(null);
                  const context = `Empresa: ${companyName}. Receita: R$ ${revenue.toFixed(2)}. Despesas: R$ ${expenses.toFixed(2)}. Lucro: R$ ${profit.toFixed(2)}. Margem: ${margin.toFixed(1)}%.`;
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
                    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/atlas-chat`;
                    const resp = await fetch(CHAT_URL, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({
                        messages: [{ role: "user", content: `${q}\n\nContexto: ${context}` }],
                        skipContext: true,
                      }),
                    });
                    if (!resp.ok || !resp.body) {
                      setAiResponse("Não consegui analisar no momento.");
                      setAiLoading(false);
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
                        const line = buf.slice(0, idx);
                        buf = buf.slice(idx + 1);
                        if (!line.startsWith("data: ")) continue;
                        const json = line.slice(6).trim();
                        if (json === "[DONE]") { setAiResponse(text); setAiLoading(false); return; }
                        try {
                          const p = JSON.parse(json);
                          text += p.choices?.[0]?.delta?.content || p.choices?.[0]?.message?.content || "";
                          setAiResponse(text);
                        } catch {}
                      }
                    }
                    if (text) setAiResponse(text);
                  } catch {
                    toast({ title: "Erro ao consultar IA", variant: "destructive" });
                  } finally {
                    setAiLoading(false);
                  }
                }}
                className="whitespace-nowrap text-[10px] px-3 py-1.5 rounded-full border border-primary/30 text-primary bg-primary/5 hover:bg-primary/10 transition-all flex-shrink-0 inline-flex items-center gap-1"
              >
                <MessageCircle className="h-3 w-3 flex-shrink-0" />{q}
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
