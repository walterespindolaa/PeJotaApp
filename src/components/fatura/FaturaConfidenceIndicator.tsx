import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, ShieldAlert, Shield, AlertTriangle } from "lucide-react";
import type { StatementLine } from "./FaturaImportTab";

interface Props {
  lines: StatementLine[];
}

export default function FaturaConfidenceIndicator({ lines }: Props) {
  if (!lines.length) return null;

  const active = lines.filter(l => !l.isDuplicate && l.status !== "ignored");
  if (!active.length) return null;

  const avgConfidence = active.reduce((s, l) => s + l.confidence, 0) / active.length;
  const score = Math.round(avgConfidence * 100);

  const byRule = active.filter(l => l.origin === "rule").length;
  const byCache = active.filter(l => l.origin === "cache").length;
  const byAI = active.filter(l => l.origin === "ai").length;
  const uncategorized = active.filter(l => !l.category).length;

  const pctRule = Math.round((byRule / active.length) * 100);
  const pctCache = Math.round((byCache / active.length) * 100);
  const pctAI = Math.round((byAI / active.length) * 100);

  const level = score >= 80 ? "high" : score >= 50 ? "medium" : "low";
  const config = {
    high: { label: "Alta confiança", color: "text-success", bg: "bg-success/10", Icon: ShieldCheck, variant: "default" as const },
    medium: { label: "Média confiança", color: "text-amber-500", bg: "bg-amber-500/10", Icon: Shield, variant: "secondary" as const },
    low: { label: "Baixa confiança", color: "text-destructive", bg: "bg-destructive/10", Icon: ShieldAlert, variant: "destructive" as const },
  }[level];

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg ${config.bg} flex items-center justify-center`}>
              <config.Icon className={`h-4 w-4 ${config.color}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Confiança da análise</p>
              <div className="flex items-center gap-2">
                <span className={`text-lg font-bold ${config.color}`}>{score}%</span>
                <Badge variant={config.variant} className="text-[9px]">{config.label}</Badge>
              </div>
            </div>
          </div>
        </div>

        <Progress value={score} className="h-1.5 mb-3" />

        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground">Regras</p>
            <p className="text-xs font-semibold text-success">{pctRule}%</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Cache</p>
            <p className="text-xs font-semibold text-info">{pctCache}%</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">IA</p>
            <p className="text-xs font-semibold text-accent">{pctAI}%</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Sem cat.</p>
            <p className="text-xs font-semibold text-destructive">{uncategorized}</p>
          </div>
        </div>

        {level === "low" && (
          <p className="text-[11px] text-destructive mt-3 bg-destructive/5 p-2 rounded-lg inline-flex items-start gap-1.5">
            <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />Algumas transações podem precisar de revisão manual.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
