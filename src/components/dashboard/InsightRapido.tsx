import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb, ShieldCheck, AlertTriangle, TrendingUp, CreditCard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { lastDayOfMonth } from "@/lib/dateHelpers";

interface Insight {
  text: string;
  detail: string;
  type: "positive" | "warning";
}

export default function InsightRapido({ inline = false }: { inline?: boolean }) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  const compute = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const mes = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const mesPrev = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    const [r, d, e, dPrev] = await Promise.all([
      supabase.from("receitas").select("valor").eq("user_id", user.id).gte("data", `${mes}-01`).lte("data", lastDayOfMonth(mes)),
      supabase.from("despesas").select("valor,categoria,is_parcelada").eq("user_id", user.id).gte("data", `${mes}-01`).lte("data", lastDayOfMonth(mes)),
      supabase.from("economias").select("valor").eq("user_id", user.id).gte("data", `${mes}-01`).lte("data", lastDayOfMonth(mes)),
      supabase.from("despesas").select("valor,is_parcelada").eq("user_id", user.id).gte("data", `${mesPrev}-01`).lte("data", lastDayOfMonth(mesPrev)),
    ]);

    const receita = (r.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const despesa = (d.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const economia = (e.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const despList = d.data || [];
    const despPrevList = dPrev.data || [];

    const result: Insight[] = [];

    // 1. Grau de compromisso
    if (receita > 0) {
      const compromisso = (despesa / receita) * 100;
      if (compromisso <= 70) {
        result.push({ text: "Grau de compromisso saudável.", detail: `Você gasta menos de 70% da renda (${compromisso.toFixed(0)}%).`, type: "positive" });
      } else if (compromisso <= 90) {
        result.push({ text: "Compromisso em alerta.", detail: `Despesas acima de 70% da receita (${compromisso.toFixed(0)}%).`, type: "warning" });
      } else {
        result.push({ text: "Atenção com as despesas.", detail: "Suas despesas consomem quase toda a receita do mês.", type: "warning" });
      }
    } else {
      result.push({ text: "Registre suas receitas.", detail: "Precisamos de dados para gerar insights personalizados.", type: "warning" });
    }

    // 2. Taxa de poupança
    if (receita > 0) {
      const taxaPoup = (economia / receita) * 100;
      if (taxaPoup >= 20) {
        result.push({ text: `Taxa de poupança em ${taxaPoup.toFixed(0)}%.`, detail: "Acima do ideal de 20%. Continue assim!", type: "positive" });
      } else if (taxaPoup > 0) {
        result.push({ text: `Poupança em ${taxaPoup.toFixed(0)}%.`, detail: "O ideal é poupar pelo menos 20% da receita.", type: "warning" });
      } else {
        result.push({ text: "Sem economias registradas.", detail: "O ideal é poupar pelo menos 20% da receita.", type: "warning" });
      }
    }

    // 3. Maior categoria de gasto
    if (receita > 0 && despList.length > 0) {
      const catMap: Record<string, number> = {};
      despList.forEach((x: any) => { catMap[x.categoria || "Outros"] = (catMap[x.categoria || "Outros"] || 0) + Number(x.valor); });
      const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      if (sorted[0]) {
        const pct = (sorted[0][1] / receita) * 100;
        result.push({
          text: `${sorted[0][0]} é seu maior gasto.`,
          detail: `Representa ${pct.toFixed(0)}% da sua renda.`,
          type: pct > 30 ? "warning" : "positive",
        });
      }
    }

    // 4. Parcelamentos
    const parcelAtual = despList.filter((x: any) => x.is_parcelada).reduce((s: number, x: any) => s + Number(x.valor), 0);
    const parcelPrev = despPrevList.filter((x: any) => x.is_parcelada).reduce((s: number, x: any) => s + Number(x.valor), 0);
    if (parcelAtual > parcelPrev && parcelPrev > 0) {
      result.push({ text: "Parcelamentos aumentaram.", detail: "Revise compromissos futuros para manter a saúde financeira.", type: "warning" });
    } else if (parcelAtual > 0 && parcelAtual <= parcelPrev) {
      result.push({ text: "Parcelamentos sob controle.", detail: "Seus compromissos parcelados estão estáveis ou reduzindo.", type: "positive" });
    } else if (parcelAtual === 0 && receita > 0) {
      result.push({ text: "Sem parcelamentos ativos.", detail: "Excelente! Você não tem compromissos parcelados.", type: "positive" });
    }

    setInsights(result.slice(0, 4));
    setLoading(false);
  }, [user]);

  useEffect(() => { compute(); }, [compute]);

  if (loading) return null;
  if (insights.length === 0) return null;

  // Modo compacto: notas/linhas (sem card próprio) — usado dentro do "Pergunte ao Atlas".
  if (inline) {
    return (
      <div className="space-y-1.5 mb-3">
        {insights.slice(0, 2).map((ins, i) => (
          <div
            key={i}
            className={`flex items-start gap-2 text-[11px] rounded-lg px-2.5 py-2 border ${
              ins.type === "positive" ? "border-success/20 bg-success/5" : "border-warning/20 bg-warning/5"
            }`}
          >
            {ins.type === "positive"
              ? <Lightbulb className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" />
              : <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 flex-shrink-0" />}
            <span className="leading-snug"><b className="font-semibold text-foreground/90">{ins.text}</b> <span className="text-muted-foreground">{ins.detail}</span></span>
          </div>
        ))}
      </div>
    );
  }

  const icons = [ShieldCheck, TrendingUp, Lightbulb, CreditCard];

  return (
    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
      <CardContent className="pt-5 pb-4 px-5 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          <h3 className="font-heading font-bold text-sm">Insight Rápido do Atlas</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {insights.map((ins, i) => {
            const Icon = icons[i % icons.length];
            return (
              <div
                key={i}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  ins.type === "positive"
                    ? "border-success/20 bg-success/5"
                    : "border-warning/20 bg-warning/5"
                }`}
              >
                {ins.type === "positive" ? (
                  <Icon className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="text-sm font-heading font-semibold text-foreground/90">{ins.text}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{ins.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
