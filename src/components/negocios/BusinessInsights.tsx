import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lightbulb, HelpCircle, AlertTriangle, CheckCircle2, TrendingDown, TrendingUp, BarChart3, Megaphone, Landmark, Flame, FileText, Info } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { BusinessTransaction, AllocationRule, BusinessCategory } from "@/hooks/useCompanies";
import { format, subMonths } from "date-fns";

interface Props {
  transactions: BusinessTransaction[];
  allTransactions: BusinessTransaction[];
  categories: BusinessCategory[];
  revenue: number;
  expenses: number;
  allocationRules?: AllocationRule[];
}

type InsightType = "warn" | "info" | "success";

interface Insight {
  icon: React.ReactNode;
  text: string;
  type: InsightType;
}

const iconMap = {
  warn: <AlertTriangle className="h-4 w-4 flex-shrink-0" />,
  success: <CheckCircle2 className="h-4 w-4 flex-shrink-0" />,
  info: <Info className="h-4 w-4 flex-shrink-0" />,
  trendDown: <TrendingDown className="h-4 w-4 flex-shrink-0" />,
  trendUp: <TrendingUp className="h-4 w-4 flex-shrink-0" />,
  chart: <BarChart3 className="h-4 w-4 flex-shrink-0" />,
  megaphone: <Megaphone className="h-4 w-4 flex-shrink-0" />,
  landmark: <Landmark className="h-4 w-4 flex-shrink-0" />,
  flame: <Flame className="h-4 w-4 flex-shrink-0" />,
  lightbulb: <Lightbulb className="h-4 w-4 flex-shrink-0" />,
  fileText: <FileText className="h-4 w-4 flex-shrink-0" />,
};

export default function BusinessInsights({ transactions, allTransactions, categories, revenue, expenses, allocationRules = [] }: Props) {
  const { fmt, isPrivate } = usePrivacyFmt();
  const lucro = revenue - expenses;
  const margem = revenue > 0 ? (lucro / revenue) * 100 : 0;

  const insights = useMemo(() => {
    const msgs: Insight[] = [];

    if (transactions.length < 3) {
      msgs.push({ icon: iconMap.fileText, text: "Comece registrando entradas e saidas para gerar analises.", type: "info" });
      return msgs;
    }

    if (revenue > 0) {
      const costPct = Math.round((expenses / revenue) * 100);
      msgs.push({
        icon: costPct > 70 ? iconMap.warn : costPct > 50 ? iconMap.info : iconMap.success,
        text: `Seu custo operacional esta em ${costPct}% do faturamento.`,
        type: costPct > 70 ? "warn" : costPct > 50 ? "info" : "success",
      });
    }

    if (revenue > 0 && categories.length > 0) {
      const catExpenses = new Map<string, number>();
      transactions.filter(t => t.direction === "out").forEach(t => {
        const cat = categories.find(c => c.id === t.category_id);
        const name = cat?.name || "Outros";
        catExpenses.set(name, (catExpenses.get(name) || 0) + Number(t.amount));
      });

      for (const [name, val] of catExpenses) {
        const pct = Math.round((val / revenue) * 100);
        if (name.toLowerCase().includes("marketing") && pct > 20) {
          msgs.push({
            icon: iconMap.megaphone,
            text: `Seu marketing representa ${pct}% da receita (${isPrivate ? "****" : fmt(val)}). Marketing alto pode reduzir sua margem.`,
            type: "warn",
          });
        }
      }
    }

    for (const rule of allocationRules.filter(r => r.active)) {
      let base = revenue;
      if (rule.base === "gross_profit" || rule.base === "net_profit") base = lucro;
      const allocated = Math.max(0, base * (rule.percentage / 100));

      if (rule.name.toLowerCase().includes("pro-labore") || rule.name.toLowerCase().includes("pró-labore")) {
        if (lucro > 0 && (allocated / lucro) > 0.6) {
          msgs.push({
            icon: iconMap.warn,
            text: `Seu pro-labore esta acima de 60% do lucro. Considere ajustar para manter reservas.`,
            type: "warn",
          });
        }
      }
    }

    if (lucro > 0) {
      const taxRule = allocationRules.find(r => r.active && r.name.toLowerCase().includes("imposto"));
      const taxBase = taxRule?.base === "revenue" ? revenue : lucro;
      const taxPct = taxRule ? taxRule.percentage : 15;
      const impEst = taxBase * (taxPct / 100);
      msgs.push({
        icon: iconMap.landmark,
        text: `Imposto estimado (${taxPct}% do ${taxRule?.base === "revenue" ? "faturamento" : "lucro"}): ${isPrivate ? "****" : fmt(impEst)}.`,
        type: "info",
      });
    }

    const now = new Date();
    const curMonth = format(now, "yyyy-MM");
    const prevMonth = format(subMonths(now, 1), "yyyy-MM");
    const prev2Month = format(subMonths(now, 2), "yyyy-MM");

    const monthlyProfit = (month: string) =>
      allTransactions.filter(t => t.date.startsWith(month)).reduce((s, t) => s + (t.direction === "in" ? Number(t.amount) : -Number(t.amount)), 0);

    const curLucro = monthlyProfit(curMonth);
    const prevLucro = monthlyProfit(prevMonth);

    if (prevLucro > 0 && curLucro > 0) {
      const variation = ((curLucro - prevLucro) / prevLucro) * 100;
      if (variation < -10) {
        msgs.push({ icon: iconMap.trendDown, text: `Seu lucro caiu ${Math.abs(Math.round(variation))}% em relacao ao mes passado.`, type: "warn" });
      } else if (variation > 10) {
        msgs.push({ icon: iconMap.trendUp, text: `Seu lucro subiu ${Math.round(variation)}% em relacao ao mes passado.`, type: "success" });
      }
    }

    const monthlyExpense = (month: string) =>
      allTransactions.filter(t => t.date.startsWith(month) && t.direction === "out").reduce((s, t) => s + Number(t.amount), 0);

    const curExp = monthlyExpense(curMonth);
    const prevExp = monthlyExpense(prevMonth);
    const prev2Exp = monthlyExpense(prev2Month);
    if (prev2Exp > 0 && prevExp > prev2Exp && curExp > prevExp) {
      msgs.push({
        icon: iconMap.chart,
        text: "Seu custo operacional aumentou nos ultimos 3 meses consecutivos. Revise os gastos.",
        type: "warn",
      });
    }

    const monthlyRev = (month: string) =>
      allTransactions.filter(t => t.date.startsWith(month) && t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);

    const curRev = monthlyRev(curMonth);
    const prevRev = monthlyRev(prevMonth);
    const prev2Rev = monthlyRev(prev2Month);
    if (prev2Rev > 0 && prevRev > prev2Rev && curRev > prevRev) {
      msgs.push({
        icon: iconMap.trendUp,
        text: "Seu faturamento esta crescendo mes a mes. Continue assim!",
        type: "success",
      });
    }

    if (margem < 10 && revenue > 0) {
      msgs.push({ icon: iconMap.warn, text: "Sua margem esta apertada. Reveja custos fixos para sobrar mais dinheiro.", type: "warn" });
    } else if (margem > 20) {
      msgs.push({ icon: iconMap.flame, text: "Margem saudavel! Seu negocio esta bem equilibrado.", type: "success" });
    }

    if (lucro > 0) {
      msgs.push({ icon: iconMap.lightbulb, text: "Antes de retirar lucros, verifique se todos os impostos do periodo foram pagos.", type: "info" });
    }
    msgs.push({ icon: iconMap.lightbulb, text: "Reservar parte do lucro ajuda a proteger o negocio em meses dificeis.", type: "info" });

    if (msgs.length === 0) {
      msgs.push({ icon: iconMap.success, text: "Tudo em ordem! Continue monitorando seus indicadores.", type: "success" });
    }

    return msgs;
  }, [transactions, allTransactions, categories, revenue, expenses, lucro, margem, fmt, isPrivate, allocationRules]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-sm font-heading">Insights do Negocio</CardTitle>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Dicas automaticas baseadas nos seus numeros, tendencias e regras de provisao. Quanto mais dados, mais precisos os insights.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((ins, i) => (
          <div key={i} className={`flex items-start gap-2 text-sm p-2 rounded-lg ${
            ins.type === "warn" ? "bg-destructive/10 text-destructive" : ins.type === "success" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
          }`}>
            {ins.icon}
            <span>{ins.text}</span>
          </div>
        ))}
        <p className="text-[9px] text-muted-foreground italic pt-1 flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Regras podem variar. Consulte seu contador.
        </p>
      </CardContent>
    </Card>
  );
}
