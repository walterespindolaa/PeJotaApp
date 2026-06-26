import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Target, AlertTriangle, CheckCircle2, TrendingUp, Save,
  Plane, Globe, Car, Home, GraduationCap, Heart, Baby,
  Sparkles, Stethoscope, Palmtree, CarFront, User, Users,
  ArrowDown, ArrowRight, Info,
} from "lucide-react";
import { FV, PV, PMT } from "@/lib/financial";
import { computeAposentadoriaGap } from "@/lib/aposentadoria";
import CenariosChart from "@/components/aposentadoria/CenariosChart";
import UpgradeCTA from "@/components/UpgradeCTA";
import AIReportDisclaimer from "@/components/legal/AIReportDisclaimer";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { usePremissas } from "@/hooks/usePremissas";
import { useDependentes } from "@/hooks/useDependentes";
import { useOrganiza } from "@/hooks/useOrganiza";
import type { LucideIcon } from "lucide-react";

type VisaoPessoa = "pessoa1" | "pessoa2" | "casal";

const OBJ_ICON_MAP: Record<string, LucideIcon> = {
  viagem_nacional: Plane, viagem_internacional: Globe,
  troca_carro: CarFront, compra_carro: Car, compra_imovel: Home,
  casamento: Heart, faculdade: GraduationCap, intercambio: Globe,
  residencia_medica: Stethoscope, sabatico: Palmtree, outro: Sparkles,
};

function guessObjIcon(nome: string): LucideIcon {
  const n = nome.toLowerCase();
  if (n.includes("viagem") || n.includes("trip")) return n.includes("inter") ? Globe : Plane;
  if (n.includes("troca") && n.includes("carro")) return CarFront;
  if (n.includes("carro") || n.includes("veículo")) return Car;
  if (n.includes("imóvel") || n.includes("casa") || n.includes("apart")) return Home;
  if (n.includes("casamento")) return Heart;
  if (n.includes("faculdade") || n.includes("curso") || n.includes("mba")) return GraduationCap;
  if (n.includes("intercâmbio") || n.includes("intercambio")) return Globe;
  if (n.includes("residência") || n.includes("residencia")) return Stethoscope;
  if (n.includes("sabático") || n.includes("sabatico")) return Palmtree;
  return Sparkles;
}

const DEP_ICON_MAP: Record<string, LucideIcon> = {
  filho: Baby, mae: Heart, pai: User, conjuge: Heart, irmao: Users, outro: User,
};

const Aposentadoria = () => {
  const { fmt, pct } = usePrivacyFmt();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [visaoPessoa, setVisaoPessoa] = useState<VisaoPessoa>("casal");
  const [nomes, setNomes] = useState({ p1: "Pessoa 1", p2: "Pessoa 2" });
  const hasPessoa2 = !!(nomes.p2 && nomes.p2.trim() && nomes.p2.trim() !== "Pessoa 2");
  useEffect(() => { if (!hasPessoa2 && visaoPessoa !== "pessoa1") setVisaoPessoa("pessoa1"); }, [hasPessoa2, visaoPessoa]);

  const [idadeAtual, setIdadeAtual] = useState(30);
  const [idadeAposentadoria, setIdadeAposentadoria] = useState(60);
  const [expectativaVida, setExpectativaVida] = useState(90);
  const [rendaDesejada, setRendaDesejada] = useState(10000);
  const [rendaPassivaAtual, setRendaPassivaAtual] = useState(0);
  const [taxaNominal, setTaxaNominal] = useState(10);
  const [inflacao, setInflacao] = useState(5);

  const [patrimonioFinanceiro, setPatrimonioFinanceiro] = useState(0);
  const [patrimonioBens, setPatrimonioBens] = useState(0);
  const [rendaPassivaBens, setRendaPassivaBens] = useState(0);
  const [incluirBens, setIncluirBens] = useState(false);

  const [incluirObjetivos, setIncluirObjetivos] = useState(false);

  const [objetivos, setObjetivos] = useState<{ nome: string; poupanca: number; responsavel: string }[]>([]);

  const premissasHook = usePremissas();
  const { dependentes, calcIdade } = useDependentes();

  const mesAnoAtual = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  const organizaVisao = visaoPessoa === "casal" ? "geral" : visaoPessoa;
  const {
    totalGanhos,
    totalFixas: totalFixasOrganiza,
    totalVariaveis: totalVariaveisOrganiza,
    nomePessoa1: nomeP1Organiza,
    nomePessoa2: nomeP2Organiza,
  } = useOrganiza(mesAnoAtual, organizaVisao);

  const receitaRealMes = totalGanhos;
  const despesaRealMes = totalFixasOrganiza + totalVariaveisOrganiza; // custo de vida recorrente

  const pessoaLabel = visaoPessoa === "casal" ? "Casal" : visaoPessoa === "pessoa1" ? nomes.p1 : nomes.p2;

  const filterByVisao = useCallback(<T extends { responsavel?: string }>(items: T[]): T[] => {
    if (visaoPessoa === "casal") return items;
    const label = visaoPessoa === "pessoa1" ? "Pessoa 1" : "Pessoa 2";
    return items.filter(i => i.responsavel === label || i.responsavel === "Compartilhado");
  }, [visaoPessoa]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
    const [profileRes, aposentRes, invRes, bensRes, objRes] = await Promise.all([
      supabase.from("profiles").select("age, nome_pessoa1, nome_pessoa2").eq("user_id", user.id).maybeSingle(),
      supabase.from("aposentadoria").select("*").eq("user_id", user.id).eq("pessoa", visaoPessoa).maybeSingle(),
      supabase.from("investimentos_financeiros").select("valor_atual").eq("user_id", user.id),
      supabase.from("investimentos_nao_financeiros").select("valor, divida_vinculada, valor_renda, gera_renda").eq("user_id", user.id),
      supabase.from("objetivos").select("nome, valor_objetivo, data_objetivo, frequencia, aporte_mensal, responsavel").eq("user_id", user.id),
    ]);

    const p1 = (profileRes.data as any)?.nome_pessoa1 || nomeP1Organiza || "Pessoa 1";
    const p2 = (profileRes.data as any)?.nome_pessoa2 || nomeP2Organiza || "Pessoa 2";
    setNomes({ p1, p2 });

    setPatrimonioFinanceiro((invRes.data || []).reduce((s, i: any) => s + Number(i.valor_atual || 0), 0));
    const bens = bensRes.data || [];
    setPatrimonioBens(bens.reduce((s, b: any) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0));
    setRendaPassivaBens(bens.filter((b: any) => b.gera_renda).reduce((s, b: any) => s + Number(b.valor_renda || 0), 0));

    const r = premissasHook.taxaRealMensal;
    const objs = (objRes.data || []).map((o: any) => {
      let poupanca = Number(o.aporte_mensal || 0);
      if (!poupanca) {
        const freq = o.frequencia || "unico";
        const annualMap: Record<string, number> = { "1x_ano": 1, "2x_ano": 2, "3x_ano": 3, "4x_ano": 4, "5x_ano": 5 };
        if (annualMap[freq]) {
          poupanca = (o.valor_objetivo * annualMap[freq]) / 12;
        } else {
          const multiMap: Record<string, number> = { "1x_2anos": 24, "1x_3anos": 36, "1x_4anos": 48, "1x_5anos": 60, "1x_6anos": 72, "1x_7anos": 84 };
          let n = multiMap[freq] || 0;
          if (!n && o.data_objetivo) {
            const target = new Date(o.data_objetivo + "T12:00:00");
            n = Math.max(1, Math.round((target.getTime() - Date.now()) / (30.4375 * 24 * 60 * 60 * 1000)));
          }
          if (n > 0 && r > 0) {
            const factor = Math.pow(1 + r, n);
            poupanca = (o.valor_objetivo * r) / (factor - 1);
          } else if (n > 0) {
            poupanca = o.valor_objetivo / n;
          }
        }
      }
      return { nome: o.nome, poupanca, responsavel: o.responsavel || "Pessoa 1" };
    });
    setObjetivos(objs);

    if (profileRes.data?.age) setIdadeAtual((profileRes.data as any).age);
    if (aposentRes.data) {
      const d = aposentRes.data as any;
      if (d.idade_atual) setIdadeAtual(d.idade_atual);
      if (d.expectativa_vida) setExpectativaVida(d.expectativa_vida);
      if (d.idade_aposentadoria) setIdadeAposentadoria(d.idade_aposentadoria);
      if (d.renda_desejada != null) setRendaDesejada(Number(d.renda_desejada));
      if (d.taxa_nominal != null) setTaxaNominal(Number(d.taxa_nominal) * 100);
      if (d.inflacao != null) setInflacao(Number(d.inflacao) * 100);
      if (d.renda_passiva_atual != null) setRendaPassivaAtual(Number(d.renda_passiva_atual));
      if (d.incluir_bens != null) setIncluirBens(Boolean(d.incluir_bens));
      if (d.incluir_objetivos != null) setIncluirObjetivos(Boolean(d.incluir_objetivos));
    }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [user, visaoPessoa, premissasHook.taxaRealMensal, nomeP1Organiza, nomeP2Organiza]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const objetivosDaPessoa = useMemo(() => filterByVisao(objetivos), [objetivos, filterByVisao]);
  const totalObjetivosPessoa = useMemo(() => objetivosDaPessoa.reduce((s, o) => s + o.poupanca, 0), [objetivosDaPessoa]);
  const totalObjetivosGeral = useMemo(() => objetivos.reduce((s, o) => s + o.poupanca, 0), [objetivos]);
  const capacidadeBase = receitaRealMes - despesaRealMes;
  const poupancaEfetiva = Math.max(0, incluirObjetivos ? capacidadeBase - totalObjetivosPessoa : capacidadeBase);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const payload = {
      user_id: user.id,
      pessoa: visaoPessoa,
      idade_atual: idadeAtual,
      expectativa_vida: expectativaVida,
      idade_aposentadoria: idadeAposentadoria,
      renda_desejada: rendaDesejada,
      poupanca_mensal: poupancaEfetiva,
      taxa_nominal: taxaNominal / 100,
      inflacao: inflacao / 100,
      patrimonio_atual: patrimonioFinanceiro,
      renda_passiva_atual: rendaPassivaAtual,
      incluir_bens: incluirBens,
      incluir_objetivos: incluirObjetivos,
    };
    await supabase.from("aposentadoria").upsert(payload as any, { onConflict: "user_id,pessoa" });
    toast({ title: "Planejamento salvo ✓" });
    setSaving(false);
  };

  const L8 = taxaNominal / 100;
  const L9 = inflacao / 100;
  const taxaRealAnual = ((1 + L8) / (1 + L9)) - 1;
  const taxaRealNegativa = taxaRealAnual <= 0;
  const taxaRealMensal = taxaRealAnual > 0 ? Math.pow(1 + taxaRealAnual, 1 / 12) - 1 : 0.0001;
  const taxaNominalMensal = Math.pow(1 + L8, 1 / 12) - 1;
  const inflacaoMensal = Math.pow(1 + L9, 1 / 12) - 1;

  const patrimonioAtual = patrimonioFinanceiro + (incluirBens ? patrimonioBens : 0);
  const { rendaPassivaTotal, gapMensal } = computeAposentadoriaGap({ rendaDesejada, rendaPassivaAtual, rendaPassivaBens, incluirBens });
  const mesesAteAposentar = Math.max(0, (idadeAposentadoria - idadeAtual) * 12);
  const mesesPosAposentadoria = Math.max(0, (expectativaVida - idadeAposentadoria) * 12);

  const calc = useMemo(() => {
    if (mesesAteAposentar <= 0) {
      return { realidade: patrimonioAtual, consumoH23: 0, poupConsumo: 0, viverL23: 0, poupViver: 0, consumoPat: 0 };
    }
    const r = taxaRealMensal;
    const realidade = FV(r, mesesAteAposentar, -poupancaEfetiva, -patrimonioAtual);
    const consumoH23 = mesesPosAposentadoria > 0 && gapMensal > 0 ? -PV(r, mesesPosAposentadoria, gapMensal, 0) : 0;
    const poupConsumo = gapMensal > 0 ? -PMT(r, mesesAteAposentar, -patrimonioAtual, consumoH23) : 0;
    const viverL23 = gapMensal > 0 ? gapMensal / r : 0;
    const poupViver = gapMensal > 0 ? -PMT(r, mesesAteAposentar, -patrimonioAtual, viverL23) : 0;
    const consumoPat = gapMensal > 0 ? FV(r, mesesAteAposentar, -Math.max(0, poupConsumo), -patrimonioAtual) : realidade;
    return { realidade, consumoH23, poupConsumo, viverL23, poupViver, consumoPat };
  }, [patrimonioAtual, poupancaEfetiva, taxaRealMensal, mesesAteAposentar, mesesPosAposentadoria, gapMensal]);

  const montanteViverRenda = calc.viverL23;
  const pctIndependencia = montanteViverRenda > 0 ? Math.min((patrimonioAtual / montanteViverRenda) * 100, 100) : (gapMensal <= 0 ? 100 : 0);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const numField = (label: string, value: number, onChange: (v: number) => void) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value} onChange={e => onChange(Math.max(0, +e.target.value))} className="rounded-xl mt-1 bg-card" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <AIReportDisclaimer />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold">Aposentadoria</h1>
          <p className="text-muted-foreground mt-1 text-sm">Simulação visual para planejar sua independência financeira.</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2 rounded-xl shadow-sm">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Planejamento"}
        </Button>
      </div>

      <UpgradeCTA />

      {taxaRealNegativa && (
        <Alert variant="destructive" className="bg-destructive/10 border-destructive/30">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Sua taxa nominal é menor ou igual à inflação. Suas projeções assumem retorno real mínimo (~0%) e podem não refletir a realidade. Revise as premissas.
          </AlertDescription>
        </Alert>
      )}

      <Card className="shadow-card rounded-2xl bg-card">
        <CardContent className="p-6 space-y-3">
          <h3 className="font-heading font-bold text-sm">Premissas Econômicas</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {numField("Taxa nominal (% a.a.)", taxaNominal, setTaxaNominal)}
            {numField("Inflação esperada (% a.a.)", inflacao, setInflacao)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Taxa real anual", value: pct(taxaRealAnual * 100) },
              { label: "Taxa real mensal", value: pct(taxaRealAnual > 0 ? taxaRealMensal * 100 : 0) },
              { label: "Taxa nominal mensal", value: pct(taxaNominalMensal * 100) },
              { label: "Inflação mensal", value: pct(inflacaoMensal * 100) },
            ].map(item => (
              <div key={item.label} className="p-3 rounded-xl bg-muted/30">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="text-sm font-heading font-bold">{item.value}</p>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border">
            <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Premissas conservadoras e ajustáveis. Resultados são estimativas, não garantia.
            </p>
          </div>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={["dados-pessoais", "info-financeira"]} className="space-y-3">
        <AccordionItem value="dados-pessoais" className="border rounded-2xl px-4 shadow-card bg-card">
          <AccordionTrigger className="font-heading text-sm hover:no-underline">Dados Pessoais</AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-2">
              {hasPessoa2 && (
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Simulando para:</p>
                <div className="flex gap-1 rounded-lg border p-1">
                  {([
                    { key: "pessoa1", label: nomes.p1 },
                    { key: "pessoa2", label: nomes.p2 },
                    { key: "casal", label: "Casal" },
                  ] as const).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setVisaoPessoa(opt.key)}
                      className={`px-3 py-1 text-xs rounded-md transition-colors ${
                        visaoPessoa === opt.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {numField("Idade atual", idadeAtual, setIdadeAtual)}
                {numField("Idade de aposentadoria", idadeAposentadoria, setIdadeAposentadoria)}
                {numField("Expectativa de vida", expectativaVida, setExpectativaVida)}
                {numField("Renda desejada (R$/mês)", rendaDesejada, setRendaDesejada)}
                <div>
                  <Label className="text-xs">Renda passiva recorrente exceto bens (R$/mês)</Label>
                  <Input type="number" min={0} value={rendaPassivaAtual} onChange={e => setRendaPassivaAtual(Math.max(0, +e.target.value))} className="rounded-xl mt-1 bg-card" />
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                    Dividendos, juros, renda recorrente. Aluguéis entram em "Renda passiva de bens".
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs font-medium text-muted-foreground">Variáveis usadas no cálculo da projeção</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { label: "Patrimônio atual", value: fmt(patrimonioAtual), sub: incluirBens ? "financeiro + bens" : "somente financeiro" },
                    { label: "Taxa real ao mês", value: pct(taxaRealMensal * 100), sub: `${taxaNominal}% a.a. − ${inflacao}% inflação` },
                    { label: "Meses até aposentar", value: `${mesesAteAposentar}`, sub: `${idadeAtual} → ${idadeAposentadoria} anos` },
                    { label: "Meses na aposentadoria", value: `${mesesPosAposentadoria}`, sub: `${idadeAposentadoria} → ${expectativaVida} anos` },
                    { label: "Gap de renda mensal", value: fmt(gapMensal), sub: `${fmt(rendaDesejada)} − ${fmt(rendaPassivaTotal)}` },
                    { label: "Aporte p/ aposentadoria", value: fmt(poupancaEfetiva), sub: "calculado no card abaixo" },
                  ].map(item => (
                    <div key={item.label} className="p-2.5 rounded-lg bg-background border border-border/40">
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-heading font-bold">{item.value}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-tight">{item.sub}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="info-financeira" className="border rounded-2xl px-4 shadow-card bg-card">
          <AccordionTrigger className="font-heading text-sm hover:no-underline">Informações Financeiras</AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2">
              {[
                { label: "Patrimônio Financeiro", value: fmt(patrimonioFinanceiro) },
                { label: "Bens e Imóveis (líquido)", value: fmt(patrimonioBens) },
                { label: "Renda Passiva de Bens", value: `${fmt(rendaPassivaBens)}/mês` },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-lg font-heading font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-2">
              <Switch checked={incluirBens} onCheckedChange={setIncluirBens} />
              <Label className="text-sm">Incluir bens e imóveis no cálculo</Label>
            </div>
            <p className="text-xs text-muted-foreground mt-2 italic">
              Quando ligado, considera o valor dos bens no patrimônio total (PV) e a renda passiva de bens na renda passiva total, reduzindo o gap mensal.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <Card className="shadow-card rounded-2xl bg-card">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-primary/10"><Target className="h-5 w-5 text-primary" strokeWidth={1.5} /></div>
            <div>
              <h3 className="font-heading font-bold text-sm">Independência Financeira</h3>
              <p className="text-xs text-muted-foreground">
                Montante necessário para viver de renda: <span className="font-semibold text-foreground">{fmt(montanteViverRenda)}</span>
              </p>
            </div>
          </div>
          <Progress value={pctIndependencia} className="h-3 rounded-full" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>{pctIndependencia.toFixed(1)}% atingido ({fmt(patrimonioAtual)})</span>
            <span>Meta na aposentadoria (aos {idadeAposentadoria} anos)</span>
          </div>
          {montanteViverRenda > 0 && poupancaEfetiva > 0 && (
            <div className="mt-3 p-3 rounded-xl bg-muted/20 border border-border/40">
              <p className="text-xs text-muted-foreground">
                Com aporte de <span className="font-semibold text-foreground">{fmt(poupancaEfetiva)}/mês</span> e taxa real de <span className="font-semibold text-foreground">{pct(taxaRealMensal * 100)}/mês</span>, o patrimônio projetado na aposentadoria será <span className="font-semibold text-foreground">{fmt(calc.realidade)}</span>.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-card rounded-2xl bg-card">
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <TrendingUp className="h-5 w-5 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-heading font-bold text-sm">Capacidade de Aporte Mensal</h3>
              <p className="text-xs text-muted-foreground">
                Baseado no mês atual de <span className="font-medium">{pessoaLabel}</span>
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
              <span className="text-sm text-muted-foreground">Receitas do mês</span>
              <span className="text-sm font-heading font-bold text-foreground">{fmt(receitaRealMes)}</span>
            </div>
            <div className="flex items-center justify-center">
              <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
              <span className="text-sm text-muted-foreground">Despesas do mês</span>
              <span className="text-sm font-heading font-bold text-destructive">− {fmt(despesaRealMes)}</span>
            </div>
            <div className="flex items-center justify-center">
              <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <div className={`flex items-center justify-between p-3 rounded-xl border ${capacidadeBase >= 0 ? "bg-emerald-50/30 border-emerald-200/40 dark:bg-emerald-950/20" : "bg-destructive/5 border-destructive/20"}`}>
              <span className="text-sm font-medium">Sobra mensal</span>
              <span className={`text-sm font-heading font-bold ${capacidadeBase >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                {fmt(capacidadeBase)}
              </span>
            </div>

            <div className="flex items-center gap-3 pt-1 px-1">
              <Switch checked={incluirObjetivos} onCheckedChange={setIncluirObjetivos} />
              <Label className="text-sm">Descontar aportes em objetivos de vida</Label>
            </div>

            {incluirObjetivos && totalObjetivosPessoa > 0 && (
              <>
                <div className="flex items-center justify-center">
                  <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20">
                  <div>
                    <span className="text-sm text-muted-foreground">Objetivos de vida ({pessoaLabel})</span>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">{objetivosDaPessoa.length} objetivo{objetivosDaPessoa.length !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="text-sm font-heading font-bold text-amber-600 dark:text-amber-400">− {fmt(totalObjetivosPessoa)}</span>
                </div>
              </>
            )}

            <div className="flex items-center justify-center">
              <ArrowRight className="h-4 w-4 text-primary/60" />
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-primary/8 border border-primary/20">
              <div>
                <p className="text-sm font-semibold">Aporte para aposentadoria</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Valor usado na projeção abaixo</p>
              </div>
              <span className="text-lg font-heading font-bold text-primary">{fmt(poupancaEfetiva)}<span className="text-xs font-normal text-muted-foreground ml-1">/mês</span></span>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground mt-2">
            A projeção usa seu custo de vida recorrente (fixas + variáveis) como base, assumindo que parcelas e dívidas atuais estarão quitadas na aposentadoria.
          </p>

          {capacidadeBase < 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 flex-shrink-0" />
              <p className="text-xs text-destructive leading-relaxed">
                Despesas superam receitas este mês. Revise seu orçamento antes de projetar a aposentadoria.
              </p>
            </div>
          )}

          {capacidadeBase >= 0 && poupancaEfetiva < calc.poupViver && calc.poupViver > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50/40 border border-amber-200/40 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                Para viver de renda, o aporte necessário seria <span className="font-semibold">{fmt(calc.poupViver)}/mês</span>. O atual ({fmt(poupancaEfetiva)}/mês) cobre o cenário de consumo do patrimônio.
              </p>
            </div>
          )}

          {poupancaEfetiva >= calc.poupViver && calc.poupViver > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-50/30 border border-emerald-200/40 dark:bg-emerald-950/20">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                Aporte atual cobre o necessário para <span className="font-semibold">viver de renda</span> na aposentadoria.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {objetivosDaPessoa.length > 0 && (
        <Card className="shadow-card rounded-2xl bg-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Heart className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div className="flex-1">
                <h3 className="font-heading font-bold text-sm">Objetivos de Vida</h3>
                <p className="text-xs text-muted-foreground">
                  Total mensal necessário: <span className="font-semibold text-foreground">{fmt(totalObjetivosPessoa)}</span>
                </p>
              </div>
            </div>
            <div className="space-y-2">
              {objetivosDaPessoa.map((o, i) => {
                const Icon = guessObjIcon(o.nome);
                return (
                  <div key={i} className="flex items-center gap-4 p-3.5 rounded-xl bg-muted/20 border border-border/30">
                    <div className="flex items-center justify-center rounded-full bg-primary/8 shrink-0" style={{ width: 40, height: 40 }}>
                      <Icon className="text-primary" style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{o.nome}</p>
                      <p className="text-[10px] text-muted-foreground">{o.responsavel}</p>
                    </div>
                    <span className="text-sm font-heading font-bold text-primary whitespace-nowrap">
                      {fmt(o.poupanca)}<span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {dependentes.length > 0 && (
        <Card className="shadow-card rounded-2xl bg-card">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <h3 className="font-heading font-bold text-sm">Dependentes</h3>
                <p className="text-xs text-muted-foreground">{dependentes.length} {dependentes.length === 1 ? "dependente" : "dependentes"} no planejamento</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {dependentes.map(d => {
                const Icon = DEP_ICON_MAP[d.tipo] || User;
                const idade = calcIdade(d.data_nascimento);
                const relatedObjs = objetivos.filter(o => {
                  const n = o.nome.toLowerCase();
                  const dn = d.nome.toLowerCase();
                  return n.includes(dn) || (n.includes("faculdade") && d.tipo === "filho") || (n.includes("intercâmbio") && d.tipo === "filho");
                });
                return (
                  <div key={d.id} className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/20 border border-border/30">
                    <div className="flex items-center justify-center rounded-full bg-primary/8 shrink-0" style={{ width: 40, height: 40 }}>
                      <Icon className="text-primary" style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{d.nome}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{d.parentesco}</span>
                        {idade !== null && (
                          <>
                            <span className="text-border">•</span>
                            <span>{idade} {idade === 1 ? "ano" : "anos"}</span>
                          </>
                        )}
                      </div>
                      {relatedObjs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {relatedObjs.map((ro, idx) => (
                            <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/8 text-primary font-medium">
                              {ro.nome}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <CenariosChart
        idadeAtual={idadeAtual}
        idadeAposentadoria={idadeAposentadoria}
        expectativaVida={expectativaVida}
        patrimonioAtual={patrimonioAtual}
        poupancaMensal={poupancaEfetiva}
        taxaRealMensal={taxaRealMensal}
        rendaDesejada={rendaDesejada}
        rendaPassiva={rendaPassivaTotal}
        rendaPassivaAtual={rendaPassivaAtual}
        rendaPassivaBens={rendaPassivaBens}
        incluirBens={incluirBens}
        poupancaConsumo={calc.poupConsumo}
        poupancaViverRenda={calc.poupViver}
        patrimonioRealidade={calc.realidade}
        montanteConsumo={calc.consumoH23}
        montanteViverRenda={calc.viverL23}
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 rounded-xl shadow-sm">
          <Save className="h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Planejamento"}
        </Button>
      </div>
    </div>
  );
};

export default Aposentadoria;
