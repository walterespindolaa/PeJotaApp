import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Briefcase, ArrowRight, BookOpen } from "lucide-react";

const STEPS = [
  { emoji: "1️⃣", title: "Registrar receitas", desc: "Anote tudo que entra no caixa da sua empresa." },
  { emoji: "2️⃣", title: "Registrar despesas", desc: "Registre todos os gastos necessários para operar." },
  { emoji: "3️⃣", title: "Categorizar corretamente", desc: "Organize por tipo para entender onde o dinheiro vai." },
  { emoji: "4️⃣", title: "Analisar lucro", desc: "Saiba quanto realmente sobra no final do mês." },
  { emoji: "5️⃣", title: "Reservar para impostos", desc: "Separe um percentual para não ser pego de surpresa." },
  { emoji: "6️⃣", title: "Definir pró-labore", desc: "Estabeleça seu salário de dono de forma organizada." },
];

interface Props {
  onCreateFirst: () => void;
}

export default function BusinessOnboarding({ onCreateFirst }: Props) {
  return (
    <div className="max-w-2xl mx-auto space-y-6 py-8">
      <div className="text-center space-y-3">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Briefcase className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-2xl font-heading font-bold">PeJota Negócios</h1>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Organize as finanças da sua empresa de forma simples. Sem termos complicados — apenas o que você precisa saber.
        </p>
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="text-sm font-heading font-semibold mb-4 flex items-center gap-1.5"><BookOpen className="h-4 w-4" />Como organizar as finanças da sua empresa</h2>
          <div className="space-y-3">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
                <div>
                  <p className="text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button size="lg" onClick={onCreateFirst} className="gap-2">
          Criar minha primeira empresa <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
