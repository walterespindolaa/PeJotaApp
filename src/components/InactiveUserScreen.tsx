import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Full-screen block shown when user status is inactive_user (45+ days without subscription).
 */
const InactiveUserScreen = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center h-[70vh] text-center px-6 animate-fade-in">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
        <Lock className="h-8 w-8 text-destructive" />
      </div>
      <h1 className="text-2xl font-heading font-bold mb-3">
        Sua conta foi desativada por inatividade
      </h1>
      <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
        Seus dados continuam salvos na plataforma. Ative um plano para recuperar o acesso completo ao PeJota.
      </p>
      <Button size="lg" onClick={() => navigate("/dashboard/planos")}>
        Reativar acesso
      </Button>
    </div>
  );
};

export default InactiveUserScreen;
