import { Card, CardContent } from "@/components/ui/card";
import { Landmark, Target, TrendingUp, MapPin } from "lucide-react";
import type { ProjectionResult } from "@/lib/financial_engine/life_projection";

const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

interface Props {
  patrimonioInicial: number;
  result: ProjectionResult;
}

const kpis = [
  { key: "atual", icon: Landmark, label: "Patrimônio Atual", color: "" },
  { key: "aposent", icon: Target, label: "Na Aposentadoria", color: "text-emerald-500 dark:text-emerald-400" },
  { key: "renda", icon: TrendingUp, label: "Renda Passiva", color: "text-primary" },
  { key: "final", icon: MapPin, label: "Patrimônio Final", color: "text-amber-500 dark:text-amber-400" },
] as const;

export default function ProjecaoKPIs({ patrimonioInicial, result }: Props) {
  const values: Record<string, string> = {
    atual: fmtFull(patrimonioInicial),
    aposent: fmtFull(result.patrimonioAposentadoria),
    renda: `${fmtFull(result.rendaPassivaAposentadoria)}/mês`,
    final: fmtFull(result.patrimonioFinal),
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {kpis.map((k, i) => (
        <Card
          key={k.key}
          className="shadow-soft border-border/40 bg-card/80 backdrop-blur-sm animate-fade-in"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <CardContent className="p-3.5 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <k.icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{k.label}</div>
              <div className={`text-sm font-heading font-bold truncate ${k.color}`}>{values[k.key]}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
