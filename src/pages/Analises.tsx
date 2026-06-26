import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useOrganiza } from "@/hooks/useOrganiza";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getPeriodConfig, PERIOD_OPTIONS, type PeriodoAnalise } from "@/lib/periodConfig";
import { lastDayOfMonth } from "@/lib/dateHelpers";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceArea,
  BarChart, Bar, LineChart, Line,
} from "recharts";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import {
  PieChart as PieChartIcon, TrendingUp, TrendingDown, AlertTriangle,
  Lightbulb, BarChart3, ShoppingCart, Activity, ShieldCheck,
  ArrowUpRight, ArrowDownRight, Filter,
  Wallet, PiggyBank, Percent, DollarSign, FileText,
  Info, CheckCircle2, AlertCircle, Compass, Layers, Award, Pin, Target, Repeat, Zap, CalendarClock,
  GitCompare, CalendarRange,
} from "lucide-react";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import type { VisaoPessoa } from "@/hooks/useOrganiza";
import { logError } from "@/lib/log";

// fmt is provided by usePrivacyFmt() which uses i18n context

const now = new Date();
const currentMesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(now.getFullYear(), i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
});

type Insight = { type: "danger" | "warning" | "tip"; icon: React.ElementType; message: string };

const CompromissoTooltip = ({ active, payload, label, historico }: any) => {
  const { isPrivate, fmt } = usePrivacyFmt();
  if (!active || !payload?.length) return null;
  const val = payload[0]?.payload?.compromisso ?? 0;
  const h = historico?.find((x: any) => x.mes === label);
  const color = val <= 70 ? "text-success" : val <= 90 ? "text-warning" : "text-destructive";
  const status = val <= 70 ? "Saudável" : val <= 90 ? "Atenção" : "Crítico";
  return (
    <div className="rounded-lg border bg-card p-3 shadow-elevated text-xs space-y-1.5 min-w-[180px]">
      <p className="font-heading font-bold text-foreground">{label}</p>
      <p className={`${color} font-heading font-bold text-sm`}>
        {isPrivate ? "••••" : `${val.toFixed(1)}%`} — {status}
      </p>
      {h && (
        <div className="pt-1.5 border-t border-border/50 space-y-0.5 text-muted-foreground">
          <div className="flex justify-between gap-3"><span>Receita</span><span className="text-foreground">{fmt(h.receitas)}</span></div>
          <div className="flex justify-between gap-3"><span>Despesas</span><span className="text-foreground">{fmt(h.despesas)}</span></div>
          {h.parcelas > 0 && <div className="flex justify-between gap-3"><span>Parcelas</span><span className="text-foreground">{fmt(h.parcelas)}</span></div>}
        </div>
      )}
    </div>
  );
};

interface KpiCardProps {
  icon: React.ElementType;
  iconColor: string;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tooltip: string;
}

const KpiCard = ({ icon: Icon, iconColor, label, value, sub, tooltip }: KpiCardProps) => (
  <TooltipProvider>
    <UITooltip>
      <TooltipTrigger asChild>
        <Card className="shadow-soft cursor-help">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`h-4 w-4 ${iconColor}`} />
              <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
              <Info className="h-3 w-3 text-muted-foreground/40 ml-auto" />
            </div>
            <div className="text-lg font-heading font-bold">{value}</div>
            {sub && <div className="mt-1">{sub}</div>}
          </CardContent>
        </Card>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs max-w-[200px]">{tooltip}</p>
      </TooltipContent>
    </UITooltip>
  </TooltipProvider>
);

const SectionTitle = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-primary/60" />
    <h2 className="text-[10px] uppercase tracking-[0.15em] font-heading font-bold text-muted-foreground">{label}</h2>
    <div className="flex-1 h-px bg-border/40" />
  </div>
);

const Analises = () => {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const [mesAno, setMesAno] = useState(currentMesAno);
  const [periodo, setPeriodo] = useState<PeriodoAnalise>("mes");
  const { view: householdView } = useHouseholdView();
  const visaoPessoa: VisaoPessoa = householdView as VisaoPessoa;
  const org = useOrganiza(mesAno, visaoPessoa);

  const [year, month] = mesAno.split("-").map(Number);
  const prev1 = `${month <= 1 ? year - 1 : year}-${String(month <= 1 ? 12 : month - 1).padStart(2, "0")}`;
  const prev2 = `${month <= 2 ? year - 1 : year}-${String(month <= 2 ? 12 + month - 2 : month - 2).padStart(2, "0")}`;
  const orgP1 = useOrganiza(prev1, visaoPessoa);
  const orgP2 = useOrganiza(prev2, visaoPessoa);

  const prev3 = useMemo(() => {
    const m = month - 3; const y = m <= 0 ? year - 1 : year;
    return `${y}-${String(m <= 0 ? 12 + m : m).padStart(2, "0")}`;
  }, [year, month]);
  const prev4 = useMemo(() => {
    const m = month - 4; const y = m <= 0 ? year - 1 : year;
    return `${y}-${String(m <= 0 ? 12 + m : m).padStart(2, "0")}`;
  }, [year, month]);
  const prev5 = useMemo(() => {
    const m = month - 5; const y = m <= 0 ? year - 1 : year;
    return `${y}-${String(m <= 0 ? 12 + m : m).padStart(2, "0")}`;
  }, [year, month]);
  const orgP3 = useOrganiza(prev3, visaoPessoa);
  const orgP4 = useOrganiza(prev4, visaoPessoa);
  const orgP5 = useOrganiza(prev5, visaoPessoa);

  // ═══ Period-aware aggregate data ═══
  const periodCfg = useMemo(() => getPeriodConfig(periodo, mesAno), [periodo, mesAno]);

  const [periodReceitas, setPeriodReceitas] = useState(0);
  const [periodDespesas, setPeriodDespesas] = useState(0);
  const [periodEconomias, setPeriodEconomias] = useState(0);
  const [periodDespesasList, setPeriodDespesasList] = useState<{ categoria: string; valor: number }[]>([]);

  useEffect(() => {
    if (!user) return;
    if (periodCfg.isMonthly) {
      setPeriodReceitas(org.totalGanhos);
      setPeriodDespesas(org.totalDespesas);
      setPeriodEconomias(org.totalEconomias);
      setPeriodDespesasList(org.despesas.map(d => ({ categoria: d.categoria || "Outros", valor: Number(d.valor) })));
      return;
    }
    const fetchPeriod = async () => {
      try {
        let recQ = supabase.from("receitas").select("valor").eq("user_id", user.id).lte("data", periodCfg.end);
        let despQ = supabase.from("despesas").select("valor,categoria").eq("user_id", user.id).lte("data", periodCfg.end);
        let ecoQ = supabase.from("economias").select("valor").eq("user_id", user.id).lte("data", periodCfg.end);
        if (periodCfg.start) {
          recQ = recQ.gte("data", periodCfg.start);
          despQ = despQ.gte("data", periodCfg.start);
          ecoQ = ecoQ.gte("data", periodCfg.start);
        }
        const [r, d, e] = await Promise.all([recQ, despQ, ecoQ]);
        if (r.error) logError("[Analises] fetchPeriod receitas error:", r.error);
        if (d.error) logError("[Analises] fetchPeriod despesas error:", d.error);
        if (e.error) logError("[Analises] fetchPeriod economias error:", e.error);
        setPeriodReceitas((r.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0));
        const despList = (d.data || []).map((x: any) => ({ categoria: x.categoria || "Outros", valor: Number(x.valor) }));
        setPeriodDespesasList(despList);
        setPeriodDespesas(despList.reduce((s: number, x: any) => s + x.valor, 0));
        setPeriodEconomias((e.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0));
      } catch (err) {
        logError("[Analises] fetchPeriod exception:", err);
      }
    };
    fetchPeriod();
  }, [user, periodCfg, org.totalGanhos, org.totalDespesas, org.totalEconomias, org.despesas]);

  const pReceitas = periodReceitas;
  const pDespesas = periodDespesas;
  const pSaldo = pReceitas - pDespesas;
  const pTaxaPoupanca = pReceitas > 0 ? (periodEconomias / pReceitas) * 100 : 0;
  const pGrauCompromisso = pReceitas > 0 ? (pDespesas / pReceitas) * 100 : 0;

  const categoriaMaisPesada = useMemo(() => {
    const map: Record<string, number> = {};
    periodDespesasList.forEach(d => {
      map[d.categoria] = (map[d.categoria] || 0) + d.valor;
    });
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    return sorted[0] ? { name: sorted[0][0], valor: sorted[0][1], pct: pReceitas > 0 ? (sorted[0][1] / pReceitas) * 100 : 0 } : null;
  }, [periodDespesasList, pReceitas]);

  const mediaCategoria3m = useMemo(() => {
    if (!categoriaMaisPesada) return 0;
    const catName = categoriaMaisPesada.name;
    const getVal = (desp: any[]) => desp.filter(d => (d.categoria || "Outros") === catName).reduce((s: number, d: any) => s + Number(d.valor), 0);
    const v1 = getVal(orgP1.despesas);
    const v2 = getVal(orgP2.despesas);
    const v3 = categoriaMaisPesada.valor;
    const count = [v1, v2, v3].filter(v => v > 0).length;
    return count > 0 ? (v1 + v2 + v3) / count : 0;
  }, [categoriaMaisPesada, orgP1.despesas, orgP2.despesas]);

  const tendencia = useMemo(() => {
    if (org.saldoPrevisto > orgP1.saldoPrevisto && orgP1.saldoPrevisto > orgP2.saldoPrevisto) return "improving";
    if (org.saldoPrevisto < orgP1.saldoPrevisto && orgP1.saldoPrevisto < orgP2.saldoPrevisto) return "declining";
    return "stable";
  }, [org.saldoPrevisto, orgP1.saldoPrevisto, orgP2.saldoPrevisto]);

  const volatilidade = useMemo(() => {
    const vals = [org.totalDespesas, orgP1.totalDespesas, orgP2.totalDespesas].filter(v => v > 0);
    if (vals.length < 2) return 0;
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const variance = vals.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / vals.length;
    return avg > 0 ? (Math.sqrt(variance) / avg) * 100 : 0;
  }, [org.totalDespesas, orgP1.totalDespesas, orgP2.totalDespesas]);

  const compromisoHist = useMemo(() => {
    const currentMonthIndex = month - 1;
    return org.historico.map((h, i) => ({
      mes: h.mes,
      compromisso: h.receitas > 0 ? ((h.despesas + h.parcelas + h.economias) / h.receitas) * 100 : 0,
      isCurrent: i === currentMonthIndex,
    }));
  }, [org.historico, month]);

  const currentMonthIdx = month - 1;

  const compromisoHistSplit = useMemo(() => {
    return compromisoHist.map((h, i) => ({
      ...h,
      passado: i <= currentMonthIdx ? h.compromisso : null,
      futuro: i >= currentMonthIdx ? h.compromisso : null,
    }));
  }, [compromisoHist, currentMonthIdx]);

  const CAP = 120;
  const hasOutlier = compromisoHist.some(h => h.compromisso > CAP);
  const capMax = hasOutlier ? CAP : Math.max(100, Math.ceil(Math.max(...compromisoHist.map(c => c.compromisso), 100) / 10) * 10);
  const outliers = compromisoHist
    .map((h, i) => ({ ...h, idx: i }))
    .filter(h => h.compromisso > CAP);

  const despesasPorCategoria = useMemo(() => {
    const map: Record<string, number> = {};
    periodDespesasList.forEach(d => {
      map[d.categoria] = (map[d.categoria] || 0) + d.valor;
    });
    return Object.entries(map).map(([name, valor]) => ({
      name,
      valor,
      pctReceita: pReceitas > 0 ? (valor / pReceitas) * 100 : 0,
    })).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [periodDespesasList, pReceitas]);

  const trendData = useMemo(() => {
    const orgs = [
      { org: orgP5, mes: prev5 },
      { org: orgP4, mes: prev4 },
      { org: orgP3, mes: prev3 },
      { org: orgP2, mes: prev2 },
      { org: orgP1, mes: prev1 },
      { org: org, mes: mesAno },
    ];
    return orgs.map(({ org: o, mes }) => {
      const [y, m] = mes.split("-").map(Number);
      const label = new Date(y, m - 1).toLocaleDateString("pt-BR", { month: "short" });
      return {
        mes: label.charAt(0).toUpperCase() + label.slice(1),
        Receita: o.totalGanhos,
        Despesas: o.totalDespesas,
        Economias: o.totalEconomias,
      };
    });
  }, [org, orgP1, orgP2, orgP3, orgP4, orgP5, mesAno, prev1, prev2, prev3, prev4, prev5]);

  const varReceita = orgP1.totalGanhos > 0 ? ((org.totalGanhos - orgP1.totalGanhos) / orgP1.totalGanhos) * 100 : 0;
  const varDespesa = orgP1.totalDespesas > 0 ? ((org.totalDespesas - orgP1.totalDespesas) / orgP1.totalDespesas) * 100 : 0;
  const varEconomia = orgP1.totalEconomias > 0 ? ((org.totalEconomias - orgP1.totalEconomias) / orgP1.totalEconomias) * 100 : 0;

  const healthLabel = pGrauCompromisso <= 50 ? "Excelente" : pGrauCompromisso <= 70 ? "Saudável" : "Alerta";
  const healthColor = pGrauCompromisso <= 50 ? "text-success" : pGrauCompromisso <= 70 ? "text-info" : "text-destructive";
  const healthBg = pGrauCompromisso <= 50 ? "bg-success/10 border-success/20" : pGrauCompromisso <= 70 ? "bg-info/10 border-info/20" : "bg-destructive/10 border-destructive/20";
  const HealthIcon = pGrauCompromisso <= 50 ? CheckCircle2 : pGrauCompromisso <= 70 ? ShieldCheck : AlertCircle;
  const healthIconColor = pGrauCompromisso <= 50 ? "text-success" : pGrauCompromisso <= 70 ? "text-info" : "text-destructive";

  // ═══ Extended data for contextual intelligence ═══
  const [parcelamentosAtivos, setParcelamentosAtivos] = useState(0);
  const [parcelamentoValorMes, setParcelamentoValorMes] = useState(0);
  const [despesasFixas, setDespesasFixas] = useState(0);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("installment_instances").select("amount,status,competencia").eq("user_id", user.id).eq("competencia", mesAno),
      supabase.from("despesas").select("valor,tipo,recorrente").eq("user_id", user.id).gte("data", `${mesAno}-01`).lte("data", lastDayOfMonth(mesAno)).eq("tipo", "fixa"),
    ]).then(([parcRes, fixasRes]) => {
      if (parcRes.error) logError("[Analises] installment_instances error:", parcRes.error);
      if (fixasRes.error) logError("[Analises] despesas fixas error:", fixasRes.error);
      const parcelas = parcRes.data || [];
      setParcelamentosAtivos(parcelas.filter((p: any) => p.status === "pending").length);
      setParcelamentoValorMes(parcelas.reduce((s: number, p: any) => s + Number(p.amount || 0), 0));
      setDespesasFixas((fixasRes.data || []).reduce((s: number, d: any) => s + Number(d.valor), 0));
    }).catch(err => logError("[Analises] despesasFixas fetch exception:", err));
  }, [user, mesAno]);

  const pctFixo = pReceitas > 0 ? (despesasFixas / pReceitas) * 100 : 0;
  const pctParcelamentos = pReceitas > 0 ? (parcelamentoValorMes / pReceitas) * 100 : 0;

  // ═══ Próximos Vencimentos ═══
  const [proximosVencimentos, setProximosVencimentos] = useState<{
    id: string;
    tipo: "parcela" | "despesa";
    nome: string;
    valor: number;
    diasAteVencer: number;
  }[]>([]);

  useEffect(() => {
    if (!user) return;
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    const in30Str = in30.toISOString().split("T")[0];
    const nextM = month >= 12 ? 1 : month + 1;
    const nextY = month >= 12 ? year + 1 : year;
    const nextComp = `${nextY}-${String(nextM).padStart(2, "0")}`;

    Promise.all([
      supabase.from("installment_instances")
        .select("id,amount,status,competencia,due_date,installment_number,despesas(descricao,categoria,total_parcelas)")
        .eq("user_id", user.id)
        .in("competencia", [mesAno, nextComp])
        .eq("status", "pending"),
      supabase.from("despesas")
        .select("id,valor,descricao,data,categoria")
        .eq("user_id", user.id)
        .gte("data", todayStr)
        .lte("data", in30Str),
    ]).then(([parcRes, despRes]) => {
      if (parcRes.error) logError("[Analises] proximosVencimentos parcelas error:", parcRes.error);
      if (despRes.error) logError("[Analises] proximosVencimentos despesas error:", despRes.error);
      const items: typeof proximosVencimentos = [];

      (parcRes.data || []).forEach((p: any) => {
        if (!p.due_date) return;
        const dueDate = new Date(p.due_date + "T12:00:00");
        const dias = Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / 86400000));
        if (dias <= 30) {
          const titulo = p.despesas?.descricao || p.despesas?.categoria;
          const nome = titulo
            ? `${titulo} — parcela ${p.installment_number}/${p.despesas?.total_parcelas ?? "?"}`
            : `Parcela ${p.installment_number}/${p.despesas?.total_parcelas ?? "?"}`;
          items.push({
            id: `parc-${p.id}`,
            tipo: "parcela",
            nome,
            valor: Number(p.amount || 0),
            diasAteVencer: dias,
          });
        }
      });

      (despRes.data || []).forEach((d: any) => {
        const dueDate = new Date(d.data + "T12:00:00");
        const dias = Math.max(0, Math.ceil((dueDate.getTime() - today.getTime()) / 86400000));
        items.push({
          id: `desp-${d.id}`,
          tipo: "despesa",
          nome: d.descricao || d.categoria || "Despesa",
          valor: Number(d.valor || 0),
          diasAteVencer: dias,
        });
      });

      items.sort((a, b) => a.diasAteVencer - b.diasAteVencer);
      setProximosVencimentos(items);
    }).catch(err => logError("[Analises] proximosVencimentos fetch exception:", err));
  }, [user, mesAno, year, month]);

  // ═══ Horizonte de Parcelamentos ═══
  const [horizonteParc, setHorizonteParc] = useState<{ mes: string; total: number }[]>([]);
  const [mesesAteZerarParc, setMesesAteZerarParc] = useState(24);

  useEffect(() => {
    if (!user) return;
    const comps: string[] = [];
    for (let i = 0; i < 24; i++) {
      const m = ((month - 1 + i) % 12) + 1;
      const y = year + Math.floor((month - 1 + i) / 12);
      comps.push(`${y}-${String(m).padStart(2, "0")}`);
    }

    const fetchHorizonte = async () => {
      try {
        const { data, error } = await supabase.from("installment_instances")
          .select("amount,competencia,status")
          .eq("user_id", user.id)
          .in("competencia", comps)
          .eq("status", "pending");

        if (error) throw error;

        const byMonth: Record<string, number> = {};
        comps.forEach(c => { byMonth[c] = 0; });
        (data || []).forEach((p: any) => {
          byMonth[p.competencia] = (byMonth[p.competencia] || 0) + Number(p.amount || 0);
        });

        const result = comps.map(comp => {
          const [cy, cm] = comp.split("-").map(Number);
          const label = new Date(cy, cm - 1).toLocaleDateString("pt-BR", { month: "short" });
          const suffix = cy !== year ? ` ${cy}` : "";
          return { mes: `${label.charAt(0).toUpperCase() + label.slice(1)}${suffix}`, total: byMonth[comp] };
        });

        setHorizonteParc(result);
        const zeroIdx = result.findIndex(r => r.total === 0);
        setMesesAteZerarParc(zeroIdx === -1 ? 24 : zeroIdx);
      } catch (err) {
        logError("[Analises] horizonteParc fetch exception:", err);
      }
    };
    fetchHorizonte();
  }, [user, mesAno, year, month]);

  const compromissosAno = useMemo(() => {
    const anoAtual = year;
    const fixoMensal = despesasFixas;
    // org.anuais is an annual summary object, not an array of expense entries.
    // Anuais por mês are fetched separately if needed; for now chart shows fixed baseline.
    return Array.from({ length: 12 }, (_, m) => {
      const d = new Date(anoAtual, m);
      const label = d.toLocaleDateString("pt-BR", { month: "short" });
      return {
        mes: `${anoAtual}-${String(m + 1).padStart(2, "0")}`,
        label: label.charAt(0).toUpperCase() + label.slice(1, 3),
        fixo: fixoMensal,
        anual: 0,
        total: fixoMensal,
      };
    });
  }, [despesasFixas, year]);

  const totalCompromissosAno = compromissosAno.reduce((s, m) => s + m.total, 0);
  const mesMaisPesadoAno = compromissosAno.length > 0
    ? compromissosAno.reduce((a, b) => a.total > b.total ? a : b)
    : { total: 0, label: "—", mes: "" };

  const composicaoSaidas = useMemo(() => {
    const variaveis = Math.max(0, pDespesas - despesasFixas - parcelamentoValorMes);
    return [
      { name: "Fixas", value: despesasFixas, color: "hsl(var(--destructive))" },
      { name: "Parcelamentos", value: parcelamentoValorMes, color: "hsl(var(--warning))" },
      { name: "Variáveis", value: variaveis, color: "hsl(var(--primary))" },
    ].filter(d => d.value > 0);
  }, [pDespesas, despesasFixas, parcelamentoValorMes]);

  const orcamentoVsReal = useMemo(() => {
    if (!org.orcamentoPorCategoria || org.orcamentoPorCategoria.length === 0) return [];
    return org.orcamentoPorCategoria
      .filter((orc: any) => Number(orc.limite) > 0)
      .map((orc: any) => {
        const realizado = periodDespesasList
          .filter(d => d.categoria === orc.categoria)
          .reduce((s, d) => s + d.valor, 0);
        const limite = Number(orc.limite);
        const pct = limite > 0 ? (realizado / limite) * 100 : 0;
        return {
          categoria: orc.categoria,
          limite,
          realizado,
          pct,
          restante: Math.max(0, limite - realizado),
          estourou: realizado > limite,
        };
      }).sort((a, b) => b.pct - a.pct);
  }, [org.orcamentoPorCategoria, periodDespesasList]);

  const totalOrcado = orcamentoVsReal.reduce((s, o) => s + o.limite, 0);
  const totalRealizado = orcamentoVsReal.reduce((s, o) => s + o.realizado, 0);
  const categoriasEstouradas = orcamentoVsReal.filter(o => o.estourou).length;

  const insights = useMemo<Insight[]>(() => {
    const list: Insight[] = [];

    if (pReceitas > 0 && pDespesas / pReceitas > 0.8) {
      const fixaPct = pReceitas > 0 ? (despesasFixas / pReceitas) * 100 : 0;
      list.push({ type: "danger", icon: AlertTriangle, message: `Despesas representam ${((pDespesas / pReceitas) * 100).toFixed(1)}% da receita. ${fixaPct > 50 ? `Seus gastos fixos sozinhos já consomem ${fixaPct.toFixed(0)}% — há pouca flexibilidade para cortes rápidos.` : "Revise gastos variáveis para abrir margem."}` });
    }
    if (pReceitas > 0 && pTaxaPoupanca < 10) {
      const parcMsg = parcelamentoValorMes > 0 ? ` Parcelamentos ativos consomem ${fmt(parcelamentoValorMes)} (${pctParcelamentos.toFixed(1)}% da renda) — ao quitá-los, essa margem será liberada.` : "";
      list.push({ type: "warning", icon: Lightbulb, message: `Taxa de poupança de ${pTaxaPoupanca.toFixed(1)}%. Meta ideal: 20%.${parcMsg}` });
    }
    if (categoriaMaisPesada && categoriaMaisPesada.pct > 30) {
      const aboveAvg = mediaCategoria3m > 0 && categoriaMaisPesada.valor > mediaCategoria3m * 1.1;
      list.push({ type: "warning", icon: BarChart3, message: `"${categoriaMaisPesada.name}" consome ${categoriaMaisPesada.pct.toFixed(1)}% da receita (${fmt(categoriaMaisPesada.valor)}).${aboveAvg ? " Está acima da sua média dos últimos 3 meses — vale investigar." : ""}` });
    }
    if (orgP1.totalParcelas > 0 && org.totalParcelas > orgP1.totalParcelas * 1.2) {
      const crescimento = ((org.totalParcelas - orgP1.totalParcelas) / orgP1.totalParcelas * 100).toFixed(1);
      list.push({ type: "warning", icon: ShoppingCart, message: `Parcelamentos cresceram ${crescimento}% (de ${fmt(orgP1.totalParcelas)} para ${fmt(org.totalParcelas)}). ${parcelamentosAtivos > 5 ? `São ${parcelamentosAtivos} parcelas ativas — revise compromissos futuros.` : "Monitore para evitar acúmulo."}` });
    }
    if (pSaldo < 0) {
      list.push({ type: "danger", icon: TrendingDown, message: `Saldo negativo de ${fmt(pSaldo)}. ${despesasFixas > 0 ? `Gastos fixos de ${fmt(despesasFixas)} já comprometem ${pctFixo.toFixed(0)}% da renda antes dos variáveis.` : ""}` });
    }
    if (tendencia === "improving") {
      list.push({ type: "tip", icon: ArrowUpRight, message: "Tendência positiva: seu saldo vem melhorando nos últimos 3 meses." });
    }
    if (volatilidade > 25) {
      list.push({ type: "warning", icon: Activity, message: `Seus gastos variam ${volatilidade.toFixed(0)}% entre os meses — alta imprevisibilidade dificulta o planejamento. Considere fixar um teto mensal.` });
    }

    return list;
  }, [pReceitas, pDespesas, pSaldo, pTaxaPoupanca, categoriaMaisPesada, mediaCategoria3m, org.totalParcelas, orgP1.totalParcelas, tendencia, despesasFixas, parcelamentoValorMes, parcelamentosAtivos, pctFixo, pctParcelamentos, volatilidade, fmt]);

  const diagnosticText = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Seu grau de compromisso está em ${pGrauCompromisso.toFixed(1)}%.`);
    if (pGrauCompromisso <= 50) parts.push("Isso indica uma excelente margem para crescimento de patrimônio.");
    else if (pGrauCompromisso <= 70) parts.push("Situação saudável, mas com espaço para otimizar.");
    else parts.push("Sua renda está muito comprometida.");
    if (despesasFixas > 0 && pReceitas > 0) {
      parts.push(`Gastos fixos representam ${pctFixo.toFixed(0)}% da renda.`);
      if (parcelamentoValorMes > 0) parts.push(`Parcelamentos adicionam ${pctParcelamentos.toFixed(0)}%.`);
    }
    if (categoriaMaisPesada) {
      parts.push(`Maior gasto: ${categoriaMaisPesada.name} (${categoriaMaisPesada.pct.toFixed(1)}% da renda).`);
      if (mediaCategoria3m > 0 && categoriaMaisPesada.valor > mediaCategoria3m * 1.15) parts.push("Esse gasto está acima da sua média recente.");
    }
    if (pTaxaPoupanca > 0) parts.push(`Taxa de poupança: ${pTaxaPoupanca.toFixed(1)}%${pTaxaPoupanca >= 20 ? " — acima da meta." : pTaxaPoupanca >= 10 ? " — próxima da meta de 20%." : " — abaixo da meta de 20%."}`);
    if (tendencia === "improving") parts.push("A tendência dos últimos meses é positiva.");
    else if (tendencia === "declining") parts.push("A tendência dos últimos meses merece atenção — seu saldo vem caindo.");
    return parts.join(" ");
  }, [pGrauCompromisso, categoriaMaisPesada, pTaxaPoupanca, tendencia, despesasFixas, pReceitas, pctFixo, parcelamentoValorMes, pctParcelamentos, mediaCategoria3m]);

  const VarBadge = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const positive = value > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${positive ? "text-success" : "text-destructive"}`}>
        {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  if (org.loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <PieChartIcon className="h-6 w-6 text-primary" /> Análises
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{periodCfg.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={mesAno} onValueChange={setMesAno}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as PeriodoAnalise)}>
            <SelectTrigger className="w-[170px]">
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ═══ 1. Visão do Período ═══ */}
      <SectionTitle icon={Zap} label="Visão do Período" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard
          icon={TrendingUp} iconColor="text-success" label="Receita"
          value={<span className="text-success">{fmt(pReceitas)}</span>}
          sub={<div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">vs mês anterior</span><VarBadge value={varReceita} /></div>}
          tooltip="Total de receitas registradas no período selecionado."
        />
        <KpiCard
          icon={TrendingDown} iconColor="text-destructive" label="Despesas"
          value={<span className="text-destructive">{fmt(pDespesas)}</span>}
          sub={<div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">vs mês anterior</span><VarBadge value={varDespesa} /></div>}
          tooltip="Total de despesas registradas no período selecionado."
        />
        <KpiCard
          icon={PiggyBank} iconColor="text-info" label="Economia"
          value={<span className="text-info">{fmt(periodEconomias)}</span>}
          sub={<div className="flex items-center justify-between"><span className="text-[10px] text-muted-foreground">vs mês anterior</span><VarBadge value={varEconomia} /></div>}
          tooltip="Valor reservado ou destinado a economias no período."
        />
        <KpiCard
          icon={Wallet} iconColor="text-primary" label="Saldo"
          value={<span className={pSaldo >= 0 ? "text-success" : "text-destructive"}>{fmt(pSaldo)}</span>}
          sub={<p className="text-[10px] text-muted-foreground">Receita − Despesas</p>}
          tooltip="Diferença entre receitas e despesas. Positivo indica sobra; negativo indica déficit."
        />
        <KpiCard
          icon={Percent} iconColor="text-warning" label="Compromisso"
          value={<span className={pGrauCompromisso <= 70 ? "text-success" : pGrauCompromisso <= 90 ? "text-warning" : "text-destructive"}>{pGrauCompromisso.toFixed(1)}%</span>}
          sub={<p className="text-[10px] text-muted-foreground">% renda comprometida</p>}
          tooltip="Percentual da receita comprometido com despesas. Ideal: abaixo de 70%. Acima de 90% é crítico."
        />
        <KpiCard
          icon={DollarSign} iconColor="text-accent" label="Tx. Poupança"
          value={<span className={pTaxaPoupanca >= 20 ? "text-success" : pTaxaPoupanca >= 10 ? "text-warning" : "text-destructive"}>{pTaxaPoupanca.toFixed(1)}%</span>}
          sub={<p className="text-[10px] text-muted-foreground">Meta: 20%</p>}
          tooltip="Percentual da receita destinado a economias. A meta recomendada é de pelo menos 20%."
        />
      </div>

      {/* Saldo Previsto vs Real */}
      {(org.saldoPrevisto !== 0 || org.saldoReal !== 0) && (
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-primary" /> Previsto vs Realizado
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              O quanto o mês está saindo conforme planejado.
            </p>
          </CardHeader>
          <CardContent>
            {(() => {
              const prev = org.saldoPrevisto;
              const real = org.saldoReal;
              const delta = real - prev;
              const deltaPct = prev !== 0 ? (delta / Math.abs(prev)) * 100 : 0;
              const aligned = Math.abs(deltaPct) <= 10;
              const better = delta > 0;
              const Icon = aligned ? CheckCircle2 : better ? TrendingUp : TrendingDown;
              const iconClass = aligned ? "text-success" : better ? "text-success" : "text-destructive";
              const labelText = aligned
                ? "Seu mês está alinhado com o plano."
                : better
                ? "Você está indo melhor que o planejado."
                : "Seu mês está saindo pior que o planejado.";
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Saldo previsto</p>
                    <p className={`text-lg font-heading font-bold ${prev >= 0 ? "text-foreground" : "text-destructive"}`}>{fmt(prev)}</p>
                    <p className="text-[10px] text-muted-foreground">o que você planejou</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Saldo real</p>
                    <p className={`text-lg font-heading font-bold ${real >= 0 ? "text-foreground" : "text-destructive"}`}>{fmt(real)}</p>
                    <p className="text-[10px] text-muted-foreground">o que está acontecendo</p>
                  </div>
                  <div className={`p-3 rounded-xl border ${aligned || better ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Diferença</p>
                    </div>
                    <p className={`text-lg font-heading font-bold ${iconClass}`}>
                      {delta > 0 ? "+" : ""}{fmt(delta)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{labelText}</p>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* ═══ 2. Diagnóstico do Atlas ═══ */}
      <SectionTitle icon={Compass} label="Diagnóstico do Atlas" />
      <Card className="shadow-soft border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Diagnóstico do Atlas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-4 rounded-xl bg-card border border-border/50">
            <p className="text-sm text-foreground leading-relaxed">{diagnosticText}</p>
          </div>
          {(() => {
            const varDespPct = orgP1.totalDespesas > 0 ? ((org.totalDespesas - orgP1.totalDespesas) / orgP1.totalDespesas) * 100 : 0;
            const varRecPct = orgP1.totalGanhos > 0 ? ((org.totalGanhos - orgP1.totalGanhos) / orgP1.totalGanhos) * 100 : 0;
            if (Math.abs(varDespPct) > 5 || Math.abs(varRecPct) > 5) {
              const msg = varDespPct > 10 && varRecPct < varDespPct
                ? `Nos últimos meses suas despesas cresceram ${varDespPct.toFixed(0)}% enquanto sua renda ${varRecPct > 0 ? `cresceu apenas ${varRecPct.toFixed(0)}%` : `caiu ${Math.abs(varRecPct).toFixed(0)}%`}. Se essa tendência continuar, sua taxa de poupança pode ser comprometida.`
                : varRecPct > 10
                ? `Sua renda cresceu ${varRecPct.toFixed(0)}% em relação ao mês anterior. Continue acompanhando para garantir que os gastos não acompanhem.`
                : null;
              if (msg) return (
                <div className="p-3 rounded-xl bg-muted/40 border border-border/30">
                  <p className="text-sm text-foreground/80 leading-relaxed">{msg}</p>
                </div>
              );
            }
            return null;
          })()}
        </CardContent>
      </Card>

      {/* ═══ 3. Pontos de Atenção ═══ */}
      {insights.length > 0 && (
        <>
          <SectionTitle icon={AlertTriangle} label="Pontos de Atenção" />
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-warning" /> Insights do Período
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={`p-3 rounded-lg border text-sm ${
                    insight.type === "danger" ? "bg-destructive/10 border-destructive/20 text-destructive" :
                    insight.type === "warning" ? "bg-warning/10 border-warning/20 text-warning-foreground" :
                    "bg-info/10 border-info/20 text-info"
                  }`}
                >
                  {insight.message}
                </div>
              ))}
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ 4. Para Onde Vai ═══ */}
      <SectionTitle icon={Layers} label="Para Onde Vai" />
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" /> Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {despesasPorCategoria.length > 0 ? (
              <div className="space-y-3">
                {despesasPorCategoria.map(g => (
                  <div key={g.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium truncate flex-1">{g.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-heading font-bold text-foreground">{g.pctReceita.toFixed(1)}%</span>
                        <span className="text-xs text-muted-foreground">{fmt(g.valor)}</span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(g.pctReceita * 2, 100)}%`,
                          backgroundColor: g.pctReceita > 30 ? "hsl(var(--destructive))" : g.pctReceita > 20 ? "hsl(var(--warning))" : "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma despesa registrada no período.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Pin className="h-4 w-4 text-primary" /> Destaque do Período
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoriaMaisPesada ? (
              <>
                <div className="p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Maior categoria</p>
                  <p className="text-lg font-heading font-bold">{categoriaMaisPesada.name}</p>
                  <p className="text-2xl font-heading font-bold text-primary mt-1">{fmt(categoriaMaisPesada.valor)}</p>
                  <p className="text-sm text-muted-foreground mt-1">{categoriaMaisPesada.pct.toFixed(1)}% da receita</p>
                </div>
                {mediaCategoria3m > 0 && (
                  <div className="p-3 rounded-xl bg-info/10 border border-info/20">
                    <p className="text-xs text-info">
                      Média dos últimos 3 meses para "{categoriaMaisPesada.name}": <strong>{fmt(mediaCategoria3m)}</strong>
                      {categoriaMaisPesada.valor > mediaCategoria3m * 1.1 ? " — acima da média." : categoriaMaisPesada.valor < mediaCategoria3m * 0.9 ? " — abaixo da média." : " — dentro da média."}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <BarChart3 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma despesa registrada.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Composição das Saídas */}
      {pDespesas > 0 && composicaoSaidas.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> Composição das Saídas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="h-5 rounded-full overflow-hidden flex">
              {composicaoSaidas.map(d => (
                <div
                  key={d.name}
                  className="h-full transition-all duration-500"
                  style={{ width: `${(d.value / pDespesas) * 100}%`, backgroundColor: d.color }}
                />
              ))}
            </div>
            <div className={`grid gap-3 ${composicaoSaidas.length === 3 ? "grid-cols-3" : composicaoSaidas.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
              {composicaoSaidas.map(d => (
                <div key={d.name} className="text-center p-3 rounded-xl bg-muted/30 border border-border/30">
                  <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ backgroundColor: d.color }} />
                  <p className="text-[10px] text-muted-foreground mb-0.5">{d.name}</p>
                  <p className="text-sm font-heading font-bold">{fmt(d.value)}</p>
                  <p className="text-[10px] text-muted-foreground">{((d.value / pDespesas) * 100).toFixed(1)}%</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground">Fixas: despesas recorrentes mensais. <Repeat className="inline h-3 w-3 mb-0.5" /> Parcelamentos: prestações ativas. Variáveis: restante do período.</p>
          </CardContent>
        </Card>
      )}

      {/* Mapa de Gastos Comprometidos */}
      {despesasPorCategoria.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Wallet className="h-4 w-4 text-warning" /> Mapa de Gastos Comprometidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">Quanto da sua renda já está comprometida antes do mês começar.</p>
            <div className="space-y-2">
              {despesasPorCategoria.filter(g => ["Moradia", "Financiamento", "Escola", "Assinaturas", "Seguros", "Saúde", "Transporte"].some(k => g.name.toLowerCase().includes(k.toLowerCase()))).length > 0
                ? despesasPorCategoria
                    .filter(g => ["Moradia", "Financiamento", "Escola", "Assinaturas", "Seguros", "Saúde", "Transporte"].some(k => g.name.toLowerCase().includes(k.toLowerCase())))
                    .map(g => (
                      <div key={g.name} className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-muted/20">
                        <span className="text-sm font-medium">{g.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">{g.pctReceita.toFixed(1)}%</span>
                          <span className="text-sm font-heading font-bold">{fmt(g.valor)}</span>
                        </div>
                      </div>
                    ))
                : despesasPorCategoria.slice(0, 5).map(g => (
                    <div key={g.name} className="flex items-center justify-between p-2.5 rounded-lg border border-border/30 bg-muted/20">
                      <span className="text-sm font-medium">{g.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">{g.pctReceita.toFixed(1)}%</span>
                        <span className="text-sm font-heading font-bold">{fmt(g.valor)}</span>
                      </div>
                    </div>
                  ))
              }
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ 5. Orçamento do Mês ═══ */}
      <SectionTitle icon={Target} label="Orçamento do Mês" />
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" /> Orçamento vs Realizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {orcamentoVsReal.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-1">Nenhum orçamento definido para este mês.</p>
              <p className="text-xs text-muted-foreground/70">Defina limites por categoria em Organização › Orçamentos para começar a acompanhar.</p>
            </div>
          ) : (
            <>
              {/* Header summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Orçado</p>
                  <p className="text-lg font-heading font-bold text-foreground">{fmt(totalOrcado)}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Realizado</p>
                  <p className={`text-lg font-heading font-bold ${totalRealizado > totalOrcado ? "text-destructive" : "text-foreground"}`}>{fmt(totalRealizado)}</p>
                </div>
                <div className={`p-3 rounded-xl border ${categoriasEstouradas > 0 ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20"}`}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Categorias estouradas</p>
                  <p className={`text-lg font-heading font-bold ${categoriasEstouradas > 0 ? "text-destructive" : "text-success"}`}>
                    {categoriasEstouradas} de {orcamentoVsReal.length}
                  </p>
                </div>
              </div>

              {/* Por categoria */}
              <div className="space-y-3">
                {orcamentoVsReal.map(o => {
                  const barColor = o.pct > 100 ? "bg-destructive" : o.pct > 80 ? "bg-warning" : "bg-success";
                  const StatusIcon = o.pct > 100 ? AlertCircle : o.pct > 80 ? AlertTriangle : CheckCircle2;
                  const statusColor = o.pct > 100 ? "text-destructive" : o.pct > 80 ? "text-warning" : "text-success";
                  return (
                    <div key={o.categoria} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${statusColor}`} />
                          <span className="text-sm font-medium truncate">{o.categoria}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-xs font-heading font-bold ${statusColor}`}>{o.pct.toFixed(0)}%</span>
                          <span className="text-xs text-muted-foreground">{fmt(o.realizado)} / {fmt(o.limite)}</span>
                        </div>
                      </div>
                      <div className="h-2 bg-secondary rounded-full overflow-hidden relative">
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                          style={{ width: `${Math.min(o.pct, 100)}%` }} />
                        {o.pct > 100 && (
                          <div className="absolute inset-y-0 right-0 w-1 bg-destructive animate-pulse" />
                        )}
                      </div>
                      {o.estourou && (
                        <p className="text-[11px] text-destructive">
                          Estourou em {fmt(o.realizado - o.limite)}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Direcionamento */}
              {categoriasEstouradas > 0 && (
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                  <p className="text-xs text-foreground leading-relaxed">
                    <span className="font-heading font-bold text-destructive">Ação sugerida: </span>
                    Você estourou o orçamento em {categoriasEstouradas} {categoriasEstouradas === 1 ? "categoria" : "categorias"}. Revise os limites ou reveja os gastos até o fim do mês para não comprometer sua taxa de poupança.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ 6. Próximos Vencimentos ═══ */}
      <SectionTitle icon={CalendarClock} label="Próximos Vencimentos" />
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-warning" /> Próximos Vencimentos — 30 dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          {proximosVencimentos.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-success/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum vencimento nos próximos 30 dias.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {proximosVencimentos.map(v => {
                const isUrgent = v.diasAteVencer <= 3;
                const isWarning = !isUrgent && v.diasAteVencer <= 7;
                const rowClass = isUrgent
                  ? "bg-destructive/5 border-destructive/20"
                  : isWarning ? "bg-warning/5 border-warning/20"
                  : "bg-muted/20 border-border/30";
                const textClass = isUrgent ? "text-destructive" : isWarning ? "text-warning" : "text-muted-foreground";
                const daysLabel = v.diasAteVencer === 0 ? "Hoje" : v.diasAteVencer === 1 ? "Amanhã" : `em ${v.diasAteVencer}d`;
                return (
                  <div key={v.id} className={`flex items-center justify-between p-3 rounded-xl border ${rowClass}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {v.tipo === "parcela"
                        ? <ShoppingCart className={`h-4 w-4 flex-shrink-0 ${textClass}`} />
                        : <Repeat className={`h-4 w-4 flex-shrink-0 ${textClass}`} />
                      }
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{v.nome}</p>
                        <p className={`text-xs ${textClass}`}>{daysLabel}</p>
                      </div>
                    </div>
                    <p className="text-sm font-heading font-bold flex-shrink-0 ml-3">{fmt(v.valor)}</p>
                  </div>
                );
              })}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border/40 bg-muted/30 mt-1">
                <p className="text-sm font-heading font-bold text-foreground">Total</p>
                <p className="text-sm font-heading font-bold text-foreground">
                  {fmt(proximosVencimentos.reduce((s, v) => s + v.valor, 0))}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 7. Horizonte de Parcelamentos ═══ */}
      <SectionTitle icon={Repeat} label="Horizonte de Parcelamentos" />
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Repeat className="h-4 w-4 text-primary" /> Horizonte de Parcelamentos — 24 meses
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Evolução das parcelas pendentes mês a mês.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {horizonteParc.length === 0 || horizonteParc.every(h => h.total === 0) ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-success/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Nenhum parcelamento ativo nos próximos 24 meses.</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={horizonteParc}>
                  <defs>
                    <linearGradient id="gradParc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={2} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Area
                    type="monotone"
                    dataKey="total"
                    name="Parcelas"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#gradParc)"
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Este mês</p>
                  <p className="text-sm font-heading font-bold">{fmt(horizonteParc[0]?.total ?? 0)}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Total 24m</p>
                  <p className="text-sm font-heading font-bold">{fmt(horizonteParc.reduce((s, h) => s + h.total, 0))}</p>
                </div>
                <div className={`p-3 rounded-lg border ${mesesAteZerarParc < 24 ? "bg-success/5 border-success/20" : "bg-muted/30 border-border/30"}`}>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Livre em</p>
                  <p className={`text-sm font-heading font-bold ${mesesAteZerarParc < 24 ? "text-success" : "text-muted-foreground"}`}>
                    {mesesAteZerarParc < 24 ? `${mesesAteZerarParc}m` : "+24m"}
                  </p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-heading font-bold text-primary">Horizonte: </span>
                  {mesesAteZerarParc === 0
                    ? "Você não tem parcelamentos pendentes neste mês."
                    : mesesAteZerarParc < 24
                    ? `Seus parcelamentos se encerram em ${mesesAteZerarParc} ${mesesAteZerarParc === 1 ? "mês" : "meses"}. O valor total comprometido nos próximos 24 meses é ${fmt(horizonteParc.reduce((s, h) => s + h.total, 0))}.`
                    : `Você ainda tem parcelamentos ativos além dos próximos 24 meses. O compromisso acumulado é de ${fmt(horizonteParc.reduce((s, h) => s + h.total, 0))} — avalie se alguma quitação antecipada faz sentido.`}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ 8. Compromissos do Ano ═══ */}
      <SectionTitle icon={CalendarRange} label="Visão Anual" />
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-primary" /> Compromissos do Ano
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Soma das obrigações fixas e gastos anuais (IPVA, IPTU, seguros) distribuídos nos meses de {year}.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={compromissosAno}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: number) => fmt(v)}
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="fixo" name="Fixos mensais" stackId="a" fill="hsl(var(--warning))" radius={[0, 0, 0, 0]} />
              <Bar dataKey="anual" name="Anuais (IPVA/IPTU/seguros)" stackId="a" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Total do ano</p>
              <p className="text-lg font-heading font-bold text-foreground">{fmt(totalCompromissosAno)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Média mensal</p>
              <p className="text-lg font-heading font-bold text-foreground">{fmt(totalCompromissosAno / 12)}</p>
            </div>
            <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Mês mais pesado</p>
              <p className="text-lg font-heading font-bold text-destructive capitalize">{mesMaisPesadoAno.label}</p>
              <p className="text-[10px] text-muted-foreground">{fmt(mesMaisPesadoAno.total)}</p>
            </div>
          </div>

          {compromissosAno.some(m => m.anual > 0) && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-foreground leading-relaxed">
                <span className="font-heading font-bold text-primary">Planejamento: </span>
                Os picos nas barras mostram os meses em que gastos anuais se somam aos fixos. Reserve com antecedência para não depender da renda daquele mês.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 9. Evolução ═══ */}
      <SectionTitle icon={TrendingUp} label="Evolução" />
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Evolução Financeira — Últimos 6 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="Receita" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Despesas" stroke="hsl(var(--destructive))" strokeWidth={2.5} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Economias" stroke="hsl(var(--info))" strokeWidth={2} dot={{ r: 3 }} strokeDasharray="5 5" />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-warning" /> Compromisso de Renda ao Longo do Ano
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Quanto da sua receita foi consumida por despesas e compromissos em cada mês de {year}. O mês atual é destacado; meses à direita são projeção.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={compromisoHistSplit}>
              <defs>
                <linearGradient id="gradCompromissoPast" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v) => `${v.toFixed(0)}%`}
                domain={[0, capMax]}
                allowDataOverflow={false}
              />
              <ReferenceArea y1={0} y2={50} fill="hsl(var(--success))" fillOpacity={0.05} />
              <ReferenceArea y1={50} y2={70} fill="hsl(var(--info))" fillOpacity={0.05} />
              {capMax > 70 && <ReferenceArea y1={70} y2={capMax} fill="hsl(var(--destructive))" fillOpacity={0.06} />}
              <ReferenceLine y={50} stroke="hsl(var(--success))" strokeDasharray="4 4" strokeWidth={1} />
              <ReferenceLine y={70} stroke="hsl(var(--destructive))" strokeDasharray="4 4" strokeWidth={1} />
              <Tooltip content={<CompromissoTooltip historico={org.historico} />} />
              <Area
                type="monotone"
                dataKey="passado"
                name="Realizado"
                stroke="hsl(var(--warning))"
                strokeWidth={2.5}
                fill="url(#gradCompromissoPast)"
                connectNulls={false}
                dot={(props: any) => {
                  const { cx, cy, payload: p } = props;
                  if (cy == null) return <g />;
                  const isCurrent = p?.isCurrent;
                  return (
                    <circle
                      cx={cx} cy={cy}
                      r={isCurrent ? 6 : 3}
                      fill={isCurrent ? "hsl(var(--primary))" : "hsl(var(--warning))"}
                      stroke={isCurrent ? "hsl(var(--primary-foreground))" : "none"}
                      strokeWidth={isCurrent ? 2 : 0}
                    />
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="futuro"
                name="Projeção"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeDasharray="5 4"
                fill="none"
                connectNulls={false}
                dot={{ r: 2, fill: "hsl(var(--muted-foreground))" }}
              />
            </AreaChart>
          </ResponsiveContainer>

          {/* Outlier banner */}
          {outliers.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="text-xs text-foreground leading-relaxed">
                <span className="font-heading font-bold text-destructive">Pico fora da escala:</span>{" "}
                {outliers.map((o, i) => (
                  <span key={o.mes}>
                    {o.mes} com <strong>{o.compromisso.toFixed(0)}%</strong>{i < outliers.length - 1 ? ", " : ""}
                  </span>
                ))}
                . O gráfico está limitado a {CAP}% para manter os outros meses legíveis.
                {outliers.some(o => o.compromisso > 200) && " Picos acima de 200% geralmente indicam um mês com receita atípica ou gasto concentrado — vale abrir o mês para investigar."}
              </div>
            </div>
          )}

          {/* Summary: pior mês, melhor mês, tendência, atual */}
          {(() => {
            const validMonths = compromisoHist.filter(h => h.compromisso > 0);
            if (validMonths.length === 0) return null;
            const maxMonth = validMonths.reduce((a, b) => a.compromisso > b.compromisso ? a : b);
            const minMonth = validMonths.reduce((a, b) => a.compromisso < b.compromisso ? a : b);
            const last3 = compromisoHist.slice(Math.max(0, currentMonthIdx - 2), currentMonthIdx + 1).filter(h => h.compromisso > 0);
            let tendLabel = "Estável"; let TendIcon: React.ElementType = Activity; let tendClass = "text-muted-foreground";
            if (last3.length >= 2) {
              const first = last3[0].compromisso; const last = last3[last3.length - 1].compromisso;
              const diff = last - first;
              if (Math.abs(diff) > 5) {
                if (diff > 0) { tendLabel = "Subindo"; TendIcon = ArrowUpRight; tendClass = "text-destructive"; }
                else { tendLabel = "Caindo"; TendIcon = ArrowDownRight; tendClass = "text-success"; }
              }
            }
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Mais pesado</span>
                  </div>
                  <p className="text-sm font-heading font-bold capitalize">{maxMonth.mes}</p>
                  <p className="text-xs text-destructive font-heading font-bold">{maxMonth.compromisso.toFixed(0)}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Mais leve</span>
                  </div>
                  <p className="text-sm font-heading font-bold capitalize">{minMonth.mes}</p>
                  <p className="text-xs text-success font-heading font-bold">{minMonth.compromisso.toFixed(0)}%</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <TendIcon className={`h-3.5 w-3.5 ${tendClass}`} />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Tendência 3m</span>
                  </div>
                  <p className={`text-sm font-heading font-bold ${tendClass}`}>{tendLabel}</p>
                  <p className="text-[10px] text-muted-foreground">últimos 3 meses</p>
                </div>
                <div className={`p-3 rounded-lg border ${healthBg}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <HealthIcon className={`h-3.5 w-3.5 ${healthIconColor}`} />
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">Mês atual</span>
                  </div>
                  <p className={`text-sm font-heading font-bold ${healthColor}`}>{healthLabel}</p>
                  <p className={`text-xs font-heading font-bold ${healthColor}`}>{pGrauCompromisso.toFixed(0)}%</p>
                </div>
              </div>
            );
          })()}

          {/* Direcionamento acionável */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-xs text-foreground leading-relaxed">
              <span className="font-heading font-bold text-primary">Leitura do Atlas: </span>
              {pGrauCompromisso > 70
                ? `Seu mês atual está em ${pGrauCompromisso.toFixed(0)}% — acima da zona saudável (70%). Comece revendo a categoria "${categoriaMaisPesada?.name ?? "maior"}" e os parcelamentos ativos; são as duas alavancas mais rápidas.`
                : pGrauCompromisso > 50
                ? `Você está dentro da zona saudável (${pGrauCompromisso.toFixed(0)}%), mas ainda há margem para otimizar. Se a tendência dos próximos meses continuar ${tendencia === "declining" ? "em queda" : "estável"}, seu espaço para investir deve crescer.`
                : `Excelente: apenas ${pGrauCompromisso.toFixed(0)}% da receita está comprometida. Priorize canalizar a sobra para reserva (se < 6 meses) e depois para investimentos de longo prazo.`}
            </p>
          </div>
        </CardContent>
      </Card>

    </div>
  );
};

export default Analises;
