import { useNavigate } from "react-router-dom";
import { Target, Sparkles, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const BENEFITS = [
  "Diagnóstico financeiro completo",
  "Planejamento de curto, médio e longo prazo",
  "Estratégias de proteção patrimonial",
  "Planejamento sucessório básico",
  "Organização financeira familiar",
  "Como criar e manter um plano financeiro vivo",
];

const PlanejamentoFinanceiroCurso = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-start justify-center pt-10 px-4 animate-fade-in">
      <Card className="bg-card/95 border border-border/60 rounded-2xl shadow-2xl max-w-lg w-full">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Target className="h-8 w-8 text-primary" />
          </div>

          {/* Badge */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full px-3 py-1 text-xs font-semibold gap-1.5">
              <Clock className="h-3 w-3" /> Em breve · Exclusivo Elite
            </Badge>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-heading font-bold text-foreground mb-1">
            Planejamento Financeiro
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Do diagnóstico ao plano completo
          </p>

          {/* Content */}
          <div className="text-left bg-muted/40 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-3">
              O que você vai aprender
            </p>
            <ul className="space-y-2">
              {BENEFITS.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Status note */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-6">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span>Seu plano Elite já inclui acesso quando o curso for lançado.</span>
          </div>

          {/* CTA */}
          <div className="flex flex-col gap-2.5">
            <Button variant="outline" className="w-full rounded-xl gap-2 text-muted-foreground" onClick={() => navigate("/dashboard")}>
              <ArrowRight className="h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanejamentoFinanceiroCurso;
