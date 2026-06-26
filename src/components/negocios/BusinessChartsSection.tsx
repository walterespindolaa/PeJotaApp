import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, AlertTriangle, TrendingUp, TrendingDown, BarChart3, Target, ClipboardList, Lightbulb, Layers } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import PrivacyValue from "@/components/PrivacyValue";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend,
  LineChart, Line, ReferenceLine, ComposedChart
} from "recharts";
import type { BusinessTransaction, BusinessCategory, AllocationRule } from "@/hooks/useCompanies";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--destructive))",
  "hsl(142, 71%, 45%)",
  "hsl(38, 92%, 50%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
  "hsl(346, 87%, 57%)",
  "hsl(20, 96%, 48%)",
];

interface Props {
  transactions: BusinessTransaction[];
  categories: BusinessCategory[];
  allocationRules: AllocationRule[];
  revenue: number;
  expenses: number;
}

export default function BusinessChartsSection({ transactions, categories, allocationRules, revenue, expenses }: Props) {
  const { fmt } = usePrivacyFmt();
  const profit = revenue - expenses;

  // ── 1) MAIN LINE CHART: Monthly Revenue x Expenses x Profit ──
  const monthlyEvolution = useMemo(() => {
    const map = new Map<string, { receita: number; despesas: number }>();
    transactions.forEach(t => {
      const key = t.date.substring(0, 7);
      const cur = map.get(key) || { receita: 0, despesas: 0 };
      if (t.direction === "in") cur.receita += Number(t.amount);
      else cur.despesas += Number(t.amount);
      map.set(key, cur);
    });
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => ({
        mes: format(parseISO(key + "-01"), "MMM/yy", { locale: ptBR }),
        receita: v.receita,
        despesas: v.despesas,
        lucro: v.receita - v.despesas,
      }));
  }, [transactions]);

  // ── 2) TOP 5 CATEGORIES ──
  const top5Expenses = useMemo(() => {
    const map = new Map<string, { value: number; isMissing: boolean }>();
    transactions.filter(t => t.direction === "out").forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const label = cat ? cat.name : "Sem categoria";
      const cur = map.get(label) || { value: 0, isMissing: !cat };
      cur.value += Number(t.amount);
      map.set(label, cur);
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v.value, 0);
    return Array.from(map.entries())
      .map(([name, { value, isMissing }]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0, isMissing }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [transactions, categories]);

  const top5Revenue = useMemo(() => {
    const map = new Map<string, { value: number; isMissing: boolean }>();
    transactions.filter(t => t.direction === "in").forEach(t => {
      const cat = categories.find(c => c.id === t.category_id);
      const label = cat ? cat.name : "Sem categoria";
      const cur = map.get(label) || { value: 0, isMissing: !cat };
      cur.value += Number(t.amount);
      map.set(label, cur);
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v.value, 0);
    return Array.from(map.entries())
      .map(([name, { value, isMissing }]) => ({ name, value, pct: total > 0 ? Math.round((value / total) * 100) : 0, isMissing }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [transactions, categories]);

  // ── 3) WATERFALL ──
  const waterfallData = useMemo(() => {
    if (revenue <= 0) return [];
    const steps: { name: string; value: number }[] = [];
    let remaining = revenue;

    // Try allocation rules first — deduplicate category_ids across rules
    const activeRules = allocationRules.filter(r => r.active && (r.category_ids || []).length > 0);
    const globalUsedCatIds = new Set<string>();

    for (const rule of activeRules) {
      // Only count categories not already claimed by a previous rule
      const catIds = (rule.category_ids || []).filter(id => !globalUsedCatIds.has(id));
      const actual = transactions
        .filter(t => t.direction === "out" && catIds.includes(t.category_id || ""))
        .reduce((s, t) => s + Number(t.amount), 0);
      if (actual > 0) {
        steps.push({ name: rule.name, value: -actual });
        remaining -= actual;
      }
      // Mark ALL original category_ids as used to prevent double-counting
      (rule.category_ids || []).forEach(id => globalUsedCatIds.add(id));
    }

    // Remaining expenses not covered by rules
    const otherExpenses = transactions
      .filter(t => t.direction === "out" && !globalUsedCatIds.has(t.category_id || ""))
      .reduce((s, t) => s + Number(t.amount), 0);

    if (otherExpenses > 0 && activeRules.length > 0) {
      steps.push({ name: "Outros custos", value: -otherExpenses });
      remaining -= otherExpenses;
    }

    // If no rules with categories, fall back to top categories
    if (activeRules.length === 0) {
      const catMap = new Map<string, number>();
      transactions.filter(t => t.direction === "out").forEach(t => {
        const cat = categories.find(c => c.id === t.category_id);
        const label = cat ? cat.name : "Outros";
        catMap.set(label, (catMap.get(label) || 0) + Number(t.amount));
      });
      const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
      let coveredExpenses = 0;
      for (const [name, val] of sorted) {
        steps.push({ name, value: -val });
        remaining -= val;
        coveredExpenses += val;
      }
      const rest = expenses - coveredExpenses;
      if (rest > 0) {
        steps.push({ name: "Outros", value: -rest });
        remaining -= rest;
      }
    }

    // Build waterfall accumulation
    const result: { name: string; base: number; value: number; total: number; isPositive: boolean }[] = [];
    result.push({ name: "Receita", base: 0, value: revenue, total: revenue, isPositive: true });
    let running = revenue;
    for (const step of steps) {
      const newRunning = running + step.value;
      result.push({
        name: step.name,
        base: Math.min(running, newRunning),
        value: Math.abs(step.value),
        total: newRunning,
        isPositive: false,
      });
      running = newRunning;
    }
    result.push({ name: "Lucro", base: 0, value: Math.max(0, running), total: running, isPositive: running >= 0 });

    return result;
  }, [revenue, expenses, transactions, categories, allocationRules]);

  // ── 4) PLANNED VS REAL (using explicit category_ids) ──
  const plannedVsActual = useMemo(() => {
    if (revenue <= 0 || allocationRules.length === 0) return [];
    const result: { name: string; planejado: number; real: number; alert: boolean }[] = [];

    for (const rule of allocationRules.filter(r => r.active)) {
      let base = revenue;
      if (rule.base === "gross_profit" || rule.base === "net_profit") base = profit;
      const planned = Math.max(0, base * (rule.percentage / 100));

      const catIds = rule.category_ids || [];
      const actual = catIds.length > 0
        ? transactions.filter(t => t.direction === "out" && catIds.includes(t.category_id || ""))
            .reduce((s, t) => s + Number(t.amount), 0)
        : 0;

      result.push({
        name: rule.name.length > 18 ? rule.name.substring(0, 18) + "…" : rule.name,
        planejado: planned,
        real: actual,
        alert: catIds.length > 0 && actual > planned * 1.1,
      });
    }
    return result;
  }, [revenue, profit, allocationRules, transactions]);

  // ── 5) REVENUE USAGE DONUT ──
  const revenueUsage = useMemo(() => {
    if (revenue <= 0) return [];
    const items: { name: string; value: number; pct: number }[] = [];
    allocationRules.filter(r => r.active).forEach(r => {
      let base = revenue;
      if (r.base === "gross_profit" || r.base === "net_profit") base = profit;
      const val = Math.max(0, base * (r.percentage / 100));
      items.push({ name: r.name, value: val, pct: Math.round((val / revenue) * 100) });
    });
    const allocated = items.reduce((s, i) => s + i.value, 0);
    const remaining = revenue - allocated;
    if (remaining > 0) {
      items.push({ name: "Restante", value: remaining, pct: Math.round((remaining / revenue) * 100) });
    }
    return items;
  }, [revenue, profit, allocationRules]);

  const hasData = transactions.length > 0;

  return (
    <div className="space-y-4">
      {/* ── MAIN CHART: Monthly Evolution (always visible) ── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-heading flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Receita vs Despesas vs Lucro</CardTitle>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Evolução mensal do faturamento, custos e lucro. Mostra se o negócio está crescendo.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <p className="text-[10px] text-muted-foreground">Evolução do negócio ao longo do tempo.</p>
        </CardHeader>
        <CardContent>
          {monthlyEvolution.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="receita" name="Receita" stroke="hsl(142, 71%, 45%)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="despesas" name="Despesas" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(var(--primary))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 2 }} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5"><BarChart3 className="h-4 w-4 flex-shrink-0" />Registre mais lançamentos para ver a evolução do negócio.</p>
              <p className="text-[10px] text-muted-foreground mt-1">Entradas e saídas aparecerão aqui como linhas mensais.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── TOP 5 CATEGORIES ── */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {top5Expenses.length > 0 && (
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-heading flex items-center gap-1.5"><TrendingDown className="h-4 w-4" />Top 5 Despesas</CardTitle>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Ranking das 5 categorias que mais consomem dinheiro. Foque nelas para otimizar custos.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {top5Expenses.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs truncate flex items-center gap-1">
                          {item.name}
                          {item.isMissing && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger><HelpCircle className="h-3 w-3 text-amber-500" /></TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  Você tem lançamentos sem categoria. Categorizar melhora seus relatórios.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground ml-2 flex-shrink-0">
                          <PrivacyValue>{fmt(item.value)}</PrivacyValue> ({item.pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.pct}%`,
                            backgroundColor: PIE_COLORS[i % PIE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {top5Revenue.length > 1 && (
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-heading flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Top 5 Receitas</CardTitle>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        As fontes de receita mais relevantes. Ajuda a entender de onde vem o dinheiro.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {top5Revenue.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-4 text-right">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-0.5">
                        <span className="text-xs truncate flex items-center gap-1">
                          {item.name}
                          {item.isMissing && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger><HelpCircle className="h-3 w-3 text-amber-500" /></TooltipTrigger>
                                <TooltipContent className="max-w-xs text-xs">
                                  Você tem lançamentos sem categoria. Categorizar melhora seus relatórios.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground ml-2 flex-shrink-0">
                          <PrivacyValue>{fmt(item.value)}</PrivacyValue> ({item.pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${item.pct}%`,
                            backgroundColor: PIE_COLORS[(i + 2) % PIE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── WATERFALL: Revenue Usage Breakdown ── */}
      {waterfallData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-heading flex items-center gap-1.5"><Layers className="h-4 w-4" />Cascata do Faturamento</CardTitle>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Mostra passo a passo como seu faturamento é consumido até chegar no lucro. Cada barra é uma dedução.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-[10px] text-muted-foreground">Receita → Custos → Lucro</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={waterfallData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip
                  formatter={(v: number, name: string) => {
                    if (name === "base") return [null, null];
                    return [fmt(v), "Valor"];
                  }}
                  labelFormatter={(label) => label}
                />
                <Bar dataKey="base" stackId="waterfall" fill="transparent" />
                <Bar
                  dataKey="value"
                  stackId="waterfall"
                  radius={[4, 4, 0, 0]}
                >
                  {waterfallData.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.name === "Receita"
                          ? "hsl(142, 71%, 45%)"
                          : entry.name === "Lucro"
                          ? entry.total >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"
                          : "hsl(var(--destructive) / 0.7)"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── REVENUE USAGE DONUT ── */}
      {revenueUsage.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="min-w-0">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-heading flex items-center gap-1.5"><Target className="h-4 w-4" />Uso do Faturamento</CardTitle>
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Distribuição planejada do faturamento entre provisões e lucro.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={revenueUsage}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, pct }) => `${name.length > 12 ? name.substring(0, 12) + "…" : name} ${pct}%`}
                    labelLine={false}
                    style={{ fontSize: 9 }}
                  >
                    {revenueUsage.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v: number, name: string, props: any) => [
                    `${fmt(v)} (${props.payload.pct}%)`, name
                  ]} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* ── PLANNED VS REAL ── */}
          {plannedVsActual.length > 0 && (
            <Card className="min-w-0">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-heading flex items-center gap-1.5"><ClipboardList className="h-4 w-4" />Planejado vs Real</CardTitle>
                  <TooltipProvider delayDuration={200}>
                    <Tooltip>
                      <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        Compara o valor planejado nas regras com o gasto real. Vincule categorias às regras para dados precisos.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                {plannedVsActual.some(p => p.alert) && (
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] text-amber-600">Algumas categorias ultrapassaram o planejado</span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={plannedVsActual} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                    <RechartsTooltip formatter={(v: number) => fmt(v)} />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="planejado" name="Planejado" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={12} />
                    <Bar dataKey="real" name="Real" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} barSize={12} />
                  </BarChart>
                </ResponsiveContainer>
                {plannedVsActual.some(p => p.real === 0) && (
                  <p className="text-[10px] text-muted-foreground text-center mt-2 italic inline-flex items-center gap-1.5">
                    <Lightbulb className="h-3 w-3 flex-shrink-0" />Vincule categorias às regras de provisão para ver dados "Real" precisos.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── PROFIT EVOLUTION ── */}
      {monthlyEvolution.length >= 2 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-heading flex items-center gap-1.5"><TrendingUp className="h-4 w-4" />Evolução do Lucro</CardTitle>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger><HelpCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Tendência de alta indica crescimento saudável do negócio.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={monthlyEvolution}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip formatter={(v: number) => fmt(v)} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                <Line type="monotone" dataKey="lucro" name="Lucro" stroke="hsl(142, 71%, 45%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(142, 71%, 45%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
