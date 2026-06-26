import { useMemo, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, TrendingUp, TrendingDown, Lightbulb, ShieldCheck } from "lucide-react";

interface InsightData {
  grauCompromisso: number;
  taxaPoupanca: number;
  saldoProjetado: number;
  categoriaConcentracao?: { nome: string; pct: number };
  variacaoLazer3m?: number;
  mesesParaMeta?: number;
}

interface Insight {
  icon: React.ElementType;
  text: string;
  type: "success" | "warning" | "danger" | "info";
}

const typeStyles = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
};

const DiagnosticoInteligente = ({ grauCompromisso, taxaPoupanca, saldoProjetado, categoriaConcentracao, variacaoLazer3m, mesesParaMeta }: InsightData) => {
  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];

    // Grau de compromisso
    if (grauCompromisso <= 70) {
      list.push({ icon: ShieldCheck, text: `Seu grau de compromisso está em ${grauCompromisso.toFixed(0)}%. Você possui margem saudável.`, type: "success" });
    } else if (grauCompromisso <= 90) {
      list.push({ icon: AlertTriangle, text: `Seu grau de compromisso está em ${grauCompromisso.toFixed(0)}%. Atenção: margem financeira reduzida.`, type: "warning" });
    } else {
      list.push({ icon: AlertTriangle, text: `Alerta: grau de compromisso em ${grauCompromisso.toFixed(0)}%. Risco de comprometer sua saúde financeira.`, type: "danger" });
    }

    // Taxa de poupança
    if (taxaPoupanca < 10) {
      list.push({ icon: Lightbulb, text: `Sua taxa de poupança está em ${taxaPoupanca.toFixed(1)}%, abaixo do ideal de 20%. Considere revisar seus gastos variáveis.`, type: "warning" });
    } else if (taxaPoupanca >= 20) {
      list.push({ icon: TrendingUp, text: `Excelente! Sua taxa de poupança de ${taxaPoupanca.toFixed(1)}% está acima do ideal.`, type: "success" });
    }

    // Saldo projetado negativo
    if (saldoProjetado < 0) {
      list.push({ icon: TrendingDown, text: `Atenção: seu saldo projetado está negativo. Revise suas despesas recorrentes.`, type: "danger" });
    }

    // Concentração em categoria
    if (categoriaConcentracao && categoriaConcentracao.pct > 30) {
      list.push({ icon: Lightbulb, text: `${categoriaConcentracao.nome} representa ${categoriaConcentracao.pct.toFixed(0)}% da sua receita. Diversificar pode reduzir riscos.`, type: "info" });
    }

    // Variação de lazer
    if (variacaoLazer3m && variacaoLazer3m > 20) {
      list.push({ icon: AlertTriangle, text: `Seu gasto com lazer cresceu ${variacaoLazer3m.toFixed(0)}% nos últimos 3 meses.`, type: "warning" });
    }

    // Meses para meta
    if (mesesParaMeta && mesesParaMeta > 0) {
      list.push({ icon: TrendingUp, text: `Se mantiver o ritmo atual, sua meta será atingida em ${mesesParaMeta} meses.`, type: "info" });
    }

    return list.length > 0 ? list : [{ icon: ShieldCheck, text: "Tudo em ordem! Continue acompanhando seus indicadores.", type: "success" }];
  }, [grauCompromisso, taxaPoupanca, saldoProjetado, categoriaConcentracao, variacaoLazer3m, mesesParaMeta]);

  return (
    <Card className="shadow-soft border-border/50">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-5 w-5 text-accent" />
          <h3 className="text-lg font-heading font-bold">Diagnóstico Inteligente</h3>
        </div>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${typeStyles[insight.type]}`}>
              <insight.icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-body leading-relaxed">{insight.text}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/60 mt-4 font-body">
          Diagnóstico gerado automaticamente com base nos seus dados reais. Atualizado a cada acesso.
        </p>
      </CardContent>
    </Card>
  );
};

export default memo(DiagnosticoInteligente);
