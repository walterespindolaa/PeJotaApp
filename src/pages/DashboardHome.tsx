import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useExpenseSkips } from "@/hooks/useExpenseSkips";
import { FV } from "@/lib/financial";
import { computeMonthTotals } from "@/lib/computeMonthTotals";
import { useUserPlan } from "@/hooks/useUserPlan";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { usePlan } from "@/hooks/usePlan";
import DashboardTrialExpiredOverlay from "@/components/DashboardTrialExpiredOverlay";
import DashboardSkeleton from "@/components/dashboard/DashboardSkeleton";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import PrimeirosPassosCard from "@/components/dashboard/PrimeirosPassosCard";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/log";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Wallet, TrendingUp, Umbrella, DollarSign, PiggyBank, BarChart3, Users,
  Zap, Shield, AlertTriangle, Landmark, Building2, Target, Heart,
  ChevronDown, CalendarRange, ChevronRight, ArrowUpRight, ArrowDownRight,
  Play, Sparkles, GraduationCap, Send, ArrowRight, Lock,
} from "lucide-react";
import { Link, useOutletContext, useNavigate } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import AtlasScore from "@/components/dashboard/AtlasScore";
import DashboardHero from "@/components/dashboard/DashboardHero";
import TendenciaFinanceiraChart from "@/components/dashboard/TendenciaFinanceiraChart";

// DiagnosticoInteligente removed from dashboard
import VisaoFutura from "@/components/dashboard/VisaoFutura";
import InfoTooltip, { INFO_CONFIGS } from "@/components/dashboard/InfoTooltip";
import UpgradeCTA from "@/components/UpgradeCTA";
// FaturaWidget removed from dashboard
import InsightRapido from "@/components/dashboard/InsightRapido";
import { PrivacyValue, MoneyValue, PercentValue } from "@/components/PrivacyValue";
import { Skeleton } from "@/components/ui/skeleton";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";

import type { VisaoPessoa } from "@/hooks/useOrganiza";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useI18n } from "@/contexts/I18nContext";
import { useAtlasScore } from "@/hooks/useAtlasScore";
import { useProximosVencimentos } from "@/hooks/useProximosVencimentos";
import { useInvestimentosResumo } from "@/hooks/useInvestimentosResumo";
import { useAposentadoriaResumo } from "@/hooks/useAposentadoriaResumo";
import PlanBanner from "@/components/PlanBanner";
import { useCourseProgress } from "@/hooks/useCourseProgress";
import { getCourseBySlug } from "@/lib/courses/data";
import { totalLessons } from "@/lib/courses/helpers";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { projectRecurringInRange } from "@/lib/projectRecurring";
import { fetchAllCompaniesTransactions } from "@/lib/companies";
import {
  checkAchievements, generateRecommendations,
  type ScoreDimensions,
} from "@/lib/atlasIntelligence";

type PeriodOption = "current" | "prev" | "3m" | "6m" | "12m" | "year" | "all" | "custom";
const periodOptions: { value: PeriodOption; label: string; short: string }[] = [
  { value: "current", label: "dh.per_current", short: "Este mês" },
  { value: "prev", label: "dh.per_prev", short: "Mês passado" },
  { value: "3m", label: "dh.per_3m", short: "3m" },
  { value: "6m", label: "dh.per_6m", short: "6m" },
  { value: "12m", label: "dh.per_12m", short: "12m" },
  { value: "year", label: "dh.per_year", short: "Ano" },
  { value: "all", label: "dh.per_all", short: "Tudo" },
  { value: "custom", label: "dh.per_custom", short: "Personalizado" },
];

function getPeriodTitle(period: PeriodOption): string {
  if (period === "current") return "Resumo do período";
  if (period === "prev") return "Resumo do mês passado";
  if (period === "3m") return "Resumo dos últimos 3 meses";
  if (period === "6m") return "Resumo dos últimos 6 meses";
  if (period === "12m") return "Resumo dos últimos 12 meses";
  if (period === "year") return "Resumo do ano";
  if (period === "all") return "Resumo desde o início";
  return "Resumo do período selecionado";
}

function getDateRange(period: PeriodOption, customRange?: { from: Date; to: Date }): { start: string; end: string } {
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const end = fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  if (period === "custom" && customRange) return { start: fmt(customRange.from), end: fmt(customRange.to) };
  if (period === "all") return { start: "2000-01-01", end };
  if (period === "current") {
    return { start: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, end };
  }
  if (period === "prev") {
    const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pmEnd = new Date(pm.getFullYear(), pm.getMonth() + 1, 0);
    return { start: fmt(pm), end: fmt(pmEnd) };
  }
  if (period === "year") return { start: `${now.getFullYear()}-01-01`, end };
  const months = period === "3m" ? 3 : period === "6m" ? 6 : 12;
  const d = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  return { start: fmt(d), end };
  
}

function calcVulnerabilidade(opts: {
  reservaAtual: number; reservaMeta: number; totalDespesas: number;
  totalReceitas: number; patrimonioTotal: number; temSeguros: boolean; fontesDiversificadas: number;
}) {
  let score = 0;
  const reservaPct = opts.reservaMeta > 0 ? Math.min(opts.reservaAtual / opts.reservaMeta, 1) : 0;
  score += reservaPct * 30;
  const compromisso = opts.totalReceitas > 0 ? opts.totalDespesas / opts.totalReceitas : 1;
  score += Math.max(0, (1 - compromisso)) * 25;
  if (opts.temSeguros) score += 15;
  score += Math.min(opts.fontesDiversificadas / 3, 1) * 15;
  const mesesCobertura = opts.totalDespesas > 0 ? opts.patrimonioTotal / opts.totalDespesas : 0;
  score += Math.min(mesesCobertura / 24, 1) * 15;
  return Math.round(Math.min(score, 100));
}

function getVulnerabilidadeLabel(score: number) {
  if (score <= 30) return { label: "dh.vuln_alta", color: "text-destructive", bg: "bg-destructive" };
  if (score <= 60) return { label: "dh.vuln_moderada", color: "text-warning", bg: "bg-warning" };
  if (score <= 80) return { label: "dh.vuln_boa", color: "text-success", bg: "bg-success" };
  return { label: "dh.vuln_solida", color: "text-success", bg: "bg-success" };
}

const DashboardHome = () => {
  const { onOpenChat, visaoFutura = true, setVisaoFutura = () => {} } = useOutletContext<{ onOpenChat?: (q?: string) => void; visaoFutura?: boolean; setVisaoFutura?: (v: boolean) => void }>();
  const { user } = useAuth();
  const { acesso_organiza_2026, acesso_planejamento_360 } = useUserPlan();
  const { fmt } = usePrivacyFmt();
  const { t } = useI18n();
  const { vencimentos } = useProximosVencimentos();
  const { totalAtual: invInvestido, rentabilidade: invRent } = useInvestimentosResumo();
  const { gapMensal: apGap, rendaDesejada: apRendaDesejada, hasData: apHasData } = useAposentadoriaResumo();
  const navigate = useNavigate();
  // "Continue de onde parou" — curso em destaque (Organização na Prática)
  const featuredCourse = getCourseBySlug("organizacao");
  const { totalCompleted: courseDone } = useCourseProgress("organizacao");
  const courseTotal = featuredCourse ? totalLessons(featuredCourse) : 0;
  // Objetivos — mesma conta de progresso da ObjetivosDeVida (valor_acumulado / valor_objetivo)
  const [objetivos, setObjetivos] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    let cancel = false;
    supabase.from("objetivos").select("nome,valor_acumulado,valor_objetivo").eq("user_id", user.id)
      .then(({ data, error }) => {
        if (error) console.error(error);
        if (!cancel) setObjetivos(data || []);
      });
    return () => { cancel = true; };
  }, [user?.id]);
  const { accessState } = usePlan();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Olá";
  const { greetingName: rawGreeting, activeAvatar, greetingEmoji, setGreetingEmoji, profileLoading } = useHouseholdView();
  const greetingName = rawGreeting || firstName;
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  // emoji-picker-react é pesado: carrega sob demanda só quando o picker abre.
  const [emojiMod, setEmojiMod] = useState<typeof import("emoji-picker-react") | null>(null);

  const [period, setPeriod] = useState<PeriodOption>("current");
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | undefined>();
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  
  const { view: householdView } = useHouseholdView();
  const visaoPessoa: VisaoPessoa = householdView as VisaoPessoa;
  const [nomePessoa1, setNomePessoa1] = useState("Pessoa 1");
  const [nomePessoa2, setNomePessoa2] = useState("Pessoa 2");
  const [fotoPessoa1, setFotoPessoa1] = useState("");
  const [fotoPessoa2, setFotoPessoa2] = useState("");
  const [vinculoPessoa2, setVinculoPessoa2] = useState("Cônjuge");

  const { visaoOptions } = useHouseholdLabels(nomePessoa1, nomePessoa2, vinculoPessoa2);

  const [totalReceitas, setTotalReceitas] = useState(0);
  const [totalDespesas, setTotalDespesas] = useState(0);
  const [despesaCorrente, setDespesaCorrente] = useState(0);
  const [totalEconomias, setTotalEconomias] = useState(0);
  const [totalFixas, setTotalFixas] = useState(0);
  const [totalVariaveis, setTotalVariaveis] = useState(0);
  const [totalParcelas, setTotalParcelas] = useState(0);
  const [patrimonioTotal, setPatrimonioTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [investimentos, setInvestimentos] = useState<any[]>([]);
  const [bens, setBens] = useState<any[]>([]);
  const [reservaAtivos, setReservaAtivos] = useState<any[]>([]);
  const [temSeguros, setTemSeguros] = useState(false);
  const [aposentData, setAposentData] = useState<any>(null);
  const [fontesDiversificadas, setFontesDiversificadas] = useState(0);
  const [hasEmpresa, setHasEmpresa] = useState(false);
  const [empresaData, setEmpresaData] = useState<any>(null);
  const [negocioLanc, setNegocioLanc] = useState<any[]>([]);
  const [portfolioSnapshots, setPortfolioSnapshots] = useState<{ month_ref: string; total_value: number }[]>([]);
  const [rawReceitas, setRawReceitas] = useState<any[]>([]);
  const [rawDespesas, setRawDespesas] = useState<any[]>([]);
  const [rawEconomias, setRawEconomias] = useState<any[]>([]);

  const { skips } = useExpenseSkips();
  const skippedKeys = useMemo(
    () => new Set(skips.map(s => `${s.template_id}:${s.month_ref}`)),
    [skips]
  );

  // Atlas Score 2.0
  const dateRange = useMemo(() => getDateRange(period, customRange), [period, customRange]);
  const { result: atlasResult, loading: atlasLoading, scoreInputs: atlasInputs, evolution3m } = useAtlasScore({
    userId: user?.id,
    periodStart: dateRange.start,
    periodEnd: dateRange.end,
    visaoPessoa,
    skippedKeys,
  });

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);
    try {
    const { start, end } = getDateRange(period, customRange);

    // casal = Pessoa 1 + Pessoa 2 + Compartilhado (show all, same as geral)
    const responsavelFilter = (visaoPessoa === "geral" || visaoPessoa === "casal") ? undefined
      : visaoPessoa === "pessoa1" ? "Pessoa 1"
      : "Pessoa 2";

    let rq = supabase.from("receitas").select("id,valor,status,responsavel,categoria,data,dia_recebimento,recorrente").eq("user_id", user.id).gte("data", start).lte("data", end);
    let dq = supabase.from("despesas").select("id,valor,responsavel,data,dia_vencimento,vencimento,is_parcelada,recorrente,tipo,tipo_parcelamento,status").eq("user_id", user.id).gte("data", start).lte("data", end).eq("is_parcelada", false);
    let eq = supabase.from("economias").select("valor,responsavel,data").eq("user_id", user.id).gte("data", start).lte("data", end);
    // Recorrentes (sem filtro de data) para projetar em meses sem linha física
    let rqRec = supabase.from("receitas").select("id,valor,status,responsavel,categoria,data,dia_recebimento,recorrente").eq("user_id", user.id).eq("recorrente", true);
    let dqRec = supabase.from("despesas").select("id,valor,responsavel,data,dia_vencimento,vencimento,is_parcelada,recorrente,tipo,tipo_parcelamento,status").eq("user_id", user.id).eq("recorrente", true).eq("is_parcelada", false);
    // Parcelamentos: cada instance tem amount + due_date; agregamos pelo range
    const instQ = supabase.from("installment_instances" as any).select("amount,due_date,despesas(tipo_parcelamento)").eq("user_id", user.id).gte("due_date", start).lte("due_date", end);
    const pq = supabase.from("profiles").select("nome_pessoa1,nome_pessoa2,foto_pessoa1,foto_pessoa2,vinculo_pessoa2").eq("user_id", user.id).maybeSingle();
    const invq = supabase.from("investimentos_financeiros").select("*").eq("user_id", user.id).limit(1000);
    const bensq = supabase.from("investimentos_nao_financeiros").select("*").eq("user_id", user.id).limit(1000);
    const aposentq = supabase.from("aposentadoria").select("*").eq("user_id", user.id).maybeSingle();
    const empq = supabase.from("empresas_usuario").select("*").eq("user_id", user.id).maybeSingle();
    // Fetch ALL active companies — was .limit(1), ignored 2nd+ companies.
    // Filtered by period (was unfiltered before — distorted negocioLanc.length>=10 gate)
    const negq = fetchAllCompaniesTransactions(user.id, start, end).then(data => ({ data }));
    const snapq = supabase.from("portfolio_snapshots").select("month_ref,total_value").eq("user_id", user.id).order("month_ref", { ascending: true });

    if (responsavelFilter) {
      rq = rq.eq("responsavel", responsavelFilter);
      dq = dq.eq("responsavel", responsavelFilter);
      eq = eq.eq("responsavel", responsavelFilter);
      rqRec = rqRec.eq("responsavel", responsavelFilter);
      dqRec = dqRec.eq("responsavel", responsavelFilter);
    }

    const [r, d, e, p, inv, bensRes, aposentRes, empRes, negResResult, snapRes, rqRecRes, dqRecRes, instRes] = await Promise.all([rq, dq, eq, pq, invq, bensq, aposentq, empq, negq, snapq, rqRec, dqRec, instQ]);

    // Se as consultas centrais falharam, sinaliza erro em vez de renderizar zeros como se fossem dados reais.
    if (r.error || d.error || e.error) {
      throw r.error || d.error || e.error;
    }

    setAposentData(aposentRes.data || null);
    setEmpresaData(empRes.data || null);
    setHasEmpresa(!!empRes.data);
    // Normalize business_transactions to legacy format for dashboard cards
    const rawNeg = (negResResult as any)?.data || [];
    const normalizedNeg = rawNeg.map((t: any) => ({
      tipo: t.direction === "in" ? "entrada" : "saida",
      valor: Number(t.amount || 0),
      data: t.date,
    }));
    setNegocioLanc(normalizedNeg);
    setPortfolioSnapshots((snapRes.data || []).map((s: any) => ({ month_ref: s.month_ref, total_value: Number(s.total_value || 0) })));

    const receitas = projectRecurringInRange(
      (r.data as any[]) || [],
      (rqRecRes.data as any[]) || [],
      start, end
      // sem skip: receitas não têm feature de skip por enquanto
    );
    const despesasArr = projectRecurringInRange(
      (d.data as any[]) || [],
      (dqRecRes.data as any[]) || [],
      start, end,
      skippedKeys
    );
    const economiasArr = e.data || [];
    setRawReceitas(receitas);
    setRawDespesas(despesasArr);
    setRawEconomias(economiasArr);

    const totals = computeMonthTotals({
      despesas: despesasArr as any,
      instances: ((instRes as any)?.data || []) as any,
      receitas: receitas as any,
      economias: economiasArr as any,
    });
    setTotalReceitas(totals.totalReceitas);
    setTotalDespesas(totals.totalDespesas);
    setDespesaCorrente(totals.despesaCorrente);
    setTotalEconomias(totals.totalEconomias);
    setTotalFixas(totals.totalFixas);
    setTotalVariaveis(totals.totalVariaveis);
    setTotalParcelas(totals.totalParcelas);

    const invData = inv.data || [];
    setInvestimentos(invData);
    const bensData = bensRes.data || [];
    setBens(bensData);

    const totalFin = invData.reduce((s: number, x: any) => s + Number(x.valor_atual || x.valor || 0), 0);
    const totalBensLiq = bensData.reduce((s: number, x: any) => s + Number(x.valor || 0) - Number(x.divida_vinculada || 0), 0);
    setPatrimonioTotal(totalFin + totalBensLiq);

    setReservaAtivos(invData.filter((i: any) => i.is_reserva_emergencia));
    const cats = new Set(receitas.map((r: any) => r.categoria));
    setFontesDiversificadas(cats.size);
    setTemSeguros(false);

    if (p.data) {
      setNomePessoa1((p.data as any).nome_pessoa1 || "Pessoa 1");
      setNomePessoa2((p.data as any).nome_pessoa2 || "Pessoa 2");
      setFotoPessoa1((p.data as any).foto_pessoa1 || "");
      setFotoPessoa2((p.data as any).foto_pessoa2 || "");
      setVinculoPessoa2((p.data as any).vinculo_pessoa2 || "Cônjuge");
    }
    } catch (err) {
      logError("DashboardHome fetchData:", err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user, period, visaoPessoa, customRange, skippedKeys]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Lazy-load do emoji-picker quando o usuário abre o seletor (uma vez).
  useEffect(() => {
    if (emojiPickerOpen && !emojiMod) {
      import("emoji-picker-react").then(setEmojiMod).catch(() => {});
    }
  }, [emojiPickerOpen, emojiMod]);

  const saldo = totalReceitas - totalDespesas;
  const poupanca = totalReceitas > 0 ? (totalEconomias / totalReceitas) * 100 : 0;
  const grauCompromisso = totalReceitas > 0 ? ((totalDespesas + totalEconomias) / totalReceitas) * 100 : 0;

  const totalFinanceiro = investimentos.reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0);
  const totalBensLiq = bens.reduce((s: number, b: any) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0);
  const patrimonioTotalCalc = totalFinanceiro + totalBensLiq;

  const reservaTotal = reservaAtivos.reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0);
  // Calcula média mensal real a partir do período selecionado (evita meta distorcida quando user escolhe 3m/6m/12m)
  const monthsInRange = (() => {
    const s = new Date(dateRange.start + "T00:00:00");
    const e = new Date(dateRange.end + "T00:00:00");
    const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
    return Math.max(1, months);
  })();
  const mediaDespesasMensal = totalDespesas / monthsInRange;
  const metaReserva = Math.max(1, mediaDespesasMensal * 8);
  const reservaPct = metaReserva > 0 ? Math.min((reservaTotal / metaReserva) * 100, 100) : 0;
  const reservaMeses = mediaDespesasMensal > 0 ? reservaTotal / mediaDespesasMensal : 0;
  const objComProgresso = objetivos.filter((o: any) => Number(o.valor_objetivo) > 0);
  const objMedia = objComProgresso.length
    ? Math.round(objComProgresso.reduce((s: number, o: any) => s + Math.min((Number(o.valor_acumulado || 0) / Number(o.valor_objetivo)) * 100, 100), 0) / objComProgresso.length)
    : 0;

  // Business data for legacy components
  const negocioReceita = negocioLanc.filter((l: any) => l.tipo === "entrada").reduce((s: number, l: any) => s + Number(l.valor), 0);
  const negocioDespesa = negocioLanc.filter((l: any) => l.tipo === "saida").reduce((s: number, l: any) => s + Number(l.valor), 0);
  const negocioLucro = negocioReceita - negocioDespesa;
  const negocioMargem = negocioReceita > 0 ? (negocioLucro / negocioReceita) * 100 : 0;

  const empresaQualificada = hasEmpresa && (negocioLanc.length >= 10 || (!!empresaData?.nome_empresa && negocioLanc.length > 0));

  const achievements = useMemo(() => checkAchievements({
    reservaCompleta: reservaPct >= 100,
    mesesConsecutivos: 6,
    empresaMargemSaudavel: hasEmpresa && negocioMargem >= 20,
    aposentadoriaAlinhada: !!aposentData && Number(aposentData.poupanca_mensal || 0) > 0,
    mesesSemNegativo: saldo >= 0 ? 12 : 0,
    hasEmpresa,
    empresaQualificada,
  }), [reservaPct, hasEmpresa, negocioMargem, aposentData, saldo, empresaQualificada]);

  const proLaborePct = hasEmpresa && empresaData && negocioLucro > 0
    ? Number(empresaData.percentual_pro_labore || 0) : 0;

  const taxaRealMensal = useMemo(() => {
    if (!aposentData) return 0.004;
    const tn = Number(aposentData.taxa_nominal || 0.10);
    const inf = Number(aposentData.inflacao || 0.05);
    const real = ((1 + tn) / (1 + inf)) - 1;
    return real > 0 ? Math.pow(1 + real, 1 / 12) - 1 : 0.004;
  }, [aposentData]);

  // Legacy score dims for simulador (kept for backward compat)
  const classesInv = useMemo(() => new Set(investimentos.map((i: any) => i.classe)).size, [investimentos]);
  const scoreDims = useMemo<ScoreDimensions>(() => ({
    reservaEmergencia: atlasResult?.pillars.find(p => p.key === "reserva")?.score ?? 0,
    margemFinanceira: atlasResult?.pillars.find(p => p.key === "margem")?.score ?? 0,
    disciplinaControle: atlasResult?.pillars.find(p => p.key === "disciplina")?.score ?? 0,
    diversificacaoInv: atlasResult?.pillars.find(p => p.key === "alocacao")?.score ?? 0,
    planejamentoAposent: atlasResult?.pillars.find(p => p.key === "aposentadoria")?.score ?? 0,
    organizacaoEmpresa: atlasResult?.pillars.find(p => p.key === "empresa")?.score ?? 0,
    evolucaoPatrimonial: atlasResult?.pillars.find(p => p.key === "evolucao")?.score ?? 0,
  }), [atlasResult]);

  const recommendations = useMemo(() => generateRecommendations({
    reservaMeses: mediaDespesasMensal > 0 ? reservaTotal / mediaDespesasMensal : 0,
    margemPct: totalReceitas > 0 ? ((totalReceitas - totalDespesas) / totalReceitas) * 100 : 0,
    proLaborePct,
    investimentoMensal: totalEconomias,
    metaInvestMensal: aposentData ? Number(aposentData.poupanca_mensal || 0) : 0,
    hasEmpresa,
    scoreDims,
  }), [mediaDespesasMensal, reservaTotal, totalReceitas, totalDespesas, proLaborePct, totalEconomias, aposentData, hasEmpresa, scoreDims]);

  // Evolução Patrimonial chart — based on real portfolio_snapshots
  const evolChartData = useMemo(() => {
    if (portfolioSnapshots.length === 0) return [];
    return portfolioSnapshots.map(s => {
      const d = new Date(s.month_ref + "-15");
      return {
        mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        "Patrimônio Total": Math.round(s.total_value),
      };
    });
  }, [portfolioSnapshots]);

  const evolChartConfig = {
    "Patrimônio Total": { label: "Patrimônio Total", color: "hsl(var(--primary))" },
  };

  // Tendência Financeira — real monthly aggregation from fetched data
  const tendenciaData = useMemo(() => {
    const monthMap: Record<string, { receitas: number; despesas: number; economias: number }> = {};
    const addToMonth = (arr: any[], key: "receitas" | "despesas" | "economias") => {
      arr.forEach((item: any) => {
        const m = item.data?.substring(0, 7);
        if (!m) return;
        if (!monthMap[m]) monthMap[m] = { receitas: 0, despesas: 0, economias: 0 };
        monthMap[m][key] += Number(item.valor || 0);
      });
    };
    addToMonth(rawReceitas, "receitas");
    addToMonth(rawDespesas, "despesas");
    addToMonth(rawEconomias, "economias");
    return Object.entries(monthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([m, v]) => {
        const d = new Date(m + "-15");
        return { mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), ...v };
      });
  }, [rawReceitas, rawDespesas, rawEconomias]);

  const vulnScore = calcVulnerabilidade({ reservaAtual: reservaTotal, reservaMeta: metaReserva, totalDespesas, totalReceitas, patrimonioTotal: patrimonioTotalCalc, temSeguros, fontesDiversificadas });
  const vulnInfo = getVulnerabilidadeLabel(vulnScore);

  const getAvatarForVisao = (value: string) => {
    if (value === "pessoa1" && fotoPessoa1) return fotoPessoa1;
    if (value === "pessoa2" && fotoPessoa2) return fotoPessoa2;
    return null;
  };

  const showExpiredOverlay = accessState === "trial_expired" || accessState === "cancelled_grace";

  if (loading) return <DashboardSkeleton />;

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-base font-semibold">{t("dh.load_erro")}</p>
          <p className="text-sm text-muted-foreground">{t("onb.erro_desc")}</p>
        </div>
        <Button onClick={() => fetchData()} variant="outline">{t("dh.tentar")}</Button>
      </div>
    );
  }

  const dashboardContent = (
    <div className="space-y-8 animate-fade-in">
      {/* PlanBanner is rendered in DashboardLayout — not duplicated here */}
      {/* Hero mobile — saudação + Atlas Score */}
      <DashboardHero
        greetingName={greetingName}
        greetingEmoji={greetingEmoji}
        onEmojiSelect={setGreetingEmoji}
        score={atlasResult?.score ?? null}
        showVisaoFutura={acesso_organiza_2026}
        visaoFutura={visaoFutura}
        onVisaoFuturaChange={setVisaoFutura}
      />
      {/* Primeiros passos — ativação dos primeiros minutos */}
      <PrimeirosPassosCard
        hasReceita={totalReceitas > 0}
        hasDespesa={totalDespesas > 0}
        hasReserva={reservaTotal > 0}
        hasObjetivo={objetivos.length > 0}
        storageKey={`atlas:primeiros-passos:${user?.id ?? "anon"}`}
        visitKey={`atlas:primeiros-passos-visitados:${user?.id ?? "anon"}`}
      />
      {/* Header (desktop) — substituído pelo canopy no DashboardLayout */}
      <div className="hidden items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar className="h-10 w-10 flex-shrink-0">
            {activeAvatar ? <AvatarImage src={activeAvatar} alt={greetingName} /> : null}
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
              {greetingName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="text-2xl font-heading font-bold">
              {profileLoading ? (
                <Skeleton className="h-7 w-40 rounded-lg inline-block" />
              ) : (
                <>
                  Olá, {greetingName}!{" "}
                  <Popover open={emojiPickerOpen} onOpenChange={setEmojiPickerOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex items-center align-middle cursor-pointer hover:scale-125 transition-transform" title="Trocar emoji" aria-label="Trocar emoji">
                        {greetingEmoji === "❤️" ? (
                          <Heart className="h-6 w-6 text-destructive fill-destructive" />
                        ) : (
                          greetingEmoji
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 border-none shadow-xl" align="start" sideOffset={8}>
                      {emojiMod ? (
                        <emojiMod.default
                          onEmojiClick={(emojiData) => {
                            setGreetingEmoji(emojiData.emoji);
                            setEmojiPickerOpen(false);
                          }}
                          emojiStyle={emojiMod.EmojiStyle.NATIVE}
                          searchPlaceHolder="Buscar emoji..."
                          autoFocusSearch={false}
                          skinTonesDisabled
                          previewConfig={{ showPreview: false }}
                          width={320}
                          height={400}
                        />
                      ) : (
                        <div className="flex items-center justify-center" style={{ width: 320, height: 400 }}>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                </>
              )}
            </h1>
            <p className="text-muted-foreground/70 mt-0.5 text-sm font-body">{t("hero.subtitle")}</p>
          </div>
        </div>
        {acesso_organiza_2026 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Label htmlFor="visao-futura" className="text-xs text-muted-foreground font-body whitespace-nowrap">
              <Target className="h-3.5 w-3.5 inline mr-1" />Visão Futura
            </Label>
            <Switch id="visao-futura" checked={visaoFutura} onCheckedChange={setVisaoFutura} />
          </div>
        )}
      </div>

      {/* Banner de plano — primeiro card claro logo abaixo do canopy do hero */}
      <PlanBanner />

      {acesso_organiza_2026 && (
        <>
          {/* Period Chips */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-heading font-semibold bg-card border border-border/60 text-foreground shadow-sm hover:border-primary/50 transition-all">
                  <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>
                    {period === "custom" && customRange
                      ? `${format(customRange.from, "dd/MM")} – ${format(customRange.to, "dd/MM")}`
                      : t(periodOptions.find(o => o.value === period)?.label ?? "dh.per_current")}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[200px]">
                {periodOptions.map(o => (
                  o.value === "custom" ? (
                    <DropdownMenuItem key="custom" onSelect={(e) => { e.preventDefault(); setCustomPickerOpen(true); }} className={period === "custom" ? "text-primary font-semibold" : ""}>
                      {t(o.label)}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem key={o.value} onSelect={() => setPeriod(o.value)} className={period === o.value ? "text-primary font-semibold" : ""}>
                      {t(o.label)}
                    </DropdownMenuItem>
                  )
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover open={customPickerOpen} onOpenChange={setCustomPickerOpen}>
              <PopoverTrigger asChild><span className="sr-only" aria-hidden="true" /></PopoverTrigger>
              <PopoverContent className="w-auto p-3" align="start">
                <CalendarComponent
                  mode="range"
                  selected={customRange ? { from: customRange.from, to: customRange.to } : undefined}
                  onSelect={(range: any) => {
                    if (range?.from && range?.to) {
                      setCustomRange({ from: range.from, to: range.to });
                      setPeriod("custom");
                      setCustomPickerOpen(false);
                    }
                  }}
                  className="p-3 pointer-events-auto"
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Tríade financeira — Fluxo do mês · Próximos vencimentos · Sua vida financeira */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            {/* Fluxo do mês */}
            <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
              <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("dh.fluxo")}</div>
              <div className="flex items-end justify-between gap-3 mb-3">
                <div>
                  <div className="text-[11px] text-muted-foreground">{t("dh.saldo_periodo")}</div>
                  <div className="text-2xl font-heading font-bold text-foreground">{fmt(totalReceitas - totalDespesas)}</div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1.5"><span className="w-2 h-2 rounded-full bg-success inline-block" />{t("dh.receitas")} <b className="text-foreground ml-0.5">{fmt(totalReceitas)}</b></div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-end gap-1.5"><span className="w-2 h-2 rounded-full bg-muted-foreground/50 inline-block" />{t("dh.despesas")} <b className="text-foreground ml-0.5">{fmt(despesaCorrente)}</b></div>
                </div>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden flex">
                <div className="bg-success h-full" style={{ flexGrow: totalReceitas || 0 }} />
                <div className="bg-muted-foreground/50 h-full" style={{ flexGrow: despesaCorrente || 0 }} />
              </div>
              {/* Extras desktop: Economias + Taxa de Poupança */}
              <div className="hidden lg:block mt-3 pt-3 border-t border-border/40 space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1.5"><PiggyBank className="h-3.5 w-3.5 text-info" />{t("dh.economias")}</span>
                  <b className="text-foreground">{fmt(totalEconomias)}</b>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-warning" />{t("dh.taxa_poupanca")}</span>
                  <b className={poupanca >= 20 ? "text-success" : "text-warning"}><PercentValue value={poupanca} /></b>
                </div>
              </div>
              {/* Composição das despesas (desktop) — Fixos · Variáveis · Parcelamentos */}
              <div className="hidden lg:block mt-3 pt-3 border-t border-border/40">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground/60 font-heading font-semibold mb-2">{t("dh.composicao")}</div>
                <div className="space-y-2">
                  {[
                    { label: "Fixos", value: totalFixas, color: "bg-primary" },
                    { label: "Variáveis", value: totalVariaveis, color: "bg-accent" },
                    { label: "Parcelamentos", value: totalParcelas, color: "bg-info" },
                  ].map(c => (
                    <div key={c.label}>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">{c.label}</span>
                        <b className="text-foreground">{fmt(c.value)}</b>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${c.color}`} style={{ width: `${despesaCorrente > 0 ? (c.value / despesaCorrente) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Próximos vencimentos */}
            <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
              <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("dh.vencimentos")}</div>
              {vencimentos.length === 0 ? (
                <div className="text-xs text-muted-foreground py-1">{t("dh.venc_vazio")}</div>
              ) : (
                <div className="space-y-2.5">
                  {vencimentos.map(v => {
                    const d = new Date(v.date);
                    const dia = String(d.getUTCDate()).padStart(2, "0");
                    const mes = d.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "");
                    return (
                      <div key={v.id} className="flex items-center gap-3">
                        <div className={`flex flex-col items-center justify-center w-11 h-11 rounded-xl shrink-0 ${v.isToday ? "bg-primary/10 text-primary" : "bg-muted text-foreground"}`}>
                          <span className="text-sm font-bold leading-none">{dia}</span>
                          <span className="text-[9px] uppercase">{mes}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-foreground truncate">{v.descricao}</div>
                          <div className="text-[11px] text-muted-foreground truncate">{v.detalhe}{v.isToday ? " · vence hoje" : ""}</div>
                        </div>
                        <div className="text-sm font-semibold text-foreground shrink-0">{fmt(v.valor)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              <button
                onClick={() => navigate("/dashboard/calendario")}
                className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs font-heading font-semibold text-primary hover:opacity-80 transition-opacity"
              >
                Ver todos os pagamentos <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* 3ª coluna: Sua vida financeira/Reserva (topo) + Vulnerabilidade (desktop, embaixo) */}
            <div className="space-y-3">
              {acesso_planejamento_360 ? (
                <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
                  <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("dh.vida_financeira")}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-[11px] text-muted-foreground">{t("dh.investido")}</div>
                      <div className="text-base font-heading font-bold text-foreground">{fmt(invInvestido)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">{t("dh.rentabilidade")}</div>
                      <div className={`text-base font-heading font-bold flex items-center gap-0.5 ${invRent >= 0 ? "text-success" : "text-destructive"}`}>
                        {invRent >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                        {invRent.toFixed(1)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-muted-foreground">{t("dh.planejamento")}</div>
                      <div className="text-base font-heading font-bold text-foreground">{objMedia}%</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
                  <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t("dh.reserva")}</div>
                  <div className="flex items-end gap-2">
                    <div className="text-2xl font-heading font-bold text-foreground">{reservaMeses.toFixed(1)}</div>
                    <div className="text-xs text-muted-foreground mb-1">{t("dh.meses_cobertos")}</div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-2">
                    <div className="h-full bg-primary" style={{ width: `${Math.min((reservaMeses / 8) * 100, 100)}%` }} />
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">{t("dh.acumulado")} <b className="text-foreground">{fmt(reservaTotal)}</b> · meta 8 meses</div>
                </div>
              )}

              {/* Índice de Vulnerabilidade — desktop (empilhado na 3ª coluna) */}
              {acesso_organiza_2026 && (
                <div className="hidden lg:block">
                  <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
                    <CardContent className="pt-4 pb-4 px-5">
                      <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1">{t("dh.vulnerabilidade")} <InfoTooltip config={INFO_CONFIGS.vulnerabilidade} /></div>
                      <div className="flex items-center gap-4">
                        <div className="relative w-16 h-16 flex-shrink-0">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                            <circle cx="50" cy="50" r="42" fill="none" stroke={`hsl(var(--${vulnScore > 60 ? "success" : vulnScore > 30 ? "warning" : "destructive"}))`}
                              strokeWidth="8" strokeDasharray={`${(vulnScore / 100) * 264} 264`} strokeLinecap="round" />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className={`text-lg font-heading font-bold ${vulnInfo.color}`}>{vulnScore}</span>
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-heading font-bold ${vulnInfo.color}`}>{t(vulnInfo.label)}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {vulnScore <= 30 && "Riscos significativos na sua situação."}
                            {vulnScore > 30 && vulnScore <= 60 && "Proteção em construção. Continue evoluindo."}
                            {vulnScore > 60 && vulnScore <= 80 && "Boa proteção! Falta pouco pra uma posição sólida."}
                            {vulnScore > 80 && "Excelente! Posição financeira muito resiliente."}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </div>
          </div>

          {/* LINHA 2 — Planejamento (desktop): Objetivos · Patrimônio · Aposentadoria, acima do Atlas Score */}
          {acesso_planejamento_360 ? (
            <div className="hidden lg:grid grid-cols-3 gap-3">
              {/* Seus objetivos */}
              <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
                <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><Target className="h-3.5 w-3.5 text-primary" />{t("dh.objetivos")}</div>
                {objComProgresso.length === 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">{t("dh.sem_objetivo")}</p>
                    <button onClick={() => navigate("/dashboard/objetivos-de-vida")} className="text-[11px] text-primary font-semibold hover:underline">{t("dh.criar_objetivo")}</button>
                  </>
                ) : (
                  <div className="space-y-2.5">
                    {objComProgresso.slice(0, 3).map((o: any, i: number) => {
                      const pct = Math.min((Number(o.valor_acumulado || 0) / Number(o.valor_objetivo)) * 100, 100);
                      return (
                        <div key={i}>
                          <div className="flex justify-between text-[11px] mb-1"><span className="text-foreground truncate mr-2">{o.nome}</span><span className="text-muted-foreground">{pct.toFixed(0)}%</span></div>
                          <Progress value={pct} className="h-1.5" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {/* Patrimônio */}
              <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
                <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><Landmark className="h-3.5 w-3.5 text-primary" />{t("dh.patrimonio")}</div>
                <div className="text-2xl font-heading font-bold text-foreground mb-2">{fmt(patrimonioTotalCalc)}</div>
                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex justify-between"><span>{t("dh.investido")}</span><b className="text-foreground">{fmt(totalFinanceiro)}</b></div>
                  <div className="flex justify-between"><span>{t("dh.bens")}</span><b className="text-foreground">{fmt(totalBensLiq)}</b></div>
                </div>
              </div>
              {/* Aposentadoria — gap real de renda (mesma fórmula da página) */}
              <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
                <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5"><Umbrella className="h-3.5 w-3.5 text-info" />{t("dh.aposentadoria")}</div>
                {!apHasData ? (
                  <>
                    <p className="text-xs text-muted-foreground mb-2">{t("dh.config_apos")}</p>
                    <button onClick={() => navigate("/dashboard/aposentadoria")} className="text-[11px] text-primary font-semibold hover:underline">{t("dh.configurar")}</button>
                  </>
                ) : apGap > 0 ? (
                  <>
                    <div className="text-[11px] text-muted-foreground">{t("dh.faltam_mes")}</div>
                    <div className="text-2xl font-heading font-bold text-foreground">{fmt(apGap)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 mb-2">para a renda desejada de {fmt(apRendaDesejada)}</div>
                    <button onClick={() => navigate("/dashboard/aposentadoria")} className="text-[11px] text-primary font-semibold hover:underline">{t("dh.ver_projecao")}</button>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-heading font-bold text-success mb-1">{t("dh.renda_cobre")}</p>
                    <button onClick={() => navigate("/dashboard/aposentadoria")} className="text-[11px] text-primary font-semibold hover:underline">{t("dh.ver_projecao")}</button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="hidden lg:block rounded-2xl border border-border/60 bg-card p-5 shadow-sm text-center">
              <div className="w-10 h-10 rounded-xl bg-primary/10 grid place-items-center mx-auto mb-3"><Lock className="h-5 w-5 text-primary" /></div>
              <div className="text-sm font-heading font-bold text-foreground mb-1">{t("dh.plan_completo")}</div>
              <p className="text-xs text-muted-foreground mb-3">Objetivos, patrimônio e aposentadoria num só lugar — no Atlas Pro.</p>
              <button onClick={() => navigate("/dashboard/planos")} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-heading font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity">{t("dh.conhecer_pro")} <ArrowRight className="h-3.5 w-3.5" /></button>
            </div>
          )}

          {/* LINHA 3 — Atlas Score (+ Visão Futura/Radar) · engajamento (2 colunas) */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 items-start">
            {/* ── Coluna principal ── */}
            <div className="space-y-6 min-w-0">
              {atlasResult && (
                <AtlasScore
                  result={atlasResult}
                  loading={atlasLoading}
                  recommendations={recommendations}
                  achievements={achievements}
                  scoreInputs={atlasInputs ?? undefined}
                  evolution3m={evolution3m}
                />
              )}

              {(() => {
                const radar = atlasResult ? (
                  <div>
                    <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1 flex items-center gap-1">{t("dh.radar_vida")} <InfoTooltip config={INFO_CONFIGS.radar_financeiro} /></h2>
                    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
                      <CardContent className="pt-5 pb-4 px-5">
                        <div className="flex items-center gap-2 mb-1">
                          <Shield className="h-4 w-4 text-primary" />
                          <h2 className="font-heading font-bold text-sm">{t("dh.radar_fin")}</h2>
                        </div>
                        <p className="text-[10px] text-muted-foreground/50 mb-4">{t("dh.radar_base")}</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { label: "Reserva", value: atlasResult.pillars.find(p => p.key === "reserva")?.score ?? 0, color: "text-info" },
                            { label: "Disciplina", value: atlasResult.pillars.find(p => p.key === "disciplina")?.score ?? 0, color: "text-success" },
                            { label: "Controle de gastos", value: atlasResult.pillars.find(p => p.key === "margem")?.score ?? 0, color: "text-warning" },
                            { label: "Diversificação", value: atlasResult.pillars.find(p => p.key === "alocacao")?.score ?? 0, color: "text-primary" },
                            { label: "Aposentadoria", value: atlasResult.pillars.find(p => p.key === "aposentadoria")?.score ?? 0, color: "text-accent" },
                          ].map(dim => (
                            <div key={dim.label} className="text-center p-3 rounded-xl border border-border/30 bg-muted/20">
                              <div className="relative w-14 h-14 mx-auto mb-2">
                                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="8"
                                    strokeDasharray={`${(dim.value / 100) * 264} 264`} strokeLinecap="round" />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <span className={`text-sm font-heading font-bold ${dim.color}`}>{dim.value}</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground/70 font-medium">{dim.label}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : null;
                return visaoFutura ? (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                    <VisaoFutura periodStart={dateRange.start} periodEnd={dateRange.end} periodLabel={t(periodOptions.find(o => o.value === period)?.label || "dh.periodo_selecionado")} />
                    {radar}
                  </div>
                ) : radar;
              })()}
            </div>

            {/* ── Coluna lateral — engajamento ── */}
            <div className="space-y-4 min-w-0">
              {/* Precisa da sua atenção */}
              {recommendations.length > 0 && (
                <div>
                  <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">{t("dh.atencao")}</h2>
                  <div className="space-y-2">
                    {recommendations.slice(0, 3).map((rec, i) => (
                      <Card key={i} className="border-border/30 shadow-none bg-card/60 rounded-2xl">
                        <CardContent className="pt-4 pb-3 px-4">
                          <div className="flex items-start gap-2">
                            <Zap className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-foreground/80 leading-relaxed">{rec.text}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {/* Continue de onde parou */}
              <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
                <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide mb-3">{t("dh.continue")}</div>
                {courseDone > 0 && featuredCourse ? (
                  <>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 grid place-items-center flex-shrink-0"><GraduationCap className="h-5 w-5 text-primary" /></div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{featuredCourse.title}</div>
                        <div className="text-[11px] text-muted-foreground">Aula {Math.min(courseDone + 1, courseTotal)} de {courseTotal}</div>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-3">
                      <div className="h-full bg-primary" style={{ width: `${courseTotal ? (courseDone / courseTotal) * 100 : 0}%` }} />
                    </div>
                    <button onClick={() => navigate(`/dashboard/cursos/${featuredCourse.slug}`)} className="w-full flex items-center justify-center gap-1.5 text-xs font-heading font-semibold text-primary hover:opacity-80 transition-opacity">
                      Retomar <Play className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-3">Você ainda não começou nenhuma trilha. Dê o primeiro passo.</p>
                    <button onClick={() => navigate("/dashboard/comecar")} className="w-full flex items-center justify-center gap-1.5 text-xs font-heading font-semibold text-primary hover:opacity-80 transition-opacity">
                      Comece por aqui <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>

              {/* Pergunte ao Atlas — com o aviso/insight do Atlas integrado acima do input */}
              <div className="rounded-2xl bg-card border border-border/60 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <div className="text-[11px] font-heading font-semibold text-muted-foreground uppercase tracking-wide">{t("dh.pergunte")}</div>
                </div>
                {acesso_organiza_2026 && <InsightRapido inline />}
                <button
                  onClick={() => onOpenChat?.()}
                  className="w-full text-left rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-sm text-muted-foreground hover:border-primary/50 transition-colors flex items-center justify-between gap-2"
                >
                  <span>{t("dh.pergunta_apos")}</span>
                  <Send className="h-4 w-4 text-primary flex-shrink-0" />
                </button>
              </div>
            </div>
          </div>

        </>
      )}

      {/* Tendência Financeira — full-width abaixo do command center */}
      {acesso_organiza_2026 && (
        <TendenciaFinanceiraChart data={tendenciaData} />
      )}

      {/* Patrimônio (mobile — desktop usa o card compacto do command center) */}
      {acesso_planejamento_360 && (
        <div className="lg:hidden">
          <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">{t("dh.patrimonio")}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl group hover:border-primary/20 transition-colors">
              <Link to="/dashboard/investimentos">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                    <p className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wide">{t("dh.investimentos")}</p>
                  </div>
                  <p className="text-xl font-heading font-bold">{loading ? "..." : <MoneyValue value={totalFinanceiro} />}</p>
                </CardContent>
              </Link>
            </Card>
            <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl group hover:border-primary/20 transition-colors">
              <Link to="/dashboard/bens-imoveis">
                <CardContent className="pt-4 pb-3 px-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Building2 className="h-3.5 w-3.5 text-warning" />
                    <p className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wide">{t("dh.bens_imoveis")}</p>
                  </div>
                  <p className="text-xl font-heading font-bold">{loading ? "..." : <MoneyValue value={totalBensLiq} />}</p>
                </CardContent>
              </Link>
            </Card>
            <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
              <CardContent className="pt-4 pb-3 px-4">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Landmark className="h-3.5 w-3.5 text-primary" />
                  <p className="text-[10px] text-muted-foreground/60 font-body uppercase tracking-wide">{t("dh.patrimonio_total")}</p>
                </div>
                <p className="text-xl font-heading font-bold">{loading ? "..." : <MoneyValue value={patrimonioTotalCalc} />}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Aposentadoria Preview */}
      {acesso_planejamento_360 && (() => {
        const ad = aposentData;
        if (!ad) return (
          <Card className="lg:hidden border-border/30 shadow-none bg-card/60 rounded-2xl">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center gap-2 mb-2">
                <Umbrella className="h-4 w-4 text-info" />
                <h2 className="font-heading font-bold text-sm">{t("dh.aposentadoria")}</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{t("dh.premissas_vazio")}</p>
              <Link to="/dashboard/aposentadoria" className="text-xs text-primary font-medium hover:underline">{t("dh.ver_projecao")}</Link>
            </CardContent>
          </Card>
        );
        const idadeAtualAp = Number(ad.idade_atual) || 30;
        const idadeAposAp = Number(ad.idade_aposentadoria) || 60;
        const expectVida = Number(ad.expectativa_vida) || 90;
        const poupMensal = Number(ad.poupanca_mensal) || 0;
        const taxaNom = Number(ad.taxa_nominal) || 0.10;
        const inflacaoAp = Number(ad.inflacao) || 0.05;
        const patFinAp = totalFinanceiro;
        const patBensAp = ad.incluir_bens ? totalBensLiq : 0;
        const patAtualAp = patFinAp + patBensAp;
        const taxaRealAnualAp = ((1 + taxaNom) / (1 + inflacaoAp)) - 1;
        const taxaRealMensalAp = taxaRealAnualAp > 0 ? Math.pow(1 + taxaRealAnualAp, 1 / 12) - 1 : 0.0001;
        const mesesAte = Math.max(0, (idadeAposAp - idadeAtualAp) * 12);
        const mesesPos = Math.max(0, (expectVida - idadeAposAp) * 12);
        const patAposentadoria = mesesAte > 0 ? FV(taxaRealMensalAp, mesesAte, -poupMensal, -patAtualAp) : patAtualAp;
        const patFinal = mesesPos > 0 ? FV(taxaRealMensalAp, mesesPos, 0, -patAposentadoria) : patAposentadoria;

        return (
          <div className="lg:hidden">
            <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">{t("dh.aposentadoria")}</h2>
            <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-2 mb-1">
                  <Umbrella className="h-4 w-4 text-info" />
                  <h2 className="font-heading font-bold text-sm">{t("dh.cenario_realidade")}</h2>
                </div>
                <p className="text-xs text-muted-foreground mb-4">Projeção mantendo sua poupança mensal atual.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">{t("dh.poupanca_mensal")}</p>
                    <p className="text-lg font-heading font-bold"><MoneyValue value={poupMensal} /></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">Patrimônio aos {idadeAposAp} anos</p>
                    <p className="text-lg font-heading font-bold text-primary"><MoneyValue value={patAposentadoria} /></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">Patrimônio aos {expectVida} anos</p>
                    <p className="text-lg font-heading font-bold text-success"><MoneyValue value={patFinal} /></p>
                  </div>
                </div>
                <Link to="/dashboard/aposentadoria" className="text-xs text-primary font-medium hover:underline">{t("dh.ver_projecao")}</Link>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Reserva de Emergência (mobile — desktop usa o card compacto do command center) */}
      {acesso_planejamento_360 && (
        <div className="lg:hidden">
          <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1 flex items-center gap-1">{t("dh.reserva")} <InfoTooltip config={INFO_CONFIGS.reserva_emergencia} /></h2>
          <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">{t("dh.meta_ideal")}</p>
                  <p className="text-lg font-heading font-bold"><MoneyValue value={metaReserva} /></p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">{t("dh.acumulado")}</p>
                  <p className="text-lg font-heading font-bold text-success"><MoneyValue value={reservaTotal} /></p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mb-1">% Atingido</p>
                  <p className={`text-lg font-heading font-bold ${reservaPct >= 100 ? "text-success" : reservaPct >= 50 ? "text-warning" : "text-destructive"}`}>
                    <PercentValue value={reservaPct} decimals={0} />
                  </p>
                </div>
              </div>
              <Progress value={reservaPct} className="h-3 mb-4" />
              {reservaAtivos.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">{t("dh.ativos_reserva")}</p>
                  {reservaAtivos.map((a: any) => (
                    <div key={a.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 text-sm">
                      <span className="flex items-center gap-2">🐷 {a.nome}</span>
                      <span className="font-medium"><MoneyValue value={Number(a.valor_atual || a.valor || 0)} /></span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/50 italic">{t("dh.sem_reserva")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Índice de Vulnerabilidade (mobile — desktop fica na 1ª linha, 3ª coluna) */}
      {acesso_organiza_2026 && (
        <div className="lg:hidden">
          <h2 className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1 flex items-center gap-1">{t("dh.indice_vuln")} <InfoTooltip config={INFO_CONFIGS.vulnerabilidade} /></h2>
          <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
            <CardContent className="pt-5 pb-4 px-5">
              <p className="text-xs text-muted-foreground mb-4">{t("dh.vuln_desc")}</p>
              <div className="flex items-center gap-6">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={`hsl(var(--${vulnScore > 60 ? "success" : vulnScore > 30 ? "warning" : "destructive"}))`}
                      strokeWidth="8" strokeDasharray={`${(vulnScore / 100) * 264} 264`} strokeLinecap="round" />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xl font-heading font-bold ${vulnInfo.color}`}>{vulnScore}</span>
                  </div>
                </div>
                <div>
                  <p className={`text-sm font-heading font-bold ${vulnInfo.color}`}>{t(vulnInfo.label)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {vulnScore <= 30 && "Atenção: sua situação financeira apresenta riscos significativos."}
                    {vulnScore > 30 && vulnScore <= 60 && "Sua proteção financeira está em construção. Continue evoluindo."}
                    {vulnScore > 60 && vulnScore <= 80 && "Boa proteção! Falta pouco para uma posição sólida."}
                    {vulnScore > 80 && "Excelente! Sua posição financeira é muito resiliente."}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Comunidade do Atlas no WhatsApp */}
      <a
        href="https://chat.whatsapp.com/Ei3DaA0OIFH6UasHWaMrfR"
        target="_blank"
        rel="noopener noreferrer"
        className="block group"
        aria-label="Entrar na comunidade do Atlas no WhatsApp"
      >
        <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl transition-colors hover:bg-card/80 hover:border-[#25D366]/40">
          <CardContent className="py-4 px-5 flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-[#25D366]/15 flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-6 h-6 fill-[#25D366]" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.045 0 5.463 0 .104 5.359.101 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.652a11.882 11.882 0 005.71 1.454h.005c6.585 0 11.946-5.359 11.949-11.893a11.821 11.821 0 00-3.479-8.46" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-heading font-bold">{t("dh.wpp_titulo")}</p>
              <p className="text-xs text-muted-foreground">{t("dh.wpp_sub")}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground flex-shrink-0 transition-colors" />
          </CardContent>
        </Card>
      </a>

      {/* Upgrade CTA — footer */}
      <UpgradeCTA />
    </div>
  );

  if (showExpiredOverlay) {
    return <DashboardTrialExpiredOverlay>{dashboardContent}</DashboardTrialExpiredOverlay>;
  }

  return dashboardContent;
};

export default DashboardHome;
