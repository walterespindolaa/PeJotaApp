import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, ArrowRight, Plus, Layers, FileText, DollarSign, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "react-router-dom";
import { usePrivacyFmt } from "@/components/PrivacyValue";

interface LatestStatement {
  id: string;
  statement_month: string;
  source_name: string;
  total_items: number;
  total_amount: number;
  status: string;
  detected_installments: number;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  applied: { label: "✅ Aplicada", variant: "default", className: "bg-success/15 text-success border-success/30" },
  reviewing: { label: "🟡 Em revisão", variant: "secondary", className: "bg-warning/15 text-warning border-warning/30" },
  reviewing_low_confidence: { label: "🟠 Revisão necessária", variant: "secondary", className: "bg-orange-500/15 text-orange-600 border-orange-500/30" },
};

function formatMonth(monthStr: string): string {
  if (!monthStr) return "";
  const [y, m] = monthStr.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function FaturaWidget() {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const [latest, setLatest] = useState<LatestStatement | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    supabase.from("credit_card_statements" as any)
      .select("id,statement_month,source_name,total_items,total_amount,status,detected_installments")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setLatest(data as any);
          if ((data as any).status === "reviewing" || (data as any).status === "reviewing_low_confidence") {
            supabase.from("credit_card_statement_lines" as any)
              .select("id", { count: "exact", head: true })
              .eq("statement_id", (data as any).id)
              .eq("status", "pending_review")
              .then(({ count }) => setPendingCount(count || 0));
          }
        }
      });
  }, [user]);

  const statusCfg = latest ? STATUS_CONFIG[latest.status] || { label: latest.status, variant: "outline" as const, className: "" } : null;

  return (
    <Card className="border-border/40 shadow-soft">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-primary" />
          <p className="text-xs font-heading font-semibold uppercase tracking-wider text-muted-foreground">Última Fatura</p>
        </div>

        {latest ? (
          <div className="space-y-4">
            {/* Bank name + month */}
            <div>
              <p className="text-sm font-heading font-bold text-foreground">{latest.source_name}</p>
              <p className="text-xs text-muted-foreground">{formatMonth(latest.statement_month)}</p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                      <CreditCard className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-sm font-heading font-bold">{latest.total_items}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p>Transações na fatura</p></TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                      <DollarSign className="h-3.5 w-3.5 text-success flex-shrink-0" />
                      <span className="text-sm font-heading font-bold truncate">{fmt(Number(latest.total_amount || 0))}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent><p>Valor total da fatura</p></TooltipContent>
                </Tooltip>

                {latest.detected_installments > 0 && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/50">
                        <Layers className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                        <span className="text-sm font-heading font-bold">{latest.detected_installments}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent><p>Parcelamentos ativos</p></TooltipContent>
                  </Tooltip>
                )}
              </TooltipProvider>
            </div>

            {/* Status badge */}
            {statusCfg && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Status:</span>
                <Badge variant={statusCfg.variant} className={`text-xs ${statusCfg.className}`}>
                  {statusCfg.label}
                </Badge>
              </div>
            )}

            {/* Pending review warning */}
            {(latest.status === "reviewing" || latest.status === "reviewing_low_confidence") && pendingCount > 0 && (
              <p className="text-xs text-warning font-medium inline-flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" />{pendingCount} pendência{pendingCount > 1 ? "s" : ""} de revisão</p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              {(latest.status === "reviewing" || latest.status === "reviewing_low_confidence") && (
                <Link to="/dashboard/fatura">
                  <Button size="sm" variant="outline" className="text-xs h-8 gap-1 rounded-lg">
                    <ArrowRight className="h-3 w-3" /> Continuar revisão
                  </Button>
                </Link>
              )}
              <Link to="/dashboard/fatura">
                <Button size="sm" variant="ghost" className="text-xs h-8 gap-1 rounded-lg">
                  <Plus className="h-3 w-3" /> Importar nova
                </Button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <CreditCard className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground mb-1">Nenhuma fatura importada</p>
            <p className="text-xs text-muted-foreground/60 mb-3">Importe sua fatura do cartão para análise automática.</p>
            <Link to="/dashboard/fatura">
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1 rounded-lg">
                <Plus className="h-3 w-3" /> Importar fatura
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
