import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Discrete upsell banner shown at the top of RendaDespesas (Planejamento e Controle)
 * when user is in trial_expired or cancelled_grace state.
 */
const PlanejamentoUpsell = () => {
  const { accessState, loading } = usePlan();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  if (loading || isAdmin) return null;
  if (accessState !== "trial_expired" && accessState !== "cancelled_grace") return null;

  return (
    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 mb-6 animate-fade-in">
      <div className="flex items-start gap-3">
        <Lightbulb className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground mb-1 flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-accent flex-shrink-0" />
            Quer transformar seus dados em estratégia?
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Desbloqueie o PeJota Pro e tenha acesso a:
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 mb-3">
            <li className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-accent flex-shrink-0" />
              Diagnóstico completo da sua vida financeira
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-accent flex-shrink-0" />
              Projeções de aposentadoria
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-accent flex-shrink-0" />
              Mapa do futuro patrimonial
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles className="h-3 w-3 text-accent flex-shrink-0" />
              Relatórios estratégicos com IA
            </li>
          </ul>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => navigate("/dashboard/planos")}
          >
            Ver planos
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlanejamentoUpsell;
