import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, Target, Calculator, ArrowRight, Umbrella, Sparkles, Scale } from "lucide-react";

const tools = [
  {
    key: "aposentadoria",
    title: "Express Aposentadoria",
    description: "Simule rapidamente quanto você precisa poupar por mês para atingir a renda desejada na aposentadoria.",
    icon: Umbrella,
    color: "text-info",
    bg: "bg-info/10",
    to: "/dashboard/express-aposentadoria",
  },
  {
    key: "objetivo",
    title: "Express Objetivos",
    description: "Calcule quanto investir mensalmente para atingir um objetivo financeiro em determinado prazo.",
    icon: Target,
    color: "text-success",
    bg: "bg-success/10",
    to: "/dashboard/express-objetivo",
  },
  {
    key: "simulador",
    title: "Simulador de Decisão",
    description: "Analise o impacto financeiro de grandes decisões como comprar imóvel, trocar carro ou mudar padrão de vida.",
    icon: Calculator,
    color: "text-primary",
    bg: "bg-primary/10",
    to: "/dashboard/simulador-decisao",
  },
  {
    key: "financiamento",
    title: "Consórcio x Financiamento",
    description: "Compare consórcio, tabela Price e SAC. Calcule parcelas, custo total e veja a diferença ao longo do tempo.",
    icon: Scale,
    color: "text-indigo-500",
    bg: "bg-indigo-50",
    to: "/dashboard/simulador-financiamento",
  },
];

const PlanejamentoEstrategico = () => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" /> Planejamento Estratégico
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Ferramentas rápidas para simular cenários, planejar objetivos e tomar decisões financeiras com confiança.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {tools.map(t => (
          <Card
            key={t.key}
            className="border border-border/60 hover:border-primary/30 transition-all hover:shadow-md cursor-pointer group"
            onClick={() => navigate(t.to)}
          >
            <CardContent className="p-6 flex flex-col h-full">
              <div className={`h-12 w-12 rounded-xl ${t.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <t.icon className={`h-6 w-6 ${t.color}`} />
              </div>
              <h3 className="font-heading font-semibold text-base mb-2">{t.title}</h3>
              <p className="text-sm text-muted-foreground flex-1 mb-4">{t.description}</p>
              <Button variant="ghost" className="w-full justify-between text-xs group-hover:bg-muted/50">
                Acessar <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-muted/20 border-dashed">
        <CardContent className="p-4 text-center">
          <p className="text-xs text-muted-foreground">
            <Zap className="h-3 w-3 inline mr-1" />
            Todas as ferramentas utilizam seus dados financeiros reais para gerar cálculos precisos e personalizados.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanejamentoEstrategico;
