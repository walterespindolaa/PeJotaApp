import { Card, CardContent } from "@/components/ui/card";
import { Brain, BarChart3, Shuffle } from "lucide-react";

const cards = [
  {
    icon: Brain,
    title: "Como o Atlas projeta seu futuro",
    items: ["Patrimônio atual", "Renda e poupança mensal", "Retorno esperado e inflação", "Eventos e metas de vida"],
  },
  {
    icon: BarChart3,
    title: "Como interpretar a curva",
    items: ["Eixo horizontal = anos", "Eixo vertical = patrimônio projetado", "Área preenchida = robustez patrimonial", "Emojis = marcos da vida"],
  },
  {
    icon: Shuffle,
    title: "O que altera sua trajetória",
    items: ["Aumento de renda ou poupança", "Eventos de vida (imóvel, filhos…)", "Mudança na idade de aposentadoria", "Decisões financeiras estratégicas"],
  },
];

export default function ProjecaoExplainerCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-fade-in" style={{ animationDelay: "350ms" }}>
      {cards.map((c, i) => (
        <Card key={i} className="border-border/40 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-4 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <c.icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <h4 className="text-xs font-heading font-semibold">{c.title}</h4>
            </div>
            <ul className="space-y-1">
              {c.items.map((item, j) => (
                <li key={j} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-primary/40 flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
