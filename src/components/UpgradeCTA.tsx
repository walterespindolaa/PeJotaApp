import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";
import { useNavigate } from "react-router-dom";
import { Zap, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Compact upgrade CTA card for embedding in pages (Dashboard footer, Aposentadoria, etc.)
 * Different from PlanBanner (top bar) — this is a card-style CTA.
 */
const UpgradeCTA = () => {
  const { loading, isFull, isTrialActive, isGraceFinanceActive, isRestricted, showRenewalBanner, daysUntilFullExpires } = usePlan();
  const { isAdmin } = useUserRole();
  const navigate = useNavigate();

  // Renewal banner for FULL near expiry
  if (showRenewalBanner) {
    return (
      <Card className="rounded-2xl border-primary/30 bg-primary/5">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Gift className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {isFull
                ? `Seu PeJota expira em ${daysUntilFullExpires} dia${daysUntilFullExpires !== 1 ? "s" : ""}`
                : "Seu PeJota expirou recentemente"}
            </p>
            <p className="text-xs text-muted-foreground">
              Renove agora para manter o acesso completo ao PeJota.
            </p>
          </div>
          <Button size="sm" className="text-xs gap-1.5" onClick={() => navigate("/dashboard/planos")}>
            <Gift className="h-3.5 w-3.5" /> Renovar agora
          </Button>
        </CardContent>
      </Card>
    );
  }

  // FULL active → no CTA
  if (isFull) return null;

  // Non-FULL CTA
  if (isTrialActive || isGraceFinanceActive || isRestricted) {
    return (
      <Card className="rounded-2xl border-accent/30 bg-accent/5">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <Zap className="h-5 w-5 text-accent flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold">Desbloqueie o PeJota Pro</p>
            <p className="text-xs text-muted-foreground">Acesso total a relatórios, investimentos, aposentadoria e mais.</p>
          </div>
          <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate("/dashboard/planos")}>Ativar Pro</Button>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default UpgradeCTA;
