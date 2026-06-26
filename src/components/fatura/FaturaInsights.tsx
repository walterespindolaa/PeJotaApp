import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, RefreshCw, Layers, Lightbulb } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import type { StatementLine } from "./FaturaImportTab";

interface Props {
  lines: StatementLine[];
  statementMonth: string;
}

interface Insight {
  icon: React.ElementType;
  text: string;
  type: "positive" | "negative" | "neutral";
}

export default function FaturaInsights({ lines, statementMonth }: Props) {
  const { user } = useAuth();
  const { fmt, isPrivate } = usePrivacyFmt();
  const [prevLines, setPrevLines] = useState<any[]>([]);

  useEffect(() => {
    if (!user || !statementMonth) return;
    const [y, m] = statementMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;

    supabase.from("credit_card_statement_lines" as any)
      .select("category,amount,recurring")
      .eq("user_id", user.id)
      .in("status", ["applied", "ready"])
      .then(({ data }) => {
        setPrevLines((data as any[]) || []);
      });
  }, [user, statementMonth]);

  const insights = useMemo<Insight[]>(() => {
    if (!lines.length) return [];
    const active = lines.filter(l => !l.isDuplicate && l.status !== "ignored");
    const result: Insight[] = [];

    // Subscriptions
    const subs = active.filter(l => l.recurring);
    if (subs.length > 0) {
      const subsTotal = subs.reduce((s, l) => s + l.amount, 0);
      result.push({
        icon: RefreshCw,
        text: `Você possui ${subs.length} assinatura${subs.length > 1 ? "s" : ""} recorrente${subs.length > 1 ? "s" : ""} (${fmt(subsTotal)}/mês)`,
        type: "neutral",
      });
    }

    // Installments
    const installments = active.filter(l => l.installment_total && l.installment_total > 1);
    if (installments.length > 0) {
      result.push({
        icon: Layers,
        text: `${installments.length} parcelamento${installments.length > 1 ? "s" : ""} ativo${installments.length > 1 ? "s" : ""}`,
        type: "neutral",
      });
    }

    // Category comparisons with previous
    if (prevLines.length > 0) {
      const prevByCategory = new Map<string, number>();
      for (const l of prevLines) {
        const cat = l.category || "Outros";
        prevByCategory.set(cat, (prevByCategory.get(cat) || 0) + Number(l.amount));
      }

      const currByCategory = new Map<string, number>();
      for (const l of active) {
        const cat = l.category || "Outros";
        currByCategory.set(cat, (currByCategory.get(cat) || 0) + l.amount);
      }

      for (const [cat, currVal] of currByCategory) {
        const prevVal = prevByCategory.get(cat);
        if (prevVal && prevVal > 0) {
          const diff = ((currVal - prevVal) / prevVal) * 100;
          if (Math.abs(diff) >= 20) {
            result.push({
              icon: diff > 0 ? TrendingUp : TrendingDown,
              text: isPrivate
                ? `Variação significativa em ${cat} vs. fatura anterior`
                : `${diff > 0 ? "+" : ""}${Math.round(diff)}% em ${cat} vs. fatura anterior`,
              type: diff > 0 ? "negative" : "positive",
            });
          }
        }
      }
    }

    return result.slice(0, 5);
  }, [lines, prevLines, fmt, isPrivate]);

  if (!insights.length) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-accent" /> Insights da Fatura
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <insight.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${
              insight.type === "positive" ? "text-success" : insight.type === "negative" ? "text-destructive" : "text-muted-foreground"
            }`} />
            <span className="text-foreground">{insight.text}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
