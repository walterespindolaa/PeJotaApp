import { usePlan } from "@/hooks/usePlan";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Lock, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { getUpgradeUrl } from "@/lib/checkout";

const RestrictedScreen = () => {
  const { daysUntilDeletion, accessState } = usePlan();
  const { userPlan } = useFeatureAccess();
  const navigate = useNavigate();
  const upgradeUrl = getUpgradeUrl(userPlan?.slug);

  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
        <Lock className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-heading font-bold mb-3">Seu acesso foi congelado</h1>
      <p className="text-muted-foreground max-w-md mb-2">
        Seus dados ficarão armazenados por mais <strong>{daysUntilDeletion} dia{daysUntilDeletion !== 1 ? "s" : ""}</strong>.
      </p>
      <p className="text-muted-foreground max-w-md mb-8">
        Após esse período serão excluídos automaticamente.
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <a href={upgradeUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
            <ArrowRight className="h-4 w-4" />
            Reativar Plano
          </a>
        </Button>
        <Button variant="outline" size="lg" onClick={() => navigate("/dashboard/planos")}>
          Ver planos
        </Button>
      </div>
    </div>
  );
};

export default RestrictedScreen;
