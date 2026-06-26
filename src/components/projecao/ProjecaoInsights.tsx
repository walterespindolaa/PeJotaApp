import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, Calendar, PiggyBank } from "lucide-react";
import type { ProjectionResult } from "@/lib/financial_engine/life_projection";

const fmtMoney = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

interface Props {
  result: ProjectionResult;
  idadeAtual: number;
  idadeAposentadoria: number;
  poupancaMensal: number;
  rendaMensal: number;
  patrimonioInicial: number;
}

interface Insight {
  icon: React.ElementType;
  text: string;
  color: string;
}

function generateInsights(props: Props): Insight[] {
  const { result, idadeAtual, idadeAposentadoria, poupancaMensal, rendaMensal, patrimonioInicial } = props;
  const insights: Insight[] = [];

  // Independence age
  if (result.patrimonioAposentadoria > 0) {
    insights.push({
      icon: Calendar,
      text: `Aos ${idadeAposentadoria} anos, seu patrimônio projetado será de ${fmtMoney(result.patrimonioAposentadoria)}, gerando ${fmtMoney(result.rendaPassivaAposentadoria)}/mês de renda passiva.`,
      color: "text-emerald-500",
    });
  }

  // Savings rate
  if (rendaMensal > 0) {
    const taxaPoupanca = (poupancaMensal / rendaMensal) * 100;
    if (taxaPoupanca < 10) {
      insights.push({
        icon: PiggyBank,
        text: `Sua taxa de poupança está em ${taxaPoupanca.toFixed(0)}%. Aumentar para 20% pode acelerar significativamente sua independência financeira.`,
        color: "text-amber-500",
      });
    } else if (taxaPoupanca >= 30) {
      insights.push({
        icon: PiggyBank,
        text: `Excelente disciplina! Com ${taxaPoupanca.toFixed(0)}% de taxa de poupança, você está construindo patrimônio de forma acelerada.`,
        color: "text-emerald-500",
      });
    }
  }

  // Growth multiplier
  if (patrimonioInicial > 0 && result.patrimonioAposentadoria > patrimonioInicial) {
    const mult = result.patrimonioAposentadoria / patrimonioInicial;
    insights.push({
      icon: TrendingUp,
      text: `Seu patrimônio pode se multiplicar por ${mult.toFixed(1)}x até a aposentadoria, passando de ${fmtMoney(patrimonioInicial)} para ${fmtMoney(result.patrimonioAposentadoria)}.`,
      color: "text-primary",
    });
  }

  return insights.slice(0, 3);
}

export default function ProjecaoInsights(props: Props) {
  const insights = generateInsights(props);
  if (insights.length === 0) return null;

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm animate-fade-in" style={{ animationDelay: "400ms" }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Insights do Atlas
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">Interpretações automáticas da sua projeção.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/20 border border-border/20">
            <ins.icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${ins.color}`} />
            <p className="text-xs text-foreground/80 leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
