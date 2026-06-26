import { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useFeatureAccess, FeatureKey } from "@/hooks/useFeatureAccess";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles, ArrowRight } from "lucide-react";

interface FeatureGateProps {
  featureKey: FeatureKey;
  moduleName: string;
  moduleDescription: string;
  benefits: string[];
  children: ReactNode;
}

const FeatureGate = ({ featureKey, moduleName, moduleDescription, benefits, children }: FeatureGateProps) => {
  const { hasFeature, requiredPlanFor, loading } = useFeatureAccess();
  const navigate = useNavigate();

  if (loading) return null;
  if (hasFeature(featureKey)) return <>{children}</>;

  const requiredPlan = requiredPlanFor(featureKey);

  // Split description by \n\n for paragraph separation
  const descParagraphs = moduleDescription.split("\n\n");

  return (
    <div className="relative animate-fade-in">
      {/* Blurred preview of actual content */}
      <div className="pointer-events-none select-none filter blur-[6px] opacity-40 max-h-[60vh] overflow-hidden" aria-hidden="true">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex items-start justify-center pt-12 z-10">
        <div className="bg-card/95 backdrop-blur-xl border border-border/60 rounded-2xl shadow-2xl max-w-lg w-full mx-4 p-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <Lock className="h-7 w-7 text-primary" />
          </div>

          <h2 className="text-xl font-heading font-bold text-foreground mb-3">
            {moduleName}
          </h2>
          
          <div className="text-sm text-muted-foreground mb-5 text-left space-y-3">
            {descParagraphs.map((p, i) => (
              <p key={i} className="leading-relaxed">
                {p.split("\n").map((line, li) => (
                  <span key={li}>
                    {line.startsWith("•") ? (
                      <span className="block pl-4">{line}</span>
                    ) : (
                      line
                    )}
                    {li < p.split("\n").length - 1 && !line.startsWith("•") && <br />}
                  </span>
                ))}
              </p>
            ))}
          </div>

          <div className="text-left bg-muted/40 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wider mb-3">
              Este módulo permite:
            </p>
            <ul className="space-y-2">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Sparkles className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-muted-foreground mb-5">
            Disponível no plano{" "}
            <span className="font-semibold text-primary">{requiredPlan?.name || "PeJota Pro"}</span>.
          </p>

          <div className="flex flex-col gap-2.5">
            <Button className="w-full rounded-xl gap-2" onClick={() => navigate("/dashboard/planos")}>
              <Sparkles className="h-4 w-4" />
              Ver comparação de planos
            </Button>
            <Button variant="outline" className="w-full rounded-xl gap-2 text-muted-foreground" onClick={() => navigate("/dashboard")}>
              <ArrowRight className="h-4 w-4" />
              Voltar ao Dashboard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureGate;
