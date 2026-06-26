import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, TrendingUp, TrendingDown, AlertTriangle, Lightbulb, ArrowRight,
} from "lucide-react";
import { MoneyValue, PercentValue, usePrivacyFmt } from "@/components/PrivacyValue";
import { useAuth } from "@/hooks/useAuth";
import { useExpenseSkips } from "@/hooks/useExpenseSkips";
import { supabase } from "@/integrations/supabase/client";
import InfoTooltip, { INFO_CONFIGS } from "./InfoTooltip";
import { logWarn } from "@/lib/log";
import { computeMonthTotals } from "@/lib/computeMonthTotals";

const SCORE_BANDS = [
  { min: 0, max: 39, label: "Pressão crescente", color: "text-destructive", bg: "bg-destructive", ring: "hsl(var(--destructive))", emoji: "🔴" },
  { min: 40, max: 69, label: "Neutra", color: "text-warning", bg: "bg-warning", ring: "hsl(var(--warning))", emoji: "🟡" },
  { min: 70, max: 89, label: "Positiva", color: "text-success", bg: "bg-success", ring: "hsl(var(--success))", emoji: "🟢" },
  { min: 90, max: 100, label: "Excelente", color: "text-info", bg: "bg-info", ring: "hsl(var(--info))", emoji: "🔵" },
];

function getBand(score: number) {
  return SCORE_BANDS.find(b => score >= b.min && score <= b.max) || SCORE_BANDS[0];
}

interface FutureInsight {
  icon: React.ReactNode;
  text: string;
  type: "positive" | "warning" | "danger" | "info";
}

interface VisaoFuturaProps {
  periodStart: string;
  periodEnd: string;
  periodLabel?: string;
}

function monthsBetween(start: string, end: string): number {
  const [sy, sm] = start.split("-").map(Number);
  const [ey, em] = end.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

// Projeta recorrentes mês-a-mês dentro do período, evitando duplicata com linhas físicas
function projectRecurringIntoRange<T extends { id: string; data: string }>(
  physical: T[],
  recurring: T[],
  rangeStart: string,
  rangeEnd: string,
  targetMonths: string[],
  skippedKeys?: Set<string>  // key = `${template_id}:${YYYY-MM}`
): T[] {
  const physicalFiltered = physical.filter((p: any) => {
    // Item parcelado nunca pode ser skipado
    if (p.is_parcelada) return true;
    // Item não-recorrente: nunca tem skip
    if (!p.recorrente) return true;
    // Física recorrente: verifica skip pelo mês da data
    const mes = (p.data || "").substring(0, 7);
    const key = `${p.id}:${mes}`;
    return !skippedKeys?.has(key);
  });
  const existingByIdMes = new Set<string>();
  physicalFiltered.forEach(p => {
    const mes = (p.data || "").substring(0, 7);
    if (mes) existingByIdMes.add(`${p.id}:${mes}`);
  });
  const extras: T[] = [];
  recurring.forEach(r => {
    const startMes = (r.data || "").substring(0, 7);
    if (!startMes) return;
    const day = (r.data || "").substring(8, 10) || "01";
    targetMonths.forEach(tMes => {
      if (startMes > tMes) return;
      if (existingByIdMes.has(`${r.id}:${tMes}`)) return;
      if (skippedKeys?.has(`${r.id}:${tMes}`)) return;
      extras.push({ ...r, id: `virtual_${r.id}_${tMes}`, data: `${tMes}-${day}` } as T);
    });
  });
  return [...physicalFiltered, ...extras];
}

const VisaoFutura = ({ periodStart, periodEnd, periodLabel }: VisaoFuturaProps) => {
  const { user } = useAuth();
  const { isPrivate } = usePrivacyFmt();
  const { skips } = useExpenseSkips();
  const skippedKeys = useMemo(
    () => new Set(skips.map(s => `${s.template_id}:${s.month_ref}`)),
    [skips]
  );
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  const [receitaMedia, setReceitaMedia] = useState(0);
  const [despesaMedia, setDespesaMedia] = useState(0);
  const [economiaMedia, setEconomiaMedia] = useState(0);
  const [parcelMedia, setParcelMedia] = useState(0);
  const [despGrowth, setDespGrowth] = useState(0);
  const [numMonths, setNumMonths] = useState(3);

  const compute = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const nMonths = monthsBetween(periodStart, periodEnd);
    setNumMonths(nMonths);

    // Build per-month ranges within the period
    const [sy, sm] = periodStart.split("-").map(Number);
    const months: { start: string; end: string }[] = [];
    for (let i = 0; i < nMonths; i++) {
      const d = new Date(sy, sm - 1 + i, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      months.push({
        start: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`,
        end: `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`,
      });
    }

    // Fetch totals for the whole period in one query each
    const [recRes, despRes, econRes, recRecRes, despRecRes, instRes] = await Promise.all([
      supabase.from("receitas").select("id,valor,data,recorrente").eq("user_id", user.id).gte("data", periodStart).lte("data", periodEnd),
      supabase.from("despesas").select("id,valor,data,recorrente,is_parcelada,tipo,tipo_parcelamento,status").eq("user_id", user.id).gte("data", periodStart).lte("data", periodEnd).eq("is_parcelada", false),
      supabase.from("economias").select("valor").eq("user_id", user.id).gte("data", periodStart).lte("data", periodEnd),
      supabase.from("receitas").select("id,valor,data,recorrente").eq("user_id", user.id).eq("recorrente", true),
      supabase.from("despesas").select("id,valor,data,recorrente,is_parcelada,tipo,tipo_parcelamento,status").eq("user_id", user.id).eq("recorrente", true).eq("is_parcelada", false),
      supabase.from("installment_instances" as any).select("amount,due_date,despesas(tipo_parcelamento)").eq("user_id", user.id).gte("due_date", periodStart).lte("due_date", periodEnd),
    ]);

    // Log data fetch results for debugging zero-value issues
    if (recRes.error) logWarn("[VisaoFutura] receitas fetch error:", recRes.error.message);
    if (despRes.error) logWarn("[VisaoFutura] despesas fetch error:", despRes.error.message);
    if (econRes.error) logWarn("[VisaoFutura] economias fetch error:", econRes.error.message);

    // Lista de meses YYYY-MM dentro do período
    const targetMonths: string[] = months.map(m => m.start.substring(0, 7));

    const recProjected = projectRecurringIntoRange(
      (recRes.data || []) as any[],
      (recRecRes.data || []) as any[],
      periodStart, periodEnd, targetMonths
    );
    const despProjected = projectRecurringIntoRange(
      (despRes.data || []) as any[],
      (despRecRes.data || []) as any[],
      periodStart, periodEnd, targetMonths,
      skippedKeys
    );

    const totals = computeMonthTotals({
      despesas: despProjected as any,
      instances: ((instRes as any)?.data || []) as any,
      receitas: recProjected as any,
      economias: (econRes.data || []) as any,
    });
    const totalR = totals.totalReceitas;
    const totalD = totals.totalDespesas;
    const totalE = totals.totalEconomias;

    const avgR = totalR / nMonths;
    const avgD = totalD / nMonths;
    const avgE = totalE / nMonths;

    setReceitaMedia(avgR);
    setDespesaMedia(avgD);
    setEconomiaMedia(avgE);

    // Parcel avg
    const parcelTotal = totals.totalParcelas;
    setParcelMedia(parcelTotal / nMonths);

    // Growth: compare first half vs second half of the period
    if (nMonths >= 2) {
      const midDate = months[Math.floor(nMonths / 2)].start;
      const firstHalf = despProjected.filter((x: any) => (x.data || "") < midDate).reduce((s: number, x: any) => s + Number(x.valor), 0);
      const secondHalf = totalD - firstHalf;
      const baseTooSmall = firstHalf < avgD * 0.1 * Math.floor(nMonths / 2);
      if (baseTooSmall || firstHalf <= 0) {
        setDespGrowth(0);
      } else {
        const raw = ((secondHalf - firstHalf) / firstHalf) * 100;
        setDespGrowth(Math.min(raw, 200));
      }
    } else {
      setDespGrowth(0);
    }

    setLoading(false);
  }, [user, periodStart, periodEnd, skippedKeys]);

  useEffect(() => { compute(); }, [compute]);

  if (loading) return null;

  const saldoMedio = receitaMedia - despesaMedia;
  const economia5pct = receitaMedia * 0.05;
  const projectionMonths = Math.max(numMonths, 3);

  // Score calculation
  const margem = receitaMedia > 0 ? (receitaMedia - despesaMedia) / receitaMedia : 0;
  const poupanca = receitaMedia > 0 ? economiaMedia / receitaMedia : 0;
  const score = Math.max(0, Math.min(100, Math.round(
    Math.min(margem * 40, 40) + Math.min(poupanca * 40, 40) + (despesaMedia < receitaMedia ? 20 : 0)
  )));
  const band = getBand(score);

  // Gauge
  const circumference = 2 * Math.PI * 40;
  const dashArray = `${(score / 100) * circumference} ${circumference}`;

  // Period label for display
  const baseLabel = periodLabel || `últimos ${numMonths} meses`;

  // Insights
  const insights: FutureInsight[] = [];

  if (saldoMedio > 0) {
    insights.push({
      icon: <TrendingUp className="h-4 w-4 text-success" />,
      text: `Mantendo o ritmo atual, seu saldo acumulado projetado em ${projectionMonths} meses é de R$ ${(saldoMedio * projectionMonths).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`,
      type: "positive",
    });
  } else {
    insights.push({
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      text: "Seu saldo médio está negativo. Se nada mudar, o aperto financeiro deve se intensificar nos próximos meses.",
      type: "danger",
    });
  }

  if (despGrowth > 5 && despGrowth <= 200) {
    insights.push({
      icon: <AlertTriangle className="h-4 w-4 text-warning" />,
      text: `Suas despesas cresceram ${despGrowth.toFixed(0)}% no período analisado. Se a tendência continuar, sua folga mensal pode cair significativamente.`,
      type: "warning",
    });
  } else if (despGrowth === 0 && despesaMedia > receitaMedia * 0.7) {
    insights.push({
      icon: <AlertTriangle className="h-4 w-4 text-warning" />,
      text: "Suas despesas aumentaram significativamente no período. Revise seus gastos recorrentes.",
      type: "warning",
    });
  }

  if (parcelMedia > 0 && receitaMedia > 0) {
    const parcelPct = (parcelMedia / receitaMedia) * 100;
    if (parcelPct > 15) {
      insights.push({
        icon: <AlertTriangle className="h-4 w-4 text-warning" />,
        text: `Parcelamentos consomem ${parcelPct.toFixed(0)}% da sua renda média. Considere evitar novas compras parceladas.`,
        type: "warning",
      });
    }
  }

  if (economia5pct > 0) {
    insights.push({
      icon: <Lightbulb className="h-4 w-4 text-info" />,
      text: `Se reduzir 5% dos gastos variáveis, você pode liberar R$ ${economia5pct.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} por mês para investir.`,
      type: "info",
    });
  }

  if (economiaMedia > 0 && saldoMedio > 0) {
    insights.push({
      icon: <TrendingUp className="h-4 w-4 text-success" />,
      text: `Seu potencial de acumulação é real. Mantendo os aportes atuais por 12 meses, você pode acumular R$ ${(economiaMedia * 12).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}.`,
      type: "positive",
    });
  }

  const bgMap = { positive: "bg-success/5 border-success/20", warning: "bg-warning/5 border-warning/20", danger: "bg-destructive/5 border-destructive/20", info: "bg-info/5 border-info/20" };

  return (
    <Card className="shadow-soft border-border/50 border-l-4 border-l-primary/60 rounded-2xl">
      <CardContent className="p-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 min-w-0">
            <Target className="h-5 w-5 text-primary flex-shrink-0" />
            <h3 className="text-lg font-heading font-bold whitespace-nowrap">Visão Futura</h3>
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-heading font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0">Projeção</span>
          </div>
          <div className="flex-shrink-0">
            <InfoTooltip config={INFO_CONFIGS.visao_futura} />
          </div>
          <InfoTooltip config={INFO_CONFIGS.visao_futura} className="hidden" externalOpen={showInfo} onExternalClose={() => setShowInfo(false)} />
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[auto_1fr] lg:grid-cols-1 lg:gap-4">
          {/* Gauge */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-24 h-24 cursor-pointer" onClick={() => setShowInfo(true)} title="Ver explicação da Visão Futura">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke={band.ring} strokeWidth="8"
                  strokeDasharray={dashArray} strokeLinecap="round"
                  className="transition-all duration-1000 ease-out" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-heading font-extrabold">{isPrivate ? "••" : score}</span>
              </div>
            </div>
            <span className={`text-[10px] font-heading font-bold ${band.color}`}>{band.label}</span>
            <div className="flex items-center gap-1 text-[10px]">
              {saldoMedio >= 0
                ? <><TrendingUp className="h-3 w-3 text-success" /><span className="text-success font-medium">Tendência positiva</span></>
                : <><TrendingDown className="h-3 w-3 text-destructive" /><span className="text-destructive font-medium">Pressão crescente</span></>
              }
            </div>
          </div>

          {/* KPIs */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 lg:gap-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[11px] text-muted-foreground font-body">Receita média ({baseLabel})</p>
                <p className="text-lg font-heading font-bold text-success"><MoneyValue value={receitaMedia} /></p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[11px] text-muted-foreground font-body">Despesa média ({baseLabel}) · inclui dívida</p>
                <p className="text-lg font-heading font-bold text-destructive"><MoneyValue value={despesaMedia} /></p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[11px] text-muted-foreground font-body">Saldo médio</p>
                <p className={`text-lg font-heading font-bold ${saldoMedio >= 0 ? "text-success" : "text-destructive"}`}>
                  <MoneyValue value={saldoMedio} />
                </p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-[11px] text-muted-foreground font-body">Se economizar +5%</p>
                <p className="text-lg font-heading font-bold text-info">+<MoneyValue value={economia5pct} />/mês</p>
              </div>
            </div>

            {/* Insights — no espaço estreito (lg na meia-coluna) mostra só o 1º, condensado */}
            <div className="space-y-2">
              {insights.slice(0, 4).map((ins, i) => (
                <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border ${bgMap[ins.type]} ${i > 0 ? "lg:hidden" : ""}`}>
                  {ins.icon}
                  <p className="text-sm font-body leading-relaxed lg:line-clamp-2">{ins.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground/60 font-body mt-4 lg:hidden">
          Horizonte de projeção: <span className="font-semibold text-muted-foreground/80">{projectionMonths} meses</span> · Base de cálculo: média de {numMonths === 1 ? "1 mês" : `${numMonths} meses`} ({baseLabel}) de receita, despesas e saldo. Resultados reais podem variar.
        </p>
      </CardContent>
    </Card>
  );
};

export default VisaoFutura;
