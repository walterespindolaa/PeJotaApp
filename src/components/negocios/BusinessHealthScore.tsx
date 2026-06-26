import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { HelpCircle, ChevronRight, CheckCircle2, AlertCircle, XCircle, Lightbulb, AlertTriangle } from "lucide-react";
import type { BusinessTransaction, AllocationRule, BusinessCategory } from "@/hooks/useCompanies";
import { format, subMonths } from "date-fns";

interface Props {
  transactions: BusinessTransaction[];
  allTransactions: BusinessTransaction[];
  categories: BusinessCategory[];
  revenue: number;
  expenses: number;
  allocationRules: AllocationRule[];
}

interface Factor {
  name: string;
  score: number;
  maxScore: number;
  label: string;
  tip: string;
  statusIcon: React.ReactNode;
}

const StatusGood = () => <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />;
const StatusWarn = () => <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />;
const StatusBad = () => <XCircle className="h-3.5 w-3.5 text-destructive flex-shrink-0" />;

function getStatusIcon(score: number, maxScore: number): React.ReactNode {
  const pct = score / maxScore;
  if (pct >= 0.75) return <StatusGood />;
  if (pct >= 0.5) return <StatusWarn />;
  return <StatusBad />;
}

function calcHealthScore(
  transactions: BusinessTransaction[],
  allTransactions: BusinessTransaction[],
  categories: BusinessCategory[],
  revenue: number,
  expenses: number,
  allocationRules: AllocationRule[],
): { total: number; factors: Factor[] } {
  const profit = revenue - expenses;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  const factors: Factor[] = [];

  let marginScore = 5;
  if (margin > 30) marginScore = 20;
  else if (margin > 15) marginScore = 10;
  factors.push({
    name: "Margem", score: marginScore, maxScore: 20,
    label: margin > 30 ? "Excelente" : margin > 15 ? "Boa" : "Baixa",
    tip: margin > 15 ? "Sua margem esta em um nivel saudavel." : "Reveja seus custos para aumentar a margem.",
    statusIcon: getStatusIcon(marginScore, 20),
  });

  const now = new Date();
  const curMonth = format(now, "yyyy-MM");
  const prevMonth = format(subMonths(now, 1), "yyyy-MM");
  const curRev = allTransactions.filter(t => t.date.startsWith(curMonth) && t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);
  const prevRev = allTransactions.filter(t => t.date.startsWith(prevMonth) && t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);
  let growthPct = 0;
  if (prevRev > 0) growthPct = ((curRev - prevRev) / prevRev) * 100;
  let growthScore = 5;
  if (growthPct > 10) growthScore = 20;
  else if (growthPct >= -5) growthScore = 10;
  factors.push({
    name: "Crescimento", score: growthScore, maxScore: 20,
    label: growthPct > 10 ? "Crescendo" : growthPct >= -5 ? "Estavel" : "Caindo",
    tip: growthPct > 0 ? `Receita subiu ${Math.round(growthPct)}% vs. mes anterior.` : growthPct < -5 ? `Receita caiu ${Math.abs(Math.round(growthPct))}% vs. mes anterior.` : "Receita estavel em relacao ao mes anterior.",
    statusIcon: getStatusIcon(growthScore, 20),
  });

  const costRatio = revenue > 0 ? (expenses / revenue) * 100 : 100;
  let costScore = 5;
  if (costRatio < 70) costScore = 20;
  else if (costRatio <= 85) costScore = 10;
  factors.push({
    name: "Custos", score: costScore, maxScore: 20,
    label: costRatio < 70 ? "Controlado" : costRatio <= 85 ? "Atencao" : "Alto",
    tip: `Despesas representam ${Math.round(costRatio)}% do faturamento.`,
    statusIcon: getStatusIcon(costScore, 20),
  });

  const activeRules = allocationRules.filter(r => r.active);
  let orgScore = 5;
  if (activeRules.length >= 3) {
    let matching = 0;
    for (const rule of activeRules) {
      let base = revenue;
      if (rule.base === "gross_profit" || rule.base === "net_profit") base = profit;
      const planned = Math.max(0, base * (rule.percentage / 100));
      const matchCats = categories.filter(c => c.name.toLowerCase().includes(rule.name.toLowerCase().split("/")[0].trim()));
      const actual = matchCats.length > 0
        ? transactions.filter(t => t.direction === "out" && matchCats.some(mc => mc.id === t.category_id)).reduce((s, t) => s + Number(t.amount), 0)
        : 0;
      if (planned > 0 && actual <= planned * 1.2) matching++;
    }
    const ratio = matching / activeRules.length;
    if (ratio >= 0.7) orgScore = 20;
    else if (ratio >= 0.4) orgScore = 10;
  } else if (activeRules.length > 0) {
    orgScore = 10;
  }
  factors.push({
    name: "Organizacao", score: orgScore, maxScore: 20,
    label: orgScore >= 15 ? "Seguida" : orgScore >= 10 ? "Parcial" : "Nao configurada",
    tip: orgScore >= 15 ? "Seus gastos estao alinhados com o planejamento." : "Configure e siga suas regras de provisao para melhorar.",
    statusIcon: getStatusIcon(orgScore, 20),
  });

  const months = new Set(allTransactions.map(t => t.date.substring(0, 7)));
  let dataScore = 5;
  if (months.size >= 3) dataScore = 20;
  else if (months.size >= 2) dataScore = 10;
  factors.push({
    name: "Dados", score: dataScore, maxScore: 20,
    label: months.size >= 3 ? "Completo" : months.size >= 2 ? "Parcial" : "Poucos",
    tip: `Dados registrados em ${months.size} meses. Quanto mais meses registrados, mais precisas as analises.`,
    statusIcon: getStatusIcon(dataScore, 20),
  });

  const total = factors.reduce((s, f) => s + f.score, 0);
  return { total, factors };
}

export default function BusinessHealthScore({ transactions, allTransactions, categories, revenue, expenses, allocationRules }: Props) {
  const [detailOpen, setDetailOpen] = useState(false);

  const { total, factors } = useMemo(
    () => calcHealthScore(transactions, allTransactions, categories, revenue, expenses, allocationRules),
    [transactions, allTransactions, categories, revenue, expenses, allocationRules]
  );

  if (allTransactions.length < 2) return null;

  const color = total >= 80 ? "text-emerald-600" : total >= 60 ? "text-amber-600" : "text-destructive";
  const bgColor = total >= 80 ? "bg-emerald-500" : total >= 60 ? "bg-amber-500" : "bg-destructive";
  const statusLabel = total >= 80 ? "Saudavel" : total >= 60 ? "Atencao" : "Risco";
  const StatusIcon = total >= 80 ? CheckCircle2 : total >= 60 ? AlertCircle : XCircle;
  const statusColor = total >= 80 ? "text-emerald-600" : total >= 60 ? "text-amber-600" : "text-destructive";

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-shrink-0">
              <svg width="72" height="72" viewBox="0 0 72 72">
                <circle cx="36" cy="36" r="30" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                <circle
                  cx="36" cy="36" r="30" fill="none"
                  stroke={total >= 80 ? "hsl(142, 71%, 45%)" : total >= 60 ? "hsl(38, 92%, 50%)" : "hsl(var(--destructive))"}
                  strokeWidth="5" strokeLinecap="round"
                  strokeDasharray={`${(total / 100) * 188.5} 188.5`}
                  transform="rotate(-90 36 36)"
                  className="transition-all duration-700"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold font-heading ${color}`}>{total}</span>
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-heading font-bold">Saude do Negocio</h3>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Score de 0 a 100 baseado em margem, crescimento, controle de custos, organizacao e consistencia dos dados.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className={`text-xs font-medium mt-0.5 ${statusColor} flex items-center gap-1`}>
                <StatusIcon className="h-3.5 w-3.5" /> {statusLabel}
              </p>
              <Progress value={total} className={`h-1.5 mt-2 [&>div]:${bgColor}`} />
              <div className="flex gap-2 mt-2 flex-wrap">
                {factors.map(f => (
                  <span key={f.name} className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    {f.statusIcon} {f.name}: {f.score}/{f.maxScore}
                  </span>
                ))}
              </div>
            </div>

            <Button variant="ghost" size="sm" className="flex-shrink-0 h-8 text-xs gap-1" onClick={() => setDetailOpen(true)}>
              Detalhes <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Saude do Negocio — <span className={color}>{total}/100</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {factors.map(f => (
              <div key={f.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium flex items-center gap-1.5">{f.statusIcon} {f.name}</span>
                  <span className="text-xs text-muted-foreground">{f.score}/{f.maxScore} — {f.label}</span>
                </div>
                <Progress value={(f.score / f.maxScore) * 100} className="h-1.5" />
                <p className="text-[11px] text-muted-foreground">{f.tip}</p>
              </div>
            ))}

            <div className="pt-2 border-t border-border space-y-2">
              <h4 className="text-xs font-heading font-semibold flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> Como melhorar
              </h4>
              {factors.filter(f => f.score < f.maxScore * 0.7).map(f => (
                <p key={f.name} className="text-[11px] text-muted-foreground">
                  {f.name}: {f.tip}
                </p>
              ))}
              {factors.every(f => f.score >= f.maxScore * 0.7) && (
                <p className="text-[11px] text-emerald-600">Todos os indicadores estao saudaveis! Continue assim.</p>
              )}
              <p className="text-[10px] text-muted-foreground italic mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Regras fiscais variam. Valide com seu contador.
              </p>
            </div>
          </div>
          <DialogClose asChild><Button variant="outline" size="sm">Fechar</Button></DialogClose>
        </DialogContent>
      </Dialog>
    </>
  );
}
