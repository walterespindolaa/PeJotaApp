import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";

interface FeatureGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureLabel: string;
  requiredPlanName: string;
}

const FeatureGateModal = ({ open, onOpenChange, featureLabel, requiredPlanName }: FeatureGateModalProps) => {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/dashboard/planos");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader className="text-center items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="font-heading text-lg">Recurso bloqueado</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            <strong>{featureLabel}</strong> está disponível no plano{" "}
            <span className="text-primary font-semibold">{requiredPlanName}</span>.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <Button className="w-full rounded-xl gap-2" onClick={handleUpgrade}>
            <Sparkles className="h-4 w-4" />
            Ver comparação de planos
          </Button>
          <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeatureGateModal;
