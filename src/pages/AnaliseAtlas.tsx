import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOrganiza } from "@/hooks/useOrganiza";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import PlanGate from "@/components/PlanGate";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import type { VisaoPessoa } from "@/hooks/useOrganiza";
import { getPeriodConfig, PERIOD_OPTIONS, type PeriodoAnalise } from "@/lib/periodConfig";
import { monthLabelFromRef } from "@/lib/date";
import {
  Target, Wallet, ShieldCheck, Zap, Mountain, LineChart as LineChartIcon,
  Award, Filter,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";

const now = new Date();
const currentMesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(now.getFullYear(), i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
});

const SectionTitle = ({ icon: Icon, label }: { icon: any; label: string }) => (
  <div className="flex items-center gap-2">
    <Icon className="h-4 w-4 text-primary/60" />
    <p className="text-[10px] uppercase tracking-[0.15em] font-heading font-bold text-muted-foreground">{label}</p>
    <div className="flex-1 h-px bg-border/40" />
  </div>
);

const AnaliseAtlasContent = () => {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const { view: householdView } = useHouseholdView();
  const visaoPessoa: VisaoPessoa = householdView as VisaoPessoa;
  const [mesAno, setMesAno] = useState(currentMesAno);
  const [periodo, setPeriodo] = useState<PeriodoAnalise>("mes");
  const periodCfg = useMemo(() => getPeriodConfig(periodo, mesAno), [periodo, mesAno]);
  const org = useOrganiza(mesAno, visaoPessoa);

  // ═══ Data fetches para cruzamentos 360 ═══
  const [reservaTotal, setReservaTotal] = useState(0);
  const [rendaPassiva, setRendaPassiva] = useState(0);
  const [investimentosTotal, setInvestimentosTotal] = useState(0);
  const [objetivos, setObjetivos] = useState<any[]>([]);
  const [aportes, setAportes] = useState<any[]>([]);
  const [aposentadoriaPlan, setAposentadoriaPlan] = useState<any>(null);
  const [scoreHistory, setScoreHistory] = useState<any[]>([]);
  const [indicadores, setIndicadores] = useState<any[]>([]);
  const [summariesHist, setSummariesHist] = useState<any[]>([]);

  // Main data — user-scoped tables (safe in Promise.all)
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("investimentos_financeiros").select("valor_atual,valor,is_reserva_emergencia,tipo").eq("user_id", user.id),
      supabase.from("investimentos_nao_financeiros").select("valor_renda,gera_renda,valor").eq("user_id", user.id),
      supabase.from("objetivos").select("*").eq("user_id", user.id),
      supabase.from("aportes_objetivos").select("*").eq("user_id", user.id),
      supabase.from("aposentadoria").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("atlas_score_snapshots").select("*").eq("user_id", user.id).order("created_at", { ascending: true }).limit(12),
      supabase.from("monthly_financial_summaries").select("*").eq("user_id", user.id).order("month_ref", { ascending: true }).limit(24),
    ]).then(([invFin, invNao, objs, aports, apos, scores, sums]) => {
      const fin = invFin.data || [];
      setReservaTotal(fin.filter((i: any) => i.is_reserva_emergencia).reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0));
      setInvestimentosTotal(fin.reduce((s: number, i: any) => s + Number(i.valor_atual || i.valor || 0), 0));
      setRendaPassiva((invNao.data || []).filter((b: any) => b.gera_renda).reduce((s: number, b: any) => s + Number(b.valor_renda || 0), 0));
      setObjetivos(objs.data || []);
      setAportes(aports.data || []);
      setAposentadoriaPlan(apos.data);
      setScoreHistory(scores.data || []);
      setSummariesHist(sums.data || []);
    });
  }, [user]);

  // indicadores_economicos — public table, isolated so RLS errors don't break the page
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("indicadores_economicos")
          .select("*")
          .order("data_referencia", { ascending: false })
          .limit(12);
        setIndicadores(data || []);
      } catch {
        setIndicadores([]);
      }
    })();
  }, []);

  // ═══ Médias do controle (últimos 6 meses) ═══
  const despesaMedia6m = useMemo(() => {
    if (summariesHist.length === 0) return org.totalDespesas;
    const last6 = summariesHist.slice(-6);
    return last6.reduce((s, m) => s + Number(m.total_despesas || 0), 0) / last6.length;
  }, [summariesHist, org.totalDespesas]);

  const receitaMedia6m = useMemo(() => {
    if (summariesHist.length === 0) return org.totalGanhos;
    const last6 = summariesHist.slice(-6);
    return last6.reduce((s, m) => s + Number(m.total_receitas || 0), 0) / last6.length;
  }, [summariesHist, org.totalGanhos]);

  const sobraMedia6m = receitaMedia6m - despesaMedia6m;

  // ═══ Period-filtered datasets ═══
  const scoreFiltered = useMemo(() => {
    if (periodCfg.isMonthly) return scoreHistory;
    return scoreHistory.filter((s: any) => {
      const d = new Date(s.created_at).toISOString().slice(0, 10);
      if (periodCfg.start && d < periodCfg.start) return false;
      if (d > periodCfg.end) return false;
      return true;
    });
  }, [scoreHistory, periodCfg]);

  const summariesFiltered = useMemo(() => {
    if (periodCfg.isMonthly) return summariesHist;
    return summariesHist.filter((s: any) => {
      const ref = String(s.month_ref || "");
      if (periodCfg.start && ref < periodCfg.start.slice(0, 7)) return false;
      if (ref > periodCfg.end.slice(0, 7)) return false;
      return true;
    });
  }, [summariesHist, periodCfg]);

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
            <Mountain className="h-6 w-6 text-primary" /> Análise Atlas
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

      {/* ═══ 1. Reserva vs Estilo de Vida ═══ */}
      <SectionTitle icon={ShieldCheck} label="Reserva de Emergência" />
      {(() => {
        const mesesCobertura = despesaMedia6m > 0 ? reservaTotal / despesaMedia6m : 0;
        const cresceDespesa = summariesHist.length >= 6
          && summariesHist.slice(-3).reduce((s, m) => s + Number(m.total_despesas || 0), 0) / 3
          > summariesHist.slice(-6, -3).reduce((s, m) => s + Number(m.total_despesas || 0), 0) / 3 * 1.05;
        const projDespesa12m = cresceDespesa ? despesaMedia6m * 1.15 : despesaMedia6m;
        const coberturaProj = projDespesa12m > 0 ? reservaTotal / projDespesa12m : 0;
        const color = mesesCobertura >= 6 ? "text-success" : mesesCobertura >= 3 ? "text-warning" : "text-destructive";
        return (
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" /> Sua reserva vai aguentar seu estilo de vida?
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Cruza sua reserva atual com a média real das suas despesas (últimos 6 meses).</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Hoje</p>
                  <p className={`text-2xl font-heading font-bold ${color}`}>{mesesCobertura.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">meses de cobertura</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Em 12 meses</p>
                  <p className="text-2xl font-heading font-bold text-foreground">{coberturaProj.toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">{cresceDespesa ? "se despesa cresce +15%" : "no ritmo atual"}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Meta 6 meses</p>
                  <p className="text-2xl font-heading font-bold text-primary">{fmt(despesaMedia6m * 6)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {reservaTotal >= despesaMedia6m * 6 ? "Atingida" : `Faltam ${fmt(despesaMedia6m * 6 - reservaTotal)}`}
                  </p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-heading font-bold text-primary">Leitura: </span>
                  {mesesCobertura < 3
                    ? "Sua reserva está abaixo do mínimo crítico (3 meses). Priorize construí-la antes de qualquer outro objetivo."
                    : mesesCobertura < 6
                    ? `Você tem ${mesesCobertura.toFixed(1)} meses. Para chegar aos 6 recomendados, faltam ${fmt(despesaMedia6m * 6 - reservaTotal)}.`
                    : `Reserva sólida em ${mesesCobertura.toFixed(1)} meses. Excedente pode ser realocado para investimentos de longo prazo.`}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ═══ 2. Independência Financeira ═══ */}
      <SectionTitle icon={Wallet} label="Independência Financeira" />
      {(() => {
        const pctIndep = receitaMedia6m > 0 ? (rendaPassiva / receitaMedia6m) * 100 : 0;
        const patrimNecessario = (receitaMedia6m * 12) / 0.04; // regra dos 4%
        const gap = patrimNecessario - investimentosTotal;
        return (
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" /> Você ganha enquanto dorme?
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Cruza sua renda passiva atual com sua receita total do controle.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                <div className="h-full bg-foreground/20" style={{ width: `${Math.max(0, 100 - Math.min(100, pctIndep))}%` }} />
                <div className="h-full bg-primary" style={{ width: `${Math.min(100, pctIndep)}%` }} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Renda passiva</p>
                  <p className="text-lg font-heading font-bold text-primary">{fmt(rendaPassiva)}</p>
                  <p className="text-[10px] text-muted-foreground">por mês</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Independência</p>
                  <p className="text-lg font-heading font-bold text-foreground">{pctIndep.toFixed(1)}%</p>
                  <p className="text-[10px] text-muted-foreground">do custo de vida</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Falta</p>
                  <p className="text-lg font-heading font-bold text-primary">{fmt(Math.max(0, gap))}</p>
                  <p className="text-[10px] text-muted-foreground">em ativos (regra 4%)</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                <p className="text-xs text-foreground leading-relaxed">
                  <span className="font-heading font-bold text-primary">Leitura: </span>
                  {pctIndep < 5
                    ? "Sua independência financeira está começando. Focar em ativos geradores de renda acelera esse indicador."
                    : pctIndep < 50
                    ? `Você já cobriria ${pctIndep.toFixed(0)}% do seu custo de vida sem trabalhar. Mantenha o ritmo de aportes.`
                    : `Estágio avançado: ${pctIndep.toFixed(0)}% do seu custo de vida já é coberto por renda passiva.`}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* ═══ 3. Metas vs Realidade ═══ */}
      <SectionTitle icon={Target} label="Progresso dos Objetivos" />
      {objetivos.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="py-8 text-center">
            <Target className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Você ainda não tem objetivos cadastrados.</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Vá em Planejamento &gt; Objetivos de Vida para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" /> Suas metas batem com sua realidade?
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Para cada objetivo: aporte necessário vs sua capacidade real.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {objetivos.map((obj: any) => {
              const aportesObj = aportes.filter((a: any) => a.objetivo_id === obj.id);
              const acumulado = aportesObj.reduce((s: number, a: any) => s + Number(a.valor), 0);
              const valorTotal = Number(obj.valor_objetivo || 0);
              const faltam = Math.max(0, valorTotal - acumulado);
              const pct = valorTotal > 0 ? (acumulado / valorTotal) * 100 : 0;
              const dataMeta = obj.data_objetivo ? new Date(obj.data_objetivo) : null;
              const mesesRestantes = dataMeta ? Math.max(1, Math.ceil((dataMeta.getTime() - Date.now()) / (1000 * 60 * 60 * 24 * 30))) : null;
              const aporteNecessario = mesesRestantes ? faltam / mesesRestantes : null;
              const aporteAtual = Number(obj.aporte_mensal || 0);
              const viavel = aporteNecessario ? aporteAtual >= aporteNecessario : false;
              return (
                <div key={obj.id} className="p-3 rounded-xl border border-border/50 bg-muted/20 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate flex-1">{obj.nome}</p>
                    <span className={`text-xs font-heading font-bold ${pct >= 100 ? "text-success" : "text-foreground"}`}>{pct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div><span className="text-muted-foreground">Acumulado: </span><span className="font-bold">{fmt(acumulado)}</span></div>
                    <div><span className="text-muted-foreground">Faltam: </span><span className="font-bold">{fmt(faltam)}</span></div>
                    {mesesRestantes && <div><span className="text-muted-foreground">Em: </span><span className="font-bold">{mesesRestantes}m</span></div>}
                  </div>
                  {aporteNecessario && (
                    <div className={`text-[11px] p-2 rounded ${viavel ? "bg-success/5 text-success" : "bg-destructive/5 text-destructive"}`}>
                      {viavel
                        ? `Viável: aporte atual de ${fmt(aporteAtual)} cobre a necessidade de ${fmt(aporteNecessario)}/mês.`
                        : `Gap: precisa ${fmt(aporteNecessario)}/mês, seu aporte está em ${fmt(aporteAtual)}. Diferença de ${fmt(aporteNecessario - aporteAtual)}.`}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ═══ 4. Aposentadoria × Dia a Dia ═══ */}
      {aposentadoriaPlan && (
        <>
          <SectionTitle icon={Mountain} label="Aposentadoria" />
          {(() => {
            const aporteNecessario = Number(aposentadoriaPlan.poupanca_mensal || 0);
            const sobraAtual = Math.max(0, sobraMedia6m);
            const gap = aporteNecessario - sobraAtual;
            const viavel = gap <= 0;
            return (
              <Card className="shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <Mountain className="h-4 w-4 text-primary" /> Sua aposentadoria cabe no seu mês?
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Cruza o aporte exigido pelo plano com sua sobra média mensal real.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Plano exige</p>
                      <p className="text-lg font-heading font-bold text-foreground">{fmt(aporteNecessario)}</p>
                      <p className="text-[10px] text-muted-foreground">por mês</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Você sobra</p>
                      <p className="text-lg font-heading font-bold text-foreground">{fmt(sobraAtual)}</p>
                      <p className="text-[10px] text-muted-foreground">média 6 meses</p>
                    </div>
                    <div className={`p-3 rounded-xl border text-center ${viavel ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"}`}>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">{viavel ? "Folga" : "Gap"}</p>
                      <p className={`text-lg font-heading font-bold ${viavel ? "text-success" : "text-destructive"}`}>{fmt(Math.abs(gap))}</p>
                      <p className="text-[10px] text-muted-foreground">{viavel ? "pode antecipar" : "precisa cortar ou ganhar mais"}</p>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-xs text-foreground leading-relaxed">
                      <span className="font-heading font-bold text-primary">Leitura: </span>
                      {viavel
                        ? `Seu plano está confortável. Você tem folga de ${fmt(Math.abs(gap))}/mês — pode aumentar o aporte e antecipar a meta, ou direcionar a sobra para outro objetivo.`
                        : `Seu plano exige ${fmt(aporteNecessario)}/mês mas sua sobra real é ${fmt(sobraAtual)}. Gap de ${fmt(gap)}/mês — revise o plano ou abra espaço no orçamento.`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </>
      )}

      {/* ═══ 5. Atlas Score com Trajetória ═══ */}
      {scoreFiltered.length >= 2 && (
        <>
          <SectionTitle icon={Award} label="Atlas Score" />
          {(() => {
            const first = scoreFiltered[0];
            const last = scoreFiltered[scoreFiltered.length - 1];
            const delta = Number(last.score || 0) - Number(first.score || 0);
            const chartData = scoreFiltered.map((s: any) => ({
              // Rotula pelo período do snapshot (period_end), não pelo created_at:
              // vários snapshots podem ser gravados no mesmo mês com períodos
              // diferentes, o que colapsava o eixo X num único mês ("mai.").
              // monthLabelFromRef faz split + dia 1 para evitar overflow/timezone.
              data: monthLabelFromRef(s.period_end || s.snapshot_date || s.created_at),
              score: Number(s.score || 0),
            }));
            return (
              <Card className="shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <Award className="h-4 w-4 text-primary" /> Trajetória do seu Atlas Score
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="data" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} />
                      <Tooltip
                        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                      />
                      <ReferenceLine y={70} stroke="hsl(var(--success))" strokeDasharray="4 4" strokeWidth={1} />
                      <Line type="monotone" dataKey="score" name="Score" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-xs text-foreground leading-relaxed">
                      <span className="font-heading font-bold text-primary">Leitura: </span>
                      {delta > 0
                        ? `Seu score subiu ${delta} pontos no período. Mantenha o padrão.`
                        : delta < 0
                        ? `Seu score caiu ${Math.abs(delta)} pontos. Revise os blocos desta página para entender o quê.`
                        : "Seu score está estável. Pequenas melhorias na taxa de poupança ou redução de parcelamentos podem destravar pontos."}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </>
      )}

      {/* ═══ 6. Impacto de Quitar Parcelamentos × Metas ═══ */}
      {org.totalParcelas > 0 && objetivos.length > 0 && (
        <>
          <SectionTitle icon={Zap} label="Impacto" />
          <Card className="shadow-soft">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Se você quitasse seus parcelamentos hoje
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">Simulação do ganho mensal redirecionado para suas metas.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                <p className="text-xs text-muted-foreground">Valor liberado por mês ao quitar</p>
                <p className="text-2xl font-heading font-bold text-primary mt-1">{fmt(org.totalParcelas)}</p>
              </div>
              <div className="space-y-2">
                {objetivos.slice(0, 3).map((obj: any) => {
                  const aportesObj = aportes.filter((a: any) => a.objetivo_id === obj.id);
                  const acumulado = aportesObj.reduce((s: number, a: any) => s + Number(a.valor), 0);
                  const faltam = Math.max(0, Number(obj.valor_objetivo || 0) - acumulado);
                  const aporteAtual = Number(obj.aporte_mensal || 0);
                  const mesesAntes = aporteAtual > 0 ? faltam / aporteAtual : Infinity;
                  const mesesDepois = (aporteAtual + org.totalParcelas) > 0 ? faltam / (aporteAtual + org.totalParcelas) : Infinity;
                  const ganhoMeses = Math.max(0, mesesAntes - mesesDepois);
                  if (!isFinite(ganhoMeses) || ganhoMeses < 1) return null;
                  return (
                    <div key={obj.id} className="flex items-center justify-between p-2 rounded border border-border/30 bg-background text-xs">
                      <span className="font-medium truncate">{obj.nome}</span>
                      <span className="text-success font-bold">−{ganhoMeses.toFixed(0)} meses</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ═══ 7. Inflação Pessoal vs IPCA ═══ */}
      {indicadores.length > 0 && summariesFiltered.length >= 6 && (
        <>
          <SectionTitle icon={LineChartIcon} label="Macro" />
          {(() => {
            const recent = summariesFiltered.slice(-3).reduce((s, m) => s + Number(m.total_despesas || 0), 0) / 3;
            const older = summariesFiltered.slice(-12, -9).reduce((s, m) => s + Number(m.total_despesas || 0), 0) / 3;
            const inflacaoPessoal = older > 0 ? ((recent - older) / older) * 100 : 0;
            // Column is "indicador", not "tipo" or "nome"
            const ipca = indicadores.find((i: any) =>
              (i.indicador || "").toUpperCase() === "IPCA" ||
              (i.indicador || "").toLowerCase().includes("ipca")
            );
            const ipcaValor = ipca ? Number(ipca.valor || 0) : null;
            return (
              <Card className="shadow-soft">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-heading flex items-center gap-2">
                    <LineChartIcon className="h-4 w-4 text-primary" /> Sua inflação pessoal vs mercado
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className={`grid gap-3 ${ipcaValor !== null ? "grid-cols-2" : "grid-cols-1"}`}>
                    <div className="p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">Sua inflação</p>
                      <p className={`text-lg font-heading font-bold ${inflacaoPessoal > (ipcaValor || 5) ? "text-destructive" : "text-foreground"}`}>
                        {inflacaoPessoal.toFixed(1)}%
                      </p>
                      <p className="text-[10px] text-muted-foreground">no período selecionado</p>
                    </div>
                    {ipcaValor !== null && (
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/30 text-center">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium mb-1">IPCA oficial</p>
                        <p className="text-lg font-heading font-bold text-foreground">{ipcaValor.toFixed(2)}%</p>
                        <p className="text-[10px] text-muted-foreground">12 meses</p>
                      </div>
                    )}
                  </div>
                  {ipcaValor !== null && inflacaoPessoal > ipcaValor && (
                    <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
                      <p className="text-xs text-foreground leading-relaxed">
                        <span className="font-heading font-bold text-destructive">Alerta: </span>
                        Seu custo de vida subiu {(inflacaoPessoal / ipcaValor).toFixed(1)}× mais que o IPCA. Investigue os picos nos últimos meses.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })()}
        </>
      )}
    </div>
  );
};

const FEATURE_CONFIG = {
  icon: Mountain,
  title: "Análise Atlas",
  subtitle: "Sua vida financeira em 360°, conectada",
  items: [
    "Sua reserva vai aguentar seu estilo de vida",
    "Você ganha dinheiro enquanto dorme?",
    "Suas metas batem com sua realidade",
    "Sua aposentadoria cabe no seu mês",
    "Trajetória do seu Atlas Score com causas",
    "Simulação: impacto de quitar parcelamentos nas metas",
    "Sua inflação pessoal vs IPCA oficial",
  ],
};

const AnaliseAtlas = () => (
  <PlanGate featureKey="relatorio_atlas" feature={FEATURE_CONFIG}>
    <AnaliseAtlasContent />
  </PlanGate>
);

export default AnaliseAtlas;
