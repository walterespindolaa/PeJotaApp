import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Shield, Heart, Landmark, AlertTriangle, CheckCircle2, Wallet, PiggyBank, BarChart3, Umbrella, Scale, Info } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import InsuranceLeadCard from "@/components/seguros/InsuranceLeadCard";

const Seguros = () => {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const [loading, setLoading] = useState(true);

  const [idadeAtual, setIdadeAtual] = useState(30);
  const [idadeAposentadoria, setIdadeAposentadoria] = useState(60);
  const [rendaMensal, setRendaMensal] = useState(0);
  const [totalInvestido, setTotalInvestido] = useState(0);
  const [patrimonioImobilizado, setPatrimonioImobilizado] = useState(0);
  const [dependentes, setDependentes] = useState(0);
  const [mediaDespesas, setMediaDespesas] = useState(0);

  const [despesaFamiliar, setDespesaFamiliar] = useState(5000);
  const [anosProtecao, setAnosProtecao] = useState(10);
  const [dividasAtuais, setDividasAtuais] = useState(0);

  // Alíquotas editáveis de custo sucessório (%)
  const [itcmdPct, setItcmdPct] = useState(8);
  const [advocPct, setAdvocPct] = useState(5);
  const [cartPct, setCartPct] = useState(2);
  const [incluirSubstituicao, setIncluirSubstituicao] = useState(false);

  const [rendaAnualTrib, setRendaAnualTrib] = useState(120000);
  const [aliquotaIR, setAliquotaIR] = useState(27.5);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [profRes, aposentRes, invRes, bensRes, despRes, recRes] = await Promise.all([
      supabase.from("profiles").select("age, dependents").eq("user_id", user.id).maybeSingle(),
      supabase.from("aposentadoria").select("idade_atual, idade_aposentadoria").eq("user_id", user.id).maybeSingle(),
      supabase.from("investimentos_financeiros").select("valor_atual").eq("user_id", user.id),
      supabase.from("investimentos_nao_financeiros").select("valor, divida_vinculada").eq("user_id", user.id),
      supabase.from("despesas").select("valor").eq("user_id", user.id),
      supabase.from("receitas").select("valor").eq("user_id", user.id),
    ]);

    if (profRes.data?.age) setIdadeAtual(profRes.data.age);
    if (profRes.data?.dependents) setDependentes(profRes.data.dependents);
    if (aposentRes.data) {
      if (aposentRes.data.idade_atual) setIdadeAtual(aposentRes.data.idade_atual);
      if (aposentRes.data.idade_aposentadoria) setIdadeAposentadoria(aposentRes.data.idade_aposentadoria);
    }

    const inv = (invRes.data || []).reduce((s: number, i: { valor_atual: number | null }) => s + Number(i.valor_atual || 0), 0);
    setTotalInvestido(inv);

    const bensRows = (bensRes.data || []) as { valor: number | null; divida_vinculada: number | null }[];
    setPatrimonioImobilizado(bensRows.reduce((s, b) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0));

    const desp = (despRes.data || []);
    const totalD = desp.reduce((s: number, d: any) => s + Number(d.valor || 0), 0);
    setMediaDespesas(desp.length > 0 ? totalD / Math.max(desp.length / 10, 1) : 0);

    const rec = (recRes.data || []);
    const totalR = rec.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
    setRendaMensal(rec.length > 0 ? totalR / Math.max(rec.length / 10, 1) : 0);

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const capitalHumano = rendaMensal * 12 * Math.max(0, idadeAposentadoria - idadeAtual);

  // Necessidade de seguro por liquidez sucessória
  const patrimonioTotal = totalInvestido + patrimonioImobilizado;
  const custoITCMD = patrimonioTotal * (itcmdPct / 100);
  const custoAdvoc = patrimonioTotal * (advocPct / 100);
  const custoCart = patrimonioTotal * (cartPct / 100);
  const custoSucessaoTotal = custoITCMD + custoAdvoc + custoCart;
  // Liquidez imediata; NÃO abater ativos líquidos (ficam congelados no inventário)
  const capitalSucessorioSugerido = custoSucessaoTotal + dividasAtuais;
  const substituicaoRenda = despesaFamiliar * anosProtecao * 12; // componente opcional
  const necessidadeTotal = capitalSucessorioSugerido + (incluirSubstituicao ? substituicaoRenda : 0);

  const limitePGBL = rendaAnualTrib * 0.12;
  const economiaPGBL = limitePGBL * (aliquotaIR / 100);

  const reservaEmergencia = totalInvestido;
  const mesesReserva = mediaDespesas > 0 ? reservaEmergencia / mediaDespesas : 0;

  const vulnScore = useMemo(() => {
    let score = 0;
    if (mesesReserva >= 6) score += 3;
    else if (mesesReserva >= 3) score += 2;
    if (dependentes === 0) score += 2;
    else if (dependentes <= 2) score += 1;
    if (dividasAtuais <= 0) score += 2;
    else if (dividasAtuais < rendaMensal * 6) score += 1;
    if (necessidadeTotal <= 0) score += 3;
    else if (totalInvestido >= necessidadeTotal * 0.5) score += 2;
    else if (totalInvestido >= necessidadeTotal * 0.2) score += 1;
    return score;
  }, [mesesReserva, dependentes, dividasAtuais, rendaMensal, necessidadeTotal, totalInvestido]);

  const vulnMax = 10;
  const vulnPct = (vulnScore / vulnMax) * 100;
  const vulnLabel = vulnScore >= 7 ? "Protegido" : vulnScore >= 4 ? "Moderado" : "Vulnerável";
  const vulnColor = vulnScore >= 7 ? "text-success" : vulnScore >= 4 ? "text-warning" : "text-destructive";
  const vulnEmoji = vulnScore >= 7 ? "🟢" : vulnScore >= 4 ? "🟡" : "🔴";

  const numField = (label: string, value: number, onChange: (v: number) => void) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input type="number" min={0} value={value} onChange={e => onChange(Math.max(0, +e.target.value))} className="rounded-xl mt-1" />
    </div>
  );

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const educationalCards = [
    { icon: PiggyBank, title: "Reserva de Emergência", desc: "Ter entre 6 e 12 meses de despesas em ativos líquidos é a primeira camada de proteção financeira.", color: "bg-success/10 border-success/20 text-success" },
    { icon: Umbrella, title: "Seguro de Vida", desc: "Protege sua família caso você não possa mais gerar renda. Fundamental para quem tem dependentes.", color: "bg-primary/10 border-primary/20 text-primary" },
    { icon: Wallet, title: "Endividamento", desc: "Dívidas elevadas aumentam a vulnerabilidade. Priorize a quitação antes de expandir investimentos.", color: "bg-destructive/10 border-destructive/20 text-destructive" },
    { icon: BarChart3, title: "Diversificação Patrimonial", desc: "Patrimônio concentrado em um único ativo ou classe aumenta o risco. Distribua entre diferentes classes.", color: "bg-accent/10 border-accent/20 text-accent-foreground" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Proteção e Seguros</h1>
        <p className="text-muted-foreground text-sm mt-1">Analise sua proteção financeira e descubra seus pontos de vulnerabilidade.</p>
      </div>

      {/* ── 1. Índice de Proteção Financeira ── */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {educationalCards.map((card, i) => (
            <Card key={i} className={`rounded-2xl border ${card.color.split(" ").slice(1).join(" ")}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className={`p-1.5 rounded-lg ${card.color.split(" ")[0]}`}>
                    <card.icon className={`h-4 w-4 ${card.color.split(" ").pop()}`} />
                  </div>
                  <h4 className="font-heading font-bold text-xs">{card.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-soft rounded-2xl border-2 border-primary/10 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardContent className="p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 rounded-lg bg-primary/10"><Shield className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-heading font-bold text-sm">Índice de Proteção Financeira</h3>
                <p className="text-xs text-muted-foreground">Avaliação baseada em reserva, dependentes, dívidas e cobertura</p>
              </div>
            </div>
            <Progress value={vulnPct} className="h-3 rounded-full" />
            <div className="flex justify-between mt-2">
              <span className={`text-sm font-heading font-bold ${vulnColor}`}>{vulnEmoji} {vulnLabel}</span>
              <span className="text-xs text-muted-foreground">{vulnScore}/{vulnMax} pontos</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Accordion type="multiple" defaultValue={["seguro-vida"]} className="space-y-3">
        {/* ── 2. Seguro de Vida Ideal ── */}
        <AccordionItem value="seguro-vida" className="border-2 border-destructive/10 rounded-2xl px-4 shadow-soft bg-gradient-to-br from-destructive/5 via-transparent to-transparent">
          <AccordionTrigger className="font-heading text-sm hover:no-underline">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-destructive" />
              Seguro de Vida Ideal
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-2">
              <p className="text-sm text-muted-foreground">
                Calcule a cobertura mínima de seguro de vida para proteger sua família.
              </p>

              {/* Insurance type comparison */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="rounded-xl border-border/50 bg-muted/20">
                  <CardContent className="p-4 space-y-2">
                    <h5 className="font-heading font-bold text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-warning" /> Seguro Tradicional
                    </h5>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 mt-0.5 text-muted-foreground/50 flex-shrink-0" /> Pagamento mensal acessível</li>
                      <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 mt-0.5 text-muted-foreground/50 flex-shrink-0" /> Cobertura temporária</li>
                      <li className="flex items-start gap-1.5"><AlertTriangle className="h-3 w-3 mt-0.5 text-warning flex-shrink-0" /> Sem formação de patrimônio</li>
                    </ul>
                  </CardContent>
                </Card>
                <Card className="rounded-xl border-primary/20 bg-primary/5">
                  <CardContent className="p-4 space-y-2">
                    <h5 className="font-heading font-bold text-sm flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-primary" /> Whole Life
                    </h5>
                    <ul className="text-xs text-muted-foreground space-y-1.5">
                      <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 mt-0.5 text-success flex-shrink-0" /> Proteção vitalícia</li>
                      <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 mt-0.5 text-success flex-shrink-0" /> Formação de patrimônio</li>
                      <li className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 mt-0.5 text-success flex-shrink-0" /> Planejamento sucessório</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {numField("Despesa mensal familiar (R$)", despesaFamiliar, setDespesaFamiliar)}
                {numField("Anos de proteção", anosProtecao, setAnosProtecao)}
                {numField("Dívidas atuais (R$)", dividasAtuais, setDividasAtuais)}
              </div>

              {/* Alíquotas editáveis de custo sucessório */}
              <div className="grid grid-cols-3 gap-3">
                {numField("ITCMD (%)", itcmdPct, setItcmdPct)}
                {numField("Advocatícias (%)", advocPct, setAdvocPct)}
                {numField("Cartorárias (%)", cartPct, setCartPct)}
              </div>

              {/* Patrimônio considerado */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground">Imobilizado</p>
                  <p className="text-sm font-heading font-bold">{fmt(patrimonioImobilizado)}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground">Financeiro</p>
                  <p className="text-sm font-heading font-bold">{fmt(totalInvestido)}</p>
                </div>
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground">Patrimônio total</p>
                  <p className="text-sm font-heading font-bold text-primary">{fmt(patrimonioTotal)}</p>
                </div>
              </div>

              {/* Breakdown dos custos de inventário */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Despesa</TableHead>
                    <TableHead className="text-right">Custo (%)</TableHead>
                    <TableHead className="text-right">Custo (R$)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>ITCMD</TableCell>
                    <TableCell className="text-right">{itcmdPct}%</TableCell>
                    <TableCell className="text-right">{fmt(custoITCMD)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Advocatícias</TableCell>
                    <TableCell className="text-right">{advocPct}%</TableCell>
                    <TableCell className="text-right">{fmt(custoAdvoc)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Cartorárias</TableCell>
                    <TableCell className="text-right">{cartPct}%</TableCell>
                    <TableCell className="text-right">{fmt(custoCart)}</TableCell>
                  </TableRow>
                  <TableRow className="font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{itcmdPct + advocPct + cartPct}%</TableCell>
                    <TableCell className="text-right">{fmt(custoSucessaoTotal)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>

              {/* Capital sugerido em ferramenta sucessória */}
              <Card className="border-2 border-destructive/20 rounded-xl bg-destructive/5">
                <CardContent className="p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1 flex items-center justify-center gap-1">
                    <Scale className="h-3.5 w-3.5" /> Capital sugerido em ferramenta sucessória
                  </p>
                  <p className="text-2xl font-heading font-bold text-destructive">{fmt(capitalSucessorioSugerido)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    custos de inventário ({fmt(custoSucessaoTotal)}) + dívidas ({fmt(dividasAtuais)})
                  </p>
                </CardContent>
              </Card>

              {/* Substituição de renda (componente opcional) */}
              <div className="flex items-center gap-3">
                <Switch checked={incluirSubstituicao} onCheckedChange={setIncluirSubstituicao} />
                <Label className="text-sm">Incluir substituição de renda (proteção de dependentes)</Label>
              </div>

              {incluirSubstituicao && (
                <Card className="border-2 border-primary/20 rounded-xl bg-primary/5">
                  <CardContent className="p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Necessidade total de seguro</p>
                    <p className="text-2xl font-heading font-bold text-primary">{fmt(necessidadeTotal)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      capital sucessório ({fmt(capitalSucessorioSugerido)}) + substituição de renda ({fmt(substituicaoRenda)})
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Texto de ajuda */}
              <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  O seguro de vida é pago <strong>fora do inventário</strong>, garantindo liquidez imediata para cobrir esses custos sem precisar vender bens. A alíquota de ITCMD varia por estado — 8% é o teto; ajuste conforme o estado do cliente.
                </p>
              </div>

              {/* Insurance Lead CTA */}
              <InsuranceLeadCard dependentes={dependentes} rendaMensal={rendaMensal} totalInvestido={totalInvestido} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 3. Simulador PGBL ── */}
        <AccordionItem value="pgbl" className="border-2 border-success/10 rounded-2xl px-4 shadow-soft bg-gradient-to-br from-success/5 via-transparent to-transparent">
          <AccordionTrigger className="font-heading text-sm hover:no-underline">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-success" />
              Simulador PGBL (Dedução IR)
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <p className="text-sm text-muted-foreground">
                Descubra quanto pode economizar no Imposto de Renda com aportes em PGBL.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {numField("Renda anual tributável (R$)", rendaAnualTrib, setRendaAnualTrib)}
                {numField("Alíquota marginal IR (%)", aliquotaIR, setAliquotaIR)}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground">Limite de aporte (12%)</p>
                  <p className="text-lg font-heading font-bold">{fmt(limitePGBL)}</p>
                </div>
                <div className="p-3 rounded-xl bg-success/10 border border-success/20">
                  <p className="text-xs text-muted-foreground">Economia potencial no IR</p>
                  <p className="text-lg font-heading font-bold text-success">{fmt(economiaPGBL)}/ano</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-muted/20 border border-border">
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Você pode economizar até <strong>{fmt(economiaPGBL)}</strong> por ano investindo {fmt(limitePGBL)} em PGBL.
                </p>
              </div>
              <div className="p-4 rounded-xl bg-warning/10 border border-warning/20 space-y-2">
                <p className="text-sm font-heading font-semibold flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Importante: quando isso é válido
                </p>
                <ul className="text-xs text-muted-foreground space-y-1.5 ml-1">
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" /> Declara IR no modelo completo</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" /> Contribui para a previdência oficial (INSS ou RPPS)</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" /> Tem renda tributável suficiente para usar a dedução</li>
                  <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-success mt-0.5 flex-shrink-0" /> Está realmente na alíquota marginal de 27,5%</li>
                </ul>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── 4. Capital Humano ── */}
        <AccordionItem value="capital-humano" className="border-2 border-amber-200 rounded-2xl px-4 shadow-soft bg-gradient-to-br from-amber-50 via-transparent to-transparent dark:border-amber-500/20 dark:from-amber-500/5">
          <AccordionTrigger className="font-heading text-sm hover:no-underline">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4" style={{ color: "#B68A3F" }} />
              <span className="text-foreground">Capital Humano</span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3 pb-2">
              <p className="text-sm text-muted-foreground">
                Seu capital humano representa o valor total da sua capacidade de gerar renda até a aposentadoria.
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground">Renda mensal estimada</p>
                  <p className="text-sm font-heading font-bold text-foreground">{fmt(rendaMensal)}</p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground">Anos até aposentadoria</p>
                  <p className="text-sm font-heading font-bold text-foreground">{Math.max(0, idadeAposentadoria - idadeAtual)}</p>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20">
                  <p className="text-xs text-muted-foreground">Capital Humano</p>
                  <p className="text-xl font-heading font-semibold text-foreground">{fmt(capitalHumano)}</p>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-warning/10 border border-warning/20">
                <p className="text-sm text-warning-foreground">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Se sua renda parar hoje, seu plano perde <strong>{fmt(capitalHumano)}</strong>.
                </p>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="p-3 rounded-xl bg-muted/20 border border-border">
        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          Os cálculos apresentados são estimativas simplificadas para fins de planejamento. Consulte um profissional para análises personalizadas.
        </p>
      </div>
    </div>
  );
};

export default Seguros;
