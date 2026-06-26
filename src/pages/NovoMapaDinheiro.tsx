import { useNavigate } from "react-router-dom";
import { Globe, Sparkles, Clock, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const BENEFITS = [
  "Por que o playbook de 2010-2021 não funciona mais",
  "A IA é física: cobre, prata e energia como ganhadores reais",
  "O monopólio chinês das terras raras e a desdolarização",
  "A anomalia Brasil: o padrão de 30 anos que se repete agora",
  "A assimetria das mineradoras: gaps de +400% a +600%",
  "O Método ARCA: como alocar no novo ciclo",
];

const NovoMapaDinheiro = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-[70vh] flex items-start justify-center pt-10 px-4 animate-fade-in">
      <Card className="bg-card/95 border border-border/60 rounded-2xl shadow-2xl max-w-lg w-full">
        <CardContent className="p-8 text-center">
          {/* Icon */}
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Globe className="h-8 w-8 text-primary" />
          </div>

          {/* Badge */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <Badge className="bg-primary/10 text-primary border-primary/20 rounded-full px-3 py-1 text-xs font-semibold gap-1.5">
              <Clock className="h-3 w-3" /> Em breve · Exclusivo Elite
            </Badge>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-heading font-bold text-foreground mb-1">
            O Novo Mapa do Dinheiro
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Tese macro 2024–2030: onde o capital global está indo
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

export default NovoMapaDinheiro;
