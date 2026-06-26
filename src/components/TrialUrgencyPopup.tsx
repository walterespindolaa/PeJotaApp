import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Zap, ArrowRight } from "lucide-react";

const TrialUrgencyPopup = () => {
  const { isTrialActive, daysRemainingTrial, planTier, loading } = usePlan();
  const { isAdmin } = useUserRole();
  const { userPlan } = useFeatureAccess();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || planTier !== "free" || isAdmin) return;
    if (!isTrialActive || daysRemainingTrial > 2) return;

    const key = `trial_popup_${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(key)) return;

    setOpen(true);
    localStorage.setItem(key, "1");
  }, [loading, isTrialActive, daysRemainingTrial, planTier, isAdmin]);

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Zap className="h-5 w-5 text-warning" />
            Seu acesso completo termina em breve
          </DialogTitle>
          <DialogDescription className="text-sm pt-2">
            {daysRemainingTrial === 0
              ? "Hoje é o último dia do seu período de teste completo."
              : `Faltam ${daysRemainingTrial} dia${daysRemainingTrial > 1 ? "s" : ""} para perder acesso aos módulos estratégicos do PeJota.`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 pt-4">
          <Button className="w-full" onClick={() => { setOpen(false); navigate("/dashboard/planos"); }}>
            <ArrowRight className="h-4 w-4" />
            Ativar Plano Completo
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setOpen(false)}>
            Continuar usando versão gratuita
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TrialUrgencyPopup;
