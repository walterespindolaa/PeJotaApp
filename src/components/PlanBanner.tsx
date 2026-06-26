import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Zap, Lock, AlertTriangle, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

const PlanBanner = () => {
  const {
    loading, isFull, isTrialActive, accessState,
    daysRemainingTrial, daysRemainingGrace, daysUntilFullExpires, showRenewalBanner,
  } = usePlan();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  // Renewal banner for FULL near expiry
  if (showRenewalBanner) {
    return (
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 rounded-xl bg-primary/10 border border-primary/30 px-4 py-3 text-sm mb-4">
        <Gift className="h-5 w-5 text-primary flex-shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1">
          <p className="font-semibold text-foreground">
            {isFull
              ? `Seu plano Atlas expira em ${daysUntilFullExpires} dia${daysUntilFullExpires !== 1 ? "s" : ""}.`
              : "Seu plano Atlas expirou recentemente."}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Renove agora para manter o acesso completo ao Atlas.
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1.5 flex-shrink-0" onClick={() => navigate("/dashboard/planos")}>
          <Gift className="h-3.5 w-3.5" /> Renovar agora
        </Button>
      </div>
    );
  }

  if (isFull) return null;

  if (isTrialActive) {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-accent/10 border border-accent/30 px-4 py-2.5 text-sm mb-4">
        <Zap className="h-4 w-4 text-accent flex-shrink-0" />
        <span>Você está no período gratuito. Faltam <strong>{daysRemainingTrial} dia{daysRemainingTrial !== 1 ? "s" : ""}</strong>.</span>
        <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={() => navigate("/dashboard/planos")}>Ativar Plano</Button>
      </div>
    );
  }

  if (accessState === "trial_expired" || accessState === "cancelled_grace") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-warning/10 border border-warning/30 px-4 py-2.5 text-sm mb-4">
        <Lock className="h-4 w-4 text-warning flex-shrink-0" />
        <span>
          {accessState === "cancelled_grace"
            ? "Seu plano foi cancelado. Você tem acesso limitado por mais "
            : "Seu período gratuito terminou. Acesso limitado por mais "}
          <strong>{daysRemainingGrace} dia{daysRemainingGrace !== 1 ? "s" : ""}</strong>.
        </span>
        <Button size="sm" variant="outline" className="h-7 text-xs ml-auto" onClick={() => navigate("/dashboard/planos")}>Ativar Plano</Button>
      </div>
    );
  }

  if (accessState === "inactive_user") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-4 py-2.5 text-sm mb-4">
        <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
        <span>Sua conta está desativada por inatividade.</span>
        <Button size="sm" variant="default" className="h-7 text-xs ml-auto" onClick={() => navigate("/dashboard/planos")}>Reativar</Button>
      </div>
    );
  }

  return null;
};

export default PlanBanner;
