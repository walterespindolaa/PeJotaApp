import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { ChevronRight } from "lucide-react";
import { homeSections, type KpiKey } from "@/components/admin/adminSections";

type Kpis = Record<KpiKey, number | null>;

const safeCount = async (fn: () => Promise<{ count: number | null }>): Promise<number | null> => {
  try {
    const { count } = await fn();
    return count ?? 0;
  } catch {
    return null;
  }
};

const AdminDashboardHome = () => {
  const [kpis, setKpis] = useState<Kpis>({
    usersCount: null,
    activeUsers: null,
    mrr: null,
    newLeads: null,
    newInsuranceLeads: null,
    partnersCount: null,
    feedbackNovos: null,
    recadosAtivos: null,
    logsRecentes: null,
  });

  useEffect(() => {
    (async () => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const [usersCount, activeUsers, feedbackNovos, recadosAtivos, newLeads, newInsuranceLeads, partnersCount] = await Promise.all([
        safeCount(() => (supabase as any).from("profiles").select("*", { count: "exact", head: true })),
        safeCount(() => (supabase as any).from("user_subscriptions").select("*", { count: "exact", head: true }).eq("plan_tier", "full")),
        safeCount(() => (supabase as any).from("user_feedback").select("*", { count: "exact", head: true }).eq("status", "novo")),
        safeCount(() => (supabase as any).from("admin_recados").select("*", { count: "exact", head: true }).or(`expires_at.is.null,expires_at.gt.${nowIso}`)),
        safeCount(() => (supabase as any).from("advisory_leads").select("*", { count: "exact", head: true }).eq("status", "novo")),
        safeCount(() => (supabase as any).from("insurance_leads").select("*", { count: "exact", head: true }).eq("status", "novo")),
        safeCount(() => (supabase as any).from("partners").select("*", { count: "exact", head: true })),
      ]);

      const logsRecentes = await safeCount(() =>
        (supabase as any).from("system_logs").select("*", { count: "exact", head: true }).gte("created_at", weekAgo),
      );

      setKpis({
        usersCount,
        activeUsers,
        mrr: null,
        newLeads,
        newInsuranceLeads,
        partnersCount,
        feedbackNovos,
        recadosAtivos,
        logsRecentes,
      });
    })();
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {homeSections.map(section => {
          const Icon = section.icon;
          const kpiValue = section.kpi ? kpis[section.kpi] : null;
          const showBadge = section.badge === "alert" && typeof kpiValue === "number" && kpiValue > 0;

          return (
            <Link
              key={section.to}
              to={section.to}
              className="group block"
            >
              <Card className="rounded-2xl border-border/60 shadow-soft p-4 h-full transition-all duration-200 group-hover:shadow-elevated group-hover:-translate-y-0.5 group-hover:border-primary/30">
                <div className="flex items-start gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    {showBadge && (
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-heading font-semibold text-sm truncate">{section.label}</h3>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{section.description}</p>
                    {section.kpi && (
                      <p className="text-[11px] font-heading font-medium mt-1.5 tabular-nums">
                        {kpiValue === null ? (
                          <span className="text-muted-foreground/40">—</span>
                        ) : (
                          <span className={showBadge ? "text-destructive" : "text-foreground/80"}>
                            {kpiValue}{section.kpiSuffix ? ` ${section.kpiSuffix}` : ""}
                          </span>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDashboardHome;
