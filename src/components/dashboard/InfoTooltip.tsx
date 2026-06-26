import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Info, Lightbulb } from "lucide-react";

export interface InfoSection {
  title: string;
  content: string;
}

export interface InfoTooltipConfig {
  title: string;
  description: string;
  sections?: InfoSection[];
  tips?: string[];
}

interface Props {
  config: InfoTooltipConfig;
  className?: string;
  externalOpen?: boolean;
  onExternalClose?: () => void;
}

const InfoTooltip = ({ config, className = "", externalOpen, onExternalClose }: Props) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen !== undefined ? externalOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (externalOpen !== undefined) {
      if (!v && onExternalClose) onExternalClose();
    } else {
      setInternalOpen(v);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className={`h-5 w-5 rounded-full text-muted-foreground/50 hover:text-primary hover:bg-primary/10 ${className}`}
        onClick={() => setOpen(true)}
      >
        <Info className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Info className="h-4 w-4 text-primary" />
              </div>
              {config.title}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {config.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2">
            {config.sections && config.sections.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider">Como funciona</p>
                {config.sections.map((s, i) => (
                  <div key={i} className="p-3 rounded-xl border border-border/30 bg-card">
                    <p className="text-sm font-heading font-semibold">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{s.content}</p>
                  </div>
                ))}
              </div>
            )}

            {config.tips && config.tips.length > 0 && (
              <div>
                <p className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3">Como melhorar</p>
                <div className="space-y-2">
                  {config.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 border border-border/30">
                      <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                      <p className="text-sm text-foreground leading-relaxed">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InfoTooltip;

// ─── Predefined configs ───
export const INFO_CONFIGS: Record<string, InfoTooltipConfig> = {
  atlas_score: {
    title: "Atlas Score",
    description: "Nota geral da sua saúde financeira, de 0 a 100. Combina 7 dimensões como reserva, disciplina, diversificação e planejamento de aposentadoria.",
    sections: [
      { title: "Como é calculado", content: "Cada dimensão (reserva, margem, disciplina, diversificação, aposentadoria, negócios e evolução) tem um peso proporcional. A nota final é a média ponderada." },
      { title: "Por que importa", content: "O Atlas Score resume em um número se sua vida financeira está saudável, organizada e preparada para o futuro." },
    ],
    tips: [
      "Complete sua reserva de emergência para ganhar pontos na dimensão Reserva.",
      "Mantenha despesas abaixo de 70% da renda para melhorar a Margem.",
      "Diversifique investimentos entre pelo menos 3 classes de ativos.",
    ],
  },
  radar_financeiro: {
    title: "Radar da Vida Financeira",
    description: "Visão panorâmica de 5 dimensões essenciais da sua vida financeira. Cada dimensão recebe uma nota de 0 a 100.",
    sections: [
      { title: "Reserva", content: "Mede se você tem colchão financeiro suficiente para emergências (meta: 6-12 meses de despesas)." },
      { title: "Disciplina", content: "Avalia consistência nos aportes e poupança mensal em relação à renda." },
      { title: "Controle de gastos", content: "Verifica se suas despesas estão dentro de limites saudáveis em relação à receita." },
      { title: "Diversificação", content: "Mede a variedade de classes de ativos nos seus investimentos." },
      { title: "Aposentadoria", content: "Analisa se seu planejamento de longo prazo está alinhado com suas metas." },
    ],
    tips: [
      "Foque na dimensão com menor nota — ela representa seu maior risco.",
      "Uma nota equilibrada (acima de 60 em todas) é melhor que uma nota alta isolada.",
    ],
  },
  visao_futura: {
    title: "Visão Futura",
    description: "Projeta para onde sua vida financeira está caminhando com base no comportamento dos últimos 3 meses. Horizonte de projeção: 6 meses.",
    sections: [
      { title: "Como calculamos", content: "O score de tendência combina: crescimento das despesas nos últimos 3 meses, relação receita/despesa, saldo médio mensal e peso dos parcelamentos na renda. Quanto maior o crescimento das despesas ou parcelamentos, maior a pressão futura." },
      { title: "Score de tendência", content: "Gera um indicador de 0 a 100. Acima de 70: tendência positiva. 40-69: neutra. Abaixo de 40: pressão crescente — suas despesas ou parcelamentos estão pressionando a saúde financeira." },
      { title: "Horizonte de projeção", content: "As projeções estimam o cenário para os próximos 6 meses, usando a média dos últimos 3 meses de receita, despesas e saldo como base de cálculo." },
      { title: "KPIs futuros", content: "Receita média, despesa média, saldo médio e potencial de melhoria (economia de 5% dos gastos variáveis)." },
    ],
    tips: [
      "Manter saldo positivo consistente é o primeiro passo para uma boa projeção.",
      "Se reduzir 5% dos gastos variáveis, o impacto acumulado em 6 meses pode ser significativo.",
      "Evite novas compras parceladas quando os parcelamentos já consomem mais de 15% da renda.",
    ],
  },
  reserva_emergencia: {
    title: "Reserva de Emergência",
    description: "Capital disponível para cobrir imprevistos sem comprometer investimentos de longo prazo.",
    sections: [
      { title: "Como é calculado", content: "Soma dos investimentos marcados como 'reserva de emergência' dividida pela despesa mensal. Meta: 6 a 12 meses de cobertura." },
      { title: "Por que importa", content: "Sem reserva, qualquer imprevisto pode forçar você a vender investimentos ou contrair dívidas." },
    ],
    tips: [
      "Priorize liquidez: invista a reserva em ativos com resgate rápido (D+0 ou D+1).",
      "Comece com meta de 3 meses e aumente gradualmente até 8-12 meses.",
    ],
  },
  taxa_poupanca: {
    title: "Taxa de Poupança",
    description: "Percentual da sua renda que é efetivamente poupado ou investido no mês.",
    sections: [
      { title: "Como é calculado", content: "Economias do mês divididas pela receita total do mês, multiplicado por 100." },
      { title: "Referência", content: "Abaixo de 10%: risco. 10-20%: razoável. Acima de 20%: saudável." },
    ],
    tips: [
      "Automatize transferências para investimentos no dia do pagamento.",
      "Comece com 5% e aumente 1% a cada mês até atingir 20%.",
    ],
  },
  grau_compromisso: {
    title: "Grau de Compromisso",
    description: "Percentual da renda consumido por despesas. Indica quanto da sua receita já está comprometida.",
    sections: [
      { title: "Como é calculado", content: "Despesas totais divididas pela receita total, multiplicado por 100." },
      { title: "Referência", content: "Até 70%: saudável. 70-90%: alerta. Acima de 90%: crítico." },
    ],
    tips: [
      "Revise despesas variáveis — elas são as mais fáceis de ajustar.",
      "Renegocie contratos fixos (aluguel, seguros, assinaturas) anualmente.",
    ],
  },
  vulnerabilidade: {
    title: "Índice de Vulnerabilidade",
    description: "Mede o risco financeiro considerando reserva, seguros, diversificação de renda e patrimônio.",
    sections: [
      { title: "Componentes", content: "Reserva de emergência (30%), margem financeira (25%), proteção/seguros (15%), diversificação de renda (15%) e cobertura patrimonial (15%)." },
    ],
    tips: [
      "Contrate seguros essenciais: vida, residencial e saúde.",
      "Diversifique fontes de renda para reduzir dependência de uma única fonte.",
    ],
  },
};
