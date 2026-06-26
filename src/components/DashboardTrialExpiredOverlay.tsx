import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { STRIPE_ESSENCIAL_URL } from "@/lib/checkout";

/**
 * Overlay shown on the Dashboard when user is in trial_expired or cancelled_grace state.
 * Blurs the actual dashboard content and shows a CTA.
 */
const DashboardTrialExpiredOverlay = ({ children }: { children: React.ReactNode }) => {
  const navigate = useNavigate();

  return (
    <div className="relative animate-fade-in">
      {/* Blurred content */}
      <div className="pointer-events-none select-none filter blur-[6px] opacity-40 max-h-[70vh] overflow-hidden" aria-hidden="true">
        {children}
      </div>

      {/* Overlay CTA */}
      <div className="absolute inset-0 flex items-start justify-center pt-16 z-10">
        <Card className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl max-w-lg w-full mx-4">
          <CardContent className="p-8 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
              <Lock className="h-7 w-7 text-primary" />
            </div>

            <h2 className="text-xl font-heading font-bold text-foreground mb-3">
              Seu acesso completo ao Atlas terminou
            </h2>

            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Seus dados continuam seguros na plataforma.
              <br />
              Ative um plano para desbloquear relatórios estratégicos, projeções financeiras e todos os módulos do Atlas.
            </p>

            <div className="flex flex-col gap-3">
              <a href={STRIPE_ESSENCIAL_URL} target="_blank" rel="noopener noreferrer">
                <Button className="w-full rounded-xl gap-2">
                  <Sparkles className="h-4 w-4" />
                  Ativar Atlas Essencial – R$15,90
                </Button>
              </a>
              <Button
                variant="outline"
                className="w-full rounded-xl"
                onClick={() => navigate("/dashboard/planos")}
              >
                Ver planos
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardTrialExpiredOverlay;
