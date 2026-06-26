import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, TrendingDown, Percent, PiggyBank } from "lucide-react";
import PrivacyValue from "@/components/PrivacyValue";
import { usePrivacyFmt } from "@/components/PrivacyValue";

interface Props {
  revenue: number;
  expenses: number;
}

export default function BusinessExtraKPIs({ revenue, expenses }: Props) {
  const { fmt } = usePrivacyFmt();
  const profit = revenue - expenses;
  const costRatio = revenue > 0 ? (expenses / revenue) * 100 : 0;
  const operatingMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

  if (revenue === 0 && expenses === 0) return null;

  const items = [
    {
      icon: PiggyBank,
      label: "Lucro líquido",
      value: fmt(profit),
      sub: `${operatingMargin.toFixed(1)}% do faturamento`,
      cls: profit >= 0 ? "text-emerald-600" : "text-destructive",
      help: "Quanto sobra depois de pagar todas as despesas. É o resultado real do negócio.",
    },
    {
      icon: Percent,
      label: "Margem operacional",
      value: `${operatingMargin.toFixed(1)}%`,
      sub: revenue > 0 ? `${fmt(profit)} de ${fmt(revenue)}` : "—",
      cls: operatingMargin >= 20 ? "text-emerald-600" : operatingMargin >= 10 ? "text-amber-600" : "text-destructive",
      help: "Mostra quanto sobra do faturamento depois de pagar as despesas. Acima de 20% é saudável.",
    },
    {
      icon: TrendingDown,
      label: "Custo total",
      value: `${costRatio.toFixed(1)}%`,
      sub: `${fmt(expenses)} do faturamento`,
      cls: costRatio <= 50 ? "text-emerald-600" : costRatio <= 70 ? "text-amber-600" : "text-destructive",
      help: "Percentual do faturamento consumido por despesas. Quanto menor, mais eficiente é o negócio.",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((item, i) => (
        <Card key={item.label} className="animate-fade-in" style={{ animationDelay: `${(i + 4) * 80}ms`, animationFillMode: "both" }}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <item.icon className={`h-4 w-4 ${item.cls}`} />
              <span className="text-xs text-muted-foreground">{item.label}</span>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">{item.help}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className={`text-lg font-bold font-heading ${item.cls}`}>
              <PrivacyValue>{item.value}</PrivacyValue>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{item.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
