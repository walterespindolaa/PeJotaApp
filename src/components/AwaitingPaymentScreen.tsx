import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { STRIPE_ESSENCIAL_URL } from "@/lib/checkout";

/**
 * Shown when user signed up via normal flow and hasn't paid yet.
 * They need to subscribe to access the platform.
 */
const AwaitingPaymentScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-start justify-center pt-16 animate-fade-in">
      <Card className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl max-w-lg w-full mx-4">
        <CardContent className="p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <CreditCard className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-xl font-heading font-bold text-foreground mb-3">
            Bem-vindo ao PeJota!
          </h2>

          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Para começar a usar a plataforma, ative seu plano.
            <br />
            Escolha entre PeJota Essencial, Pro ou Elite e desbloqueie seu planejamento financeiro completo.
          </p>

          <div className="flex flex-col gap-3">
            <a href={STRIPE_ESSENCIAL_URL} target="_blank" rel="noopener noreferrer">
              <Button className="w-full rounded-xl gap-2">
                <Sparkles className="h-4 w-4" />
                Ativar PeJota Essencial – R$15,90
              </Button>
            </a>
            <Button
              variant="outline"
              className="w-full rounded-xl"
              onClick={() => navigate("/dashboard/planos")}
            >
              Ver todos os planos
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AwaitingPaymentScreen;
