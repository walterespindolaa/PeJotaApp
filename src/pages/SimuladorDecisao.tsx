import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useAtlasScore } from "@/hooks/useAtlasScore";
import { useExpenseSkips } from "@/hooks/useExpenseSkips";
import { type ScoreDimensions } from "@/lib/atlasIntelligence";
import { computeAtlasScore, type AtlasScoreInputs } from "@/lib/atlasScore";
import { runDecisionEngine, type DecisionContext, type DecisionResult } from "@/lib/financial_engine/decision_engine";
import { usePremissas } from "@/hooks/usePremissas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Calculator, ArrowRight, TrendingDown, TrendingUp, Info, Loader2,
  Home, Car, Plane, Baby, Briefcase, TrendingDown as IncomeDown,
  Umbrella, Sparkles, ShieldCheck, DollarSign, PiggyBank, BarChart3,
  Users, Eye, Coins,
} from "lucide-react";
import AIReportDisclaimer from "@/components/legal/AIReportDisclaimer";

const DECISION_TYPES = [
  {
    value: "comprar_imovel", label: "Comprar imóvel", icon: Home, color: "text-info", bg: "bg-info/10",
    description: "Simule o impacto de adquirir um imóvel. O PeJota calcula parcela (PMT com juros compostos), custo de oportunidade da entrada e impacto no fluxo mensal.",
    impactType: "Patrimônio, reserva e fluxo de caixa",
    valorLabel: "Valor total do imóvel",
    valorHint: "Informe o valor completo do imóvel que pretende comprar.",
    valorPlaceholder: "Ex: 500.000",
    prazoLabel: "Prazo do financiamento (meses)",
    prazoHint: "Quantos meses durará o financiamento.",
    prazoPlaceholder: "Ex: 360",
    prazoUnit: "meses",
  },
  {
    value: "trocar_carro", label: "Trocar carro", icon: Car, color: "text-amber-500", bg: "bg-amber-500/10",
    description: "Simule o impacto de trocar de veículo. O PeJota calcula depreciação anual, parcela de financiamento e custo de oportunidade da entrada.",
    impactType: "Patrimônio e reserva de emergência",
    valorLabel: "Valor total do veículo",
    valorHint: "Informe o preço completo do carro que pretende comprar.",
    valorPlaceholder: "Ex: 120.000",
    prazoLabel: "Prazo do financiamento (meses)",
    prazoHint: "Quantos meses durará o financiamento do veículo.",
    prazoPlaceholder: "Ex: 48",
    prazoUnit: "meses",
  },
  {
    value: "aumentar_padrao", label: "Aumento de padrão de vida", icon: TrendingUp, color: "text-primary", bg: "bg-primary/10",
    description: "Simule o que acontece se suas despesas mensais aumentarem. O PeJota calcula o impacto linear e o custo de oportunidade com juros compostos.",
    impactType: "Orçamento, poupança e objetivos",
    valorLabel: "Quanto a mais por mês?",
    valorHint: "Valor adicional que será acrescido às suas despesas mensais atuais.",
    valorPlaceholder: "Ex: 2.000",
    prazoLabel: "Por quantos meses?",
    prazoHint: "Durante quanto tempo esse aumento de despesa vai se manter.",
    prazoPlaceholder: "Ex: 12",
    prazoUnit: "meses",
  },
  {
    value: "viagem", label: "Viagem", icon: Plane, color: "text-success", bg: "bg-success/10",
    description: "Simule o impacto financeiro de uma viagem. O PeJota calcula o efeito na reserva e o custo de oportunidade do valor gasto (FV = PV × (1+r)^n).",
    impactType: "Reserva e patrimônio",
    valorLabel: "Custo total da viagem",
    valorHint: "Valor completo estimado incluindo passagens, hospedagem e gastos.",
    valorPlaceholder: "Ex: 15.000",
    prazoLabel: "Meses para pagar ou economizar",
    prazoHint: "Se vai parcelar ou juntar antes, quantos meses serão usados.",
    prazoPlaceholder: "Ex: 6",
    prazoUnit: "meses",
  },
  {
    value: "novo_filho", label: "Novo filho", icon: Baby, color: "text-pink-500", bg: "bg-pink-500/10",
    description: "Simule o impacto de ter um filho nas suas finanças. O PeJota projeta custo acumulado e o custo de oportunidade com FV = PMT × ((1+r)^n − 1) / r.",
    impactType: "Orçamento mensal e planejamento de longo prazo",
    valorLabel: "Aumento estimado de despesas mensais",
    valorHint: "Quanto a mais você estima gastar por mês com o novo filho.",
    valorPlaceholder: "Ex: 3.000",
    prazoLabel: "Fase de maior custo (meses)",
    prazoHint: "Quantos meses durará a fase de maior impacto financeiro.",
    prazoPlaceholder: "Ex: 36",
    prazoUnit: "meses",
  },
  {
    value: "empreender", label: "Empreender / abrir negócio", icon: Briefcase, color: "text-amber-600", bg: "bg-amber-600/10",
    description: "Simule o impacto de investir em um negócio próprio. O PeJota calcula saída de capital, reserva necessária e custo de oportunidade.",
    impactType: "Patrimônio, reserva e risco",
    valorLabel: "Investimento inicial necessário",
    valorHint: "Capital total que você precisará investir para começar o negócio.",
    valorPlaceholder: "Ex: 80.000",
    prazoLabel: "Período até gerar retorno (meses)",
    prazoHint: "Quantos meses até o negócio se pagar e parar de consumir reserva.",
    prazoPlaceholder: "Ex: 18",
    prazoUnit: "meses",
  },
  {
    value: "reduzir_renda", label: "Redução de renda", icon: IncomeDown, color: "text-destructive", bg: "bg-destructive/10",
    description: "Simule o que acontece se sua renda cair. O PeJota calcula o deficit mensal e quantos meses até esgotar a reserva.",
    impactType: "Margem, poupança e reserva",
    valorLabel: "Quanto sua renda vai diminuir por mês?",
    valorHint: "Valor que será reduzido da sua renda mensal atual.",
    valorPlaceholder: "Ex: 5.000",
    prazoLabel: "Por quantos meses?",
    prazoHint: "Duração estimada dessa redução de renda.",
    prazoPlaceholder: "Ex: 6",
    prazoUnit: "meses",
  },
  {
    value: "antecipar_aposentadoria", label: "Antecipar aposentadoria", icon: Umbrella, color: "text-info", bg: "bg-info/10",
    description: "Simule o impacto de parar de trabalhar antes do previsto. O PeJota calcula patrimônio necessário pela regra dos 4% e compara com seu patrimônio atual.",
    impactType: "Patrimônio projetado e sustentabilidade",
    valorLabel: "Renda mensal desejada na aposentadoria",
    valorHint: "Quanto você gostaria de receber por mês quando parar de trabalhar.",
    valorPlaceholder: "Ex: 10.000",
    prazoLabel: "Antecipar em quantos anos?",
    prazoHint: "Quantos anos antes da sua aposentadoria planejada você pretende parar.",
    prazoPlaceholder: "Ex: 5",
    prazoUnit: "anos",
  },
];

const SimuladorDecisao = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt } = usePrivacyFmt();

  const now = new Date();
  const periodStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];
  const [visaoPessoa, setVisaoPessoa] = useState<"pessoa1" | "pessoa2" | "casal">("casal");
  const { skips } = useExpenseSkips();
  const skippedKeys = useMemo(
    () => new Set(skips.map(s => `${s.template_id}:${s.month_ref}`)),
    [skips]
  );
  const { result: atlasResult, scoreInputs } = useAtlasScore({ userId: user?.id, periodStart, periodEnd, visaoPessoa, skippedKeys });

  const premissas = usePremissas();

  const atlasScore = atlasResult?.score ?? 0;
  const hasEmpresa = scoreInputs?.hasEmpresa ?? false;
  const reservaAtual = scoreInputs?.reservaTotal ?? 0;
  const despesasMensais = scoreInputs?.gastoMensalMedio3m ?? 0;
  const patrimonioAtual = scoreInputs?.plAtual ?? 0;
  // Poupanca cai pra margem (renda - despesa) quando o usuario nao registra economias.
  // Sem isso, simulacoes mostram "0 meses de atraso na aposentadoria" mesmo pra quem tem margem positiva.
  const aporteRegistrado = scoreInputs?.aporteMensalMedio3m ?? 0;
  const margemEstimada = Math.max(0, (scoreInputs?.receitaMensalMedia ?? 0) - despesasMensais);
  const poupancaMensal = aporteRegistrado > 0 ? aporteRegistrado : margemEstimada;
  const poupancaIsEstimated = aporteRegistrado === 0 && margemEstimada > 0;
  const taxaRealMensal = premissas.taxaRealMensal;

  // Keep dims for legacy compat but use scoreInputs for recalculation
  const dims: ScoreDimensions = useMemo(() => {
    if (!atlasResult) return { reservaEmergencia: 0, margemFinanceira: 0, disciplinaControle: 0, diversificacaoInv: 0, planejamentoAposent: 0, organizacaoEmpresa: 0, evolucaoPatrimonial: 0 };
    const p = (key: string) => atlasResult.pillars.find(pl => pl.key === key)?.score ?? 0;
    return {
      reservaEmergencia: p("reserva"), margemFinanceira: p("margem"), disciplinaControle: p("disciplina"),
      diversificacaoInv: p("diversificacao"), planejamentoAposent: p("aposentadoria"),
      organizacaoEmpresa: p("empresa"), evolucaoPatrimonial: p("evolucao"),
    };
  }, [atlasResult]);

  const [tipo, setTipo] = useState("comprar_imovel");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("12");
  const [aporteEmpreender, setAporteEmpreender] = useState("");
  const [engineResult, setEngineResult] = useState<DecisionResult | null>(null);
  const [scoreAfter, setScoreAfter] = useState<number | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{ veredito: string; razoes: string; impacto: string; recomendacao: string; raw: string } | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState(false);

  const rendaTotal = scoreInputs?.receitaMensalMedia || 0;
  const despesasTotal = scoreInputs?.gastoMensalMedio3m || 0;

  const [nomes, setNomes] = useState<{ p1: string; p2: string }>({ p1: "Pessoa 1", p2: "Pessoa 2" });

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("nome_pessoa1,nome_pessoa2").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setNomes({
            p1: (data as any).nome_pessoa1 || "Pessoa 1",
            p2: (data as any).nome_pessoa2 || "Pessoa 2",
          });
        }
      });
  }, [user]);

  const config = DECISION_TYPES.find(d => d.value === tipo) || DECISION_TYPES[0];
  const parsedValor = Number(valor.replace(/\D/g, "")) || 0;
  const rawPrazo = Number(prazo) || 12;
  const parsedPrazo = config.prazoUnit === "anos" ? rawPrazo * 12 : rawPrazo;

  const handleSimulate = () => {
    if (parsedValor <= 0) { toast({ title: "Informe um valor válido", variant: "destructive" }); return; }

    const ctx: DecisionContext = {
      reservaAtual,
      despesasMensais,
      patrimonioAtual,
      poupancaMensal,
      rendaTotal: rendaTotal || despesasMensais + poupancaMensal,
      taxaRealMensal,
    };

    const aporteMensal = tipo === "empreender" ? Number(aporteEmpreender.replace(/\D/g, "")) || 0 : 0;
    const result = runDecisionEngine(tipo, parsedValor, parsedPrazo, ctx, { aporteMensal });
    setEngineResult(result);

    let newScoreAfter = atlasScore;
    if (scoreInputs) {
      const newReserva = Math.max(0, reservaAtual + result.impactoReserva);
      const newInputs: AtlasScoreInputs = {
        ...scoreInputs,
        reservaTotal: newReserva,
        totalDespesas: scoreInputs.totalDespesas + (result.impactoMensal < 0 ? Math.abs(result.impactoMensal) : 0),
        plAtual: scoreInputs.plAtual + result.impactoPatrimonio,
      };
      const newResult = computeAtlasScore(newInputs);
      newScoreAfter = newResult.score;
      setScoreAfter(newScoreAfter);
    } else {
      setScoreAfter(atlasScore);
    }

    setAiAnalysis(null);
    setAiError(false);

    requestAiAnalysis(result, newScoreAfter);
  };

  const requestAiAnalysis = (resultOverride?: typeof engineResult, scoreOverride?: number) => {
    const result = resultOverride ?? engineResult;
    if (!result) return;
    const scoreA = scoreOverride ?? scoreAfter ?? atlasScore;
    setLoadingAI(true);
    setAiError(false);
    const mesesReserva = despesasMensais > 0 ? reservaAtual / despesasMensais : 0;

    supabase.functions.invoke("decision-simulator", {
      body: {
        simulationData: {
          tipoLabel: config.label, valor: parsedValor, prazo: parsedPrazo,
          rendaTotal, despesasTotal, poupancaMensal, patrimonioAtual, reservaAtual,
          mesesReserva, scoreBefore: atlasScore, scoreAfter: scoreA,
          impactoMensal: result.impactoMensal,
          impactoReserva: result.impactoReserva,
          impactoTotal: result.impactoTotal,
          impactoPatrimonio: result.impactoPatrimonio,
          custoOportunidade: result.custoOportunidade,
          impactoAposentadoriaMeses: result.impactoAposentadoriaMeses,
          memoriaCalculo: result.memoriaCalculo.join("\n"),
          // Contexto extra para IA cruzar com dados do usuario
          poupancaIsEstimated,
          rendaProjetadaApos: scoreInputs?.rendaProjetada || 0,
          rendaObjetivoApos: scoreInputs?.rendaObjetivo || 0,
          aposentModuloPreenchido: scoreInputs?.aposentModuloPreenchido || false,
          taxaRealAnualPct: Number((premissas.taxaRealAnual * 100).toFixed(2)),
          taxaNominalPct: premissas.taxaNominal,
          inflacaoPct: premissas.inflacao,
          hasEmpresa,
          empresaCaixa: scoreInputs?.empresaCaixa || 0,
          visaoPessoa,
        },
      },
    }).then(({ data, error }) => {
      if (error || !data?.analysis) {
        setAiError(true);
      } else {
        setAiAnalysis(data.analysis);
      }
      setLoadingAI(false);
    }).catch(() => {
      setAiError(true);
      setLoadingAI(false);
    });
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <AIReportDisclaimer />
      {/* 1. Header */}
      <div>
        <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" /> Simulador de Decisão
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Analise o impacto financeiro de grandes decisões com fórmulas reais: juros compostos, PMT, custo de oportunidade e regra dos 4%.
        </p>
        <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/40">
          <Users className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs text-muted-foreground">
            Este simulador utiliza a <span className="font-semibold text-foreground">visão geral da casa</span>, suas premissas econômicas e considera apenas o <span className="font-semibold text-foreground">patrimônio investido</span> (não inclui imóveis, veículos ou outros ativos).
          </p>
        </div>
      </div>

      {/* 2. Decision type cards */}
      <div>
        <h2 className="text-sm font-heading font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
          Tipo de decisão
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {DECISION_TYPES.map(d => (
            <Card
              key={d.value}
              className={`border transition-all cursor-pointer ${tipo === d.value ? "border-primary/40 shadow-sm bg-primary/5" : "border-border/40 hover:border-primary/20"}`}
              onClick={() => { setTipo(d.value); setEngineResult(null); setScoreAfter(null); setAiAnalysis(null); setAiError(false); setAporteEmpreender(""); }}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-8 w-8 rounded-lg ${d.bg} flex items-center justify-center`}>
                    <d.icon className={`h-4 w-4 ${d.color}`} />
                  </div>
                  <h3 className="text-xs font-heading font-semibold">{d.label}</h3>
                </div>
                <p className="text-[10px] text-muted-foreground">{d.impactType}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 3. Simulator form */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Simular decisão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Considerar:</span>
            <div className="flex gap-1 rounded-lg border p-1">
              {[
                { key: "pessoa1", label: nomes.p1 },
                { key: "pessoa2", label: nomes.p2 },
                { key: "casal", label: "Casal" },
              ].map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setVisaoPessoa(opt.key as any)}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    visaoPessoa === opt.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground/80 leading-relaxed bg-muted/20 px-3 py-2 rounded-lg border border-border/30">
            {config.description}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">Tipo de decisão</Label>
              <Select value={tipo} onValueChange={v => { setTipo(v); setEngineResult(null); setScoreAfter(null); setAiAnalysis(null); setAiError(false); setAporteEmpreender(""); }}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DECISION_TYPES.map(d => (
                    <SelectItem key={d.value} value={d.value}>
                      <span className="flex items-center gap-2"><d.icon className={`h-3.5 w-3.5 ${d.color}`} />{d.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">{config.valorLabel}</Label>
              <Input placeholder={config.valorPlaceholder} value={valor} onChange={e => setValor(e.target.value)} className="h-10" />
              <p className="text-[10px] text-muted-foreground/60 mt-1">{config.valorHint}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">{config.prazoLabel}</Label>
              <Input placeholder={config.prazoPlaceholder} value={prazo} onChange={e => setPrazo(e.target.value)} className="h-10" />
              <p className="text-[10px] text-muted-foreground/60 mt-1">{config.prazoHint}</p>
            </div>
          </div>

          {tipo === "empreender" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">Aporte mensal durante maturação (opcional)</Label>
                <Input placeholder="Ex: 5.000" value={aporteEmpreender} onChange={e => setAporteEmpreender(e.target.value)} className="h-10" />
                <p className="text-[10px] text-muted-foreground/60 mt-1">Quanto você vai aportar do bolso por mês até o negócio se pagar.</p>
              </div>
            </div>
          )}

          {/* Current financial context */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: "Renda", value: fmt(rendaTotal), icon: DollarSign, c: "text-success" },
              { label: "Despesas", value: fmt(despesasTotal), icon: BarChart3, c: "text-destructive" },
              { label: poupancaIsEstimated ? "Poupança (margem)" : "Poupança", value: fmt(poupancaMensal), icon: PiggyBank, c: "text-primary" },
              { label: "Reserva", value: fmt(reservaAtual), icon: ShieldCheck, c: "text-info" },
              { label: "Score", value: String(atlasScore), icon: Eye, c: "text-foreground" },
            ].map(k => (
              <div key={k.label} className="px-3 py-2 rounded-lg bg-muted/30 text-center">
                <k.icon className={`h-3 w-3 mx-auto mb-1 ${k.c}`} />
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
                <p className="text-xs font-bold">{k.value}</p>
              </div>
            ))}
          </div>

          <Button onClick={handleSimulate} disabled={parsedValor <= 0} className="gap-2">
            <Calculator className="h-4 w-4" /> Simular impacto
          </Button>
        </CardContent>
      </Card>

      {/* 4. Results */}
      {engineResult && scoreAfter !== null && (
        <div className="space-y-6 animate-fade-in">
          {/* A) Executive Summary */}
          <Card className="border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Resumo do Impacto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
                {[
                  { label: "Impacto mensal", value: engineResult.impactoMensal, show: engineResult.impactoMensal !== 0 },
                  { label: "Impacto total", value: engineResult.impactoTotal, show: true },
                  { label: "Patrimônio", value: engineResult.impactoPatrimonio, show: true },
                  { label: "Reserva", value: engineResult.impactoReserva, show: engineResult.impactoReserva !== 0 },
                  { label: "Custo oportunidade", value: -engineResult.custoOportunidade, show: engineResult.custoOportunidade > 0 },
                  { label: "Aposentadoria", value: null, show: true, custom: engineResult.impactoAposentadoriaMeses === 0 ? "Sem impacto" : `+${engineResult.impactoAposentadoriaMeses} meses` },
                ].filter(k => k.show).map(k => (
                  <div key={k.label} className="p-3 rounded-xl bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase">{k.label}</p>
                    {k.custom ? (
                      <p className={`text-sm font-heading font-bold ${engineResult.impactoAposentadoriaMeses > 0 ? "text-destructive" : "text-success"}`}>
                        {k.custom}
                      </p>
                    ) : (
                      <p className={`text-sm font-heading font-bold ${(k.value ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmt(k.value ?? 0)}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Retirement Impact Detail */}
              {(engineResult.capitalPotencialPerdido > 0 || engineResult.rendaPassivaPerdida > 0) && (
                <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
                  <p className="text-[10px] uppercase tracking-wider text-destructive/70 font-heading font-semibold mb-2 flex items-center gap-1.5">
                    <Umbrella className="h-3.5 w-3.5" /> Impacto detalhado na aposentadoria
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Capital potencial não acumulado</p>
                      <p className="text-sm font-heading font-bold text-destructive">
                        {fmt(-engineResult.capitalPotencialPerdido)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Renda passiva perdida</p>
                      <p className="text-sm font-heading font-bold text-destructive">
                        {fmt(-engineResult.rendaPassivaPerdida)}/mês
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Fórmula</p>
                      <p className="text-[10px] text-muted-foreground/80 font-mono">
                        capital × 4% / 12
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Score before/after */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/20 border border-border/30">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Antes</p>
                  <p className="text-3xl font-heading font-extrabold">{atlasScore}</p>
                </div>
                <ArrowRight className="h-6 w-6 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Depois</p>
                  <p className={`text-3xl font-heading font-extrabold ${scoreAfter >= atlasScore ? "text-success" : "text-destructive"}`}>
                    {scoreAfter}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {scoreAfter >= atlasScore
                    ? <TrendingUp className="h-5 w-5 text-success" />
                    : <TrendingDown className="h-5 w-5 text-destructive" />}
                  <span className={`text-lg font-bold ${scoreAfter >= atlasScore ? "text-success" : "text-destructive"}`}>
                    {scoreAfter >= atlasScore ? "+" : ""}{scoreAfter - atlasScore}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* B) Calculation Memory */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Calculator className="h-4 w-4 text-primary" /> Memória do Cálculo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-body leading-relaxed bg-muted/20 p-4 rounded-xl border border-border/30">
                {engineResult.memoriaCalculo.join("\n")}
              </pre>
            </CardContent>
          </Card>

          {/* C) AI Analysis */}
          <Card className={!aiAnalysis && !loadingAI && !aiError ? "border-primary/30 bg-primary/5" : "border-border/40"}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Análise Complementar por IA
                {!aiAnalysis && !loadingAI && !aiError && (
                  <Badge className="text-[10px] ml-auto bg-primary/15 text-primary hover:bg-primary/20 border-0">Recomendado</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingAI ? (
                <div className="flex items-center justify-center py-6 gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Gerando análise estratégica...</p>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-4">
                  {aiAnalysis.veredito && (
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                      <p className="text-[10px] uppercase tracking-wider text-primary/70 font-heading font-semibold mb-1">Veredito</p>
                      <p className="text-sm font-medium text-foreground">{aiAnalysis.veredito}</p>
                    </div>
                  )}
                  {aiAnalysis.razoes && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-heading font-semibold mb-1">Principais razões</p>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{aiAnalysis.razoes}</p>
                    </div>
                  )}
                  {aiAnalysis.impacto && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-heading font-semibold mb-1">Principal impacto</p>
                      <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">{aiAnalysis.impacto}</p>
                    </div>
                  )}
                  {aiAnalysis.recomendacao && (
                    <div className="p-3 rounded-xl bg-success/5 border border-success/20">
                      <p className="text-[10px] uppercase tracking-wider text-success/70 font-heading font-semibold mb-1">Recomendação</p>
                      <p className="text-sm text-foreground/90 leading-relaxed">{aiAnalysis.recomendacao}</p>
                    </div>
                  )}
                </div>
              ) : aiError ? (
                <div className="text-center py-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <Info className="h-4 w-4 inline mr-1" />
                    Não foi possível gerar a análise complementar neste momento.
                  </p>
                  <Button variant="outline" size="sm" onClick={() => requestAiAnalysis()}>
                    Tentar novamente
                  </Button>
                </div>
              ) : (
                <div className="text-center py-6 space-y-4">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-2 max-w-md mx-auto">
                    <p className="text-base font-heading font-semibold text-foreground">
                      Como essa decisão impacta sua vida?
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      Os números acima mostram o impacto matemático. A IA do PeJota pode interpretar o que isso significa pra suas metas, seu padrão de vida e seus próximos passos.
                    </p>
                  </div>
                  <Button onClick={() => requestAiAnalysis()} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Gerar análise estratégica
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default SimuladorDecisao;
