import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Clock, Check, ArrowLeft, Sparkles } from "lucide-react";
import { useFeatureAccess, type FeatureKey } from "@/hooks/useFeatureAccess";
import type { LucideIcon } from "lucide-react";

interface PlanGateProps {
  featureKey: FeatureKey;
  feature: {
    icon: LucideIcon;
    title: string;
    subtitle: string;
    items: string[];
  };
  children: ReactNode;
}

/**
 * Centered-card paywall gate. Uses the same useFeatureAccess hook as FeatureGate
 * but renders a full-page card instead of a blurred overlay.
 * Use this for standalone pages that have no meaningful blurred preview.
 */
const PlanGate = ({ featureKey, feature, children }: PlanGateProps) => {
  const { hasFeature, requiredPlanFor, loading } = useFeatureAccess();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (hasFeature(featureKey)) return <>{children}</>;

  const requiredPlan = requiredPlanFor(featureKey);
  const planLabel = requiredPlan?.name || "Pro";
  const Icon = feature.icon;

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4 py-8 animate-fade-in">
      <Card className="shadow-elevated max-w-xl w-full">
        <CardContent className="p-8 sm:p-10">
          <div className="flex flex-col items-center text-center">
            <div className="p-4 rounded-2xl bg-primary/10 mb-4">
              <Icon className="h-8 w-8 text-primary" />
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-4">
              <Clock className="h-3 w-3" /> Exclusivo {planLabel}
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-foreground mb-2">{feature.title}</h1>
            <p className="text-sm text-muted-foreground mb-6">{feature.subtitle}</p>

            <div className="w-full bg-muted/30 rounded-xl border border-border/50 p-5 mb-6 text-left">
              <p className="text-[10px] uppercase tracking-[0.15em] font-heading font-bold text-muted-foreground mb-3">O que você vai ter</p>
              <ul className="space-y-2.5">
                {feature.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                    <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
              <Check className="h-3.5 w-3.5 text-success" />
              <span>Disponível no plano {planLabel}.</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 w-full">
              <Button variant="outline" onClick={() => navigate("/dashboard")} className="flex-1">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao Dashboard
              </Button>
              <Button onClick={() => navigate("/dashboard/planos")} className="flex-1">
                <Sparkles className="h-4 w-4 mr-2" /> Fazer upgrade para {planLabel}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PlanGate;
