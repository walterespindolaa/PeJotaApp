import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Calculator, Info, Sparkles, TrendingUp, TrendingDown, Megaphone, Users, RefreshCw, BarChart3, AlertTriangle } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import PrivacyValue from "@/components/PrivacyValue";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from "recharts";
import { AllocationRule } from "@/hooks/useCompanies";

interface Props {
  currentRevenue: number;
  currentExpenses: number;
  allocationRules?: AllocationRule[];
}

export default function CashFlowSimulator({ currentRevenue, currentExpenses, allocationRules = [] }: Props) {
  const { fmt, isPrivate } = usePrivacyFmt();

  const [revenueAdj, setRevenueAdj] = useState(0);
  const [expenseAdj, setExpenseAdj] = useState(0);
  const [marketingAdj, setMarketingAdj] = useState(0);
  const [caixaStr, setCaixaStr] = useState("");

  const currentProfit = currentRevenue - currentExpenses;
  // Caixa atual informado pela pessoa (o que ela tem em conta hoje). Sem isso,
  // partimos de 0 — a projeção mostra o resultado acumulado, sem inventar saldo.
  const currentCash = caixaStr ? Math.max(0, Number(caixaStr) || 0) : 0;

  const projections = useMemo(() => {
    const adjRevenue = currentRevenue * (1 + revenueAdj / 100);
    const adjExpenses = currentExpenses * (1 + expenseAdj / 100);
    const marketingCost = currentRevenue * (marketingAdj / 100);
    const totalExpenses = adjExpenses + marketingCost;
    const grossProfit = adjRevenue - totalExpenses;

    // Apply allocation rules
    let totalProvisions = 0;
    const provisionDetails: { name: string; value: number }[] = [];
    for (const rule of allocationRules.filter(r => r.active)) {
      let base = adjRevenue;
      if (rule.base === "gross_profit") base = grossProfit;
      else if (rule.base === "net_profit") base = grossProfit;
      const val = Math.max(0, base * (rule.percentage / 100));
      totalProvisions += val;
      provisionDetails.push({ name: rule.name, value: val });
    }

    const monthlyProfit = grossProfit;
    const dailyExpense = totalExpenses / 30;

    const data = [
      { label: "Hoje", caixa: currentCash },
      { label: "30 dias", caixa: currentCash + monthlyProfit },
      { label: "60 dias", caixa: currentCash + monthlyProfit * 2 },
      { label: "90 dias", caixa: currentCash + monthlyProfit * 3 },
    ];

    const diasDeCaixa = dailyExpense > 0 ? Math.round(currentCash / dailyExpense) : 999;

    return { data, monthlyProfit, diasDeCaixa, totalProvisions, provisionDetails, adjRevenue, totalExpenses };
  }, [currentRevenue, currentExpenses, revenueAdj, expenseAdj, marketingAdj, currentCash, allocationRules]);

  const applyQuickValue = (field: "revenue" | "expense" | "marketing", deltaPercent: number) => {
    if (field === "revenue") setRevenueAdj(prev => Math.max(-50, Math.min(prev + deltaPercent, 100)));
    else if (field === "expense") setExpenseAdj(prev => Math.max(-50, Math.min(prev + deltaPercent, 100)));
    else setMarketingAdj(prev => Math.max(0, Math.min(prev + deltaPercent, 30)));
  };

  // Convert fixed R$ presets to % of base
  const pctOf = (abs: number, base: number) => base > 0 ? Math.round((abs / base) * 100) : 5;

  const diasSemaphore = projections.diasDeCaixa > 60
    ? { label: "Saudável", cls: "text-success bg-success/10" }
    : projections.diasDeCaixa > 30
    ? { label: "Atenção", cls: "text-warning bg-warning/10" }
    : { label: "Crítico", cls: "text-destructive bg-destructive/10" };

  const semDados = currentRevenue === 0 && currentExpenses === 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Calculator className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-heading flex items-center gap-1.5"><Sparkles className="h-4 w-4" />Simular Cenário — "E se…?"</CardTitle>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3.5 w-3.5 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">
                Ajuste os controles para ver como mudanças afetam seu caixa nos próximos 90 dias. Seus dados reais não mudam.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <Info className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <p className="text-[11px] text-muted-foreground">
            Isso é uma simulação: seus dados reais não mudam. Mova os controles para explorar cenários.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Caixa atual — base real da projeção */}
        <div>
          <label className="text-[11px] text-muted-foreground">Caixa atual (o que você tem em conta hoje)</label>
          <Input type="number" min={0} value={caixaStr} onChange={e => setCaixaStr(e.target.value)} placeholder="Ex: 5.000 — deixe vazio para ver só o resultado acumulado" className="mt-1" />
        </div>

        {semDados && (
          <div className="rounded-lg bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
            Registre uma entrada ou saída para simular cenários com seus números reais. Por enquanto, use o campo de caixa acima para projetar.
          </div>
        )}

        {/* Quick action presets */}
        <div className="flex flex-wrap gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => applyQuickValue("revenue", 10)}>
            <TrendingUp className="h-3 w-3" />Receita +10%
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => applyQuickValue("expense", -pctOf(300, currentExpenses))}>
            <TrendingDown className="h-3 w-3" />Despesas -R$300
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => applyQuickValue("marketing", pctOf(500, currentRevenue))}>
            <Megaphone className="h-3 w-3" />Marketing +R$500
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => applyQuickValue("expense", pctOf(1200, currentExpenses))}>
            <Users className="h-3 w-3" />Equipe +R$1.200
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-[11px] font-medium gap-1"
            onClick={() => { setRevenueAdj(0); setExpenseAdj(0); setMarketingAdj(0); }}
            disabled={revenueAdj === 0 && expenseAdj === 0 && marketingAdj === 0}
          >
            <RefreshCw className="h-3 w-3" />Voltar ao cenário real
          </Button>
        </div>

        {/* Sliders */}
        <div className="grid gap-4">
          <SliderControl label="Receita" value={revenueAdj} onChange={setRevenueAdj} help="Simule aumento ou redução na receita" />
          <SliderControl label="Despesas" value={expenseAdj} onChange={setExpenseAdj} help="Simule aumento ou redução nas despesas" />
          <SliderControl label="Marketing extra" value={marketingAdj} onChange={setMarketingAdj} min={0} max={30} help="Investimento extra em marketing (% da receita)" />
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
          {[
            { label: "Lucro mensal", value: projections.monthlyProfit, cls: projections.monthlyProfit >= 0 ? "text-emerald-600" : "text-destructive" },
            { label: "Caixa em 30d", value: projections.data[1].caixa, cls: projections.data[1].caixa >= 0 ? "text-emerald-600" : "text-destructive" },
            { label: "Caixa em 90d", value: projections.data[3].caixa, cls: projections.data[3].caixa >= 0 ? "text-emerald-600" : "text-destructive" },
            {
              label: "Dias de caixa",
              value: projections.diasDeCaixa,
              isMoney: false,
              cls: diasSemaphore.cls.split(" ")[0],
              tooltip: "Dias de caixa = quantos dias sua empresa consegue operar com o caixa atual se nenhuma nova receita entrar.",
              badge: diasSemaphore.label,
              badgeCls: diasSemaphore.cls,
            },
          ].map(s => (
            <TooltipProvider key={s.label} delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-muted/50 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      {s.label}
                      {(s as any).tooltip && <HelpCircle className="h-2.5 w-2.5" />}
                    </p>
                    <p className={`text-sm font-bold font-heading ${s.cls}`}>
                      {(s as any).isMoney === false
                        ? <PrivacyValue>{`${s.value} dias`}</PrivacyValue>
                        : <PrivacyValue>{fmt(s.value)}</PrivacyValue>
                      }
                    </p>
                    {(s as any).badge && (
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block ${(s as any).badgeCls}`}>
                        {(s as any).badge}
                      </span>
                    )}
                  </div>
                </TooltipTrigger>
                {(s as any).tooltip && (
                  <TooltipContent className="max-w-xs text-xs">{(s as any).tooltip}</TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          ))}
        </div>

        {/* Provisions breakdown */}
        {projections.provisionDetails.length > 0 && (
          <div className="bg-muted/30 rounded-xl p-3 space-y-1.5">
            <p className="text-[11px] font-medium text-muted-foreground inline-flex items-center gap-1.5"><BarChart3 className="h-3 w-3" />Provisões simuladas:</p>
            {projections.provisionDetails.map((p, i) => (
              <div key={i} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{p.name}</span>
                <span className="font-medium"><PrivacyValue>{fmt(p.value)}</PrivacyValue></span>
              </div>
            ))}
          </div>
        )}

        {/* Chart */}
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={projections.data}>
            <defs>
              <linearGradient id="cashGradSim" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} tickFormatter={v => isPrivate ? "••••" : `${(v / 1000).toFixed(0)}k`} />
            <RechartsTooltip formatter={(v: number) => isPrivate ? "••••" : fmt(v)} />
            <Area type="monotone" dataKey="caixa" name="Caixa projetado" stroke="hsl(var(--primary))" fill="url(#cashGradSim)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 text-center">
          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 flex-shrink-0" />Simulação não altera seus dados reais. Quanto mais dados você registrar, mais precisa fica a projeção.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function SliderControl({ label, value, onChange, help, min = -50, max = 100 }: {
  label: string; value: number; onChange: (v: number) => void; help: string; min?: number; max?: number;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium">{label}</span>
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
              <TooltipContent className="max-w-xs text-xs">{help}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <span className={`text-xs font-bold ${value > 0 ? "text-emerald-600" : value < 0 ? "text-destructive" : "text-muted-foreground"}`}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={5} className="w-full" />
    </div>
  );
}
