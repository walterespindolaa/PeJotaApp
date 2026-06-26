import { useState, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area,
} from "recharts";
import {
  TrendingDown, TrendingUp, HelpCircle, Info, AlertTriangle,
  CheckCircle2, Lightbulb, Calculator, ChevronDown, ChevronUp,
  Landmark, Building2, BadgeDollarSign, Sparkles,
} from "lucide-react";

// ─── Formatters ─────────────────────────────────────────────────────────────
const fmt = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const fmtShort = (value: number) => {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${(value / 1_000).toFixed(0)}mil`;
  return fmt(value);
};

const fmtPct = (value: number) => `${(value * 100).toFixed(1)}%`;

const fmtInputCurrency = (value: number) =>
  value === 0 ? "" : new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

// ─── Calculation engine ──────────────────────────────────────────────────────
const pmt = (rate: number, nper: number, pv: number): number => {
  if (rate === 0) return pv / nper;
  const pvif = Math.pow(1 + rate, nper);
  return (rate * pv * pvif) / (pvif - 1);
};

interface SimulationInputs {
  valorBem: number;
  taxaAdministracao: number;
  fundoReserva: number;
  prazoConsorcioMeses: number;
  jurosAnualPrice: number;
  prazoFinanciamentoMeses: number;
  jurosAnualSAC: number;
}
interface ConsorcioResult { custoTotalPct: number; custoTotal: number; valorParcela: number; }
interface PriceResult { jurosMensal: number; custoEfetivoTotal: number; valorParcela: number; custoTotal: number; }
interface SACResult { jurosMensal: number; custoEfetivoTotal: number; amortizacao: number; primeiraParcela: number; ultimaParcela: number; custoTotal: number; parcelas: number[]; }
interface ChartDataPoint { mes: number; ano: number; custoAcumuladoConsorcio: number; custoAcumuladoPrice: number; custoAcumuladoSAC: number; parcelaSAC: number; }

const calcConsorcio = (i: SimulationInputs): ConsorcioResult => {
  const custoTotalPct = i.taxaAdministracao + i.fundoReserva;
  const custoTotal = i.valorBem * custoTotalPct + i.valorBem;
  return { custoTotalPct, custoTotal, valorParcela: custoTotal / i.prazoConsorcioMeses };
};

const calcPrice = (i: SimulationInputs): PriceResult => {
  const jurosMensal = Math.pow(1 + i.jurosAnualPrice, 1 / 12) - 1;
  const custoEfetivoTotal = jurosMensal * 1.094;
  const valorParcela = pmt(custoEfetivoTotal, i.prazoFinanciamentoMeses, i.valorBem);
  return { jurosMensal, custoEfetivoTotal, valorParcela, custoTotal: valorParcela * i.prazoFinanciamentoMeses };
};

const calcSAC = (i: SimulationInputs): SACResult => {
  const jurosMensal = Math.pow(1 + i.jurosAnualSAC, 1 / 12) - 1;
  const custoEfetivoTotal = jurosMensal * 1.094;
  const amortizacao = i.valorBem / i.prazoFinanciamentoMeses;
  const parcelas: number[] = [];
  let custoTotal = 0;
  for (let k = 0; k < i.prazoFinanciamentoMeses; k++) {
    const parcela = amortizacao + custoEfetivoTotal * (i.valorBem - k * amortizacao);
    parcelas.push(parcela);
    custoTotal += parcela;
  }
  return { jurosMensal, custoEfetivoTotal, amortizacao, primeiraParcela: parcelas[0] || 0, ultimaParcela: parcelas[parcelas.length - 1] || 0, custoTotal, parcelas };
};

const generateChartData = (i: SimulationInputs, c: ConsorcioResult, p: PriceResult, s: SACResult): ChartDataPoint[] => {
  const maxMeses = Math.max(i.prazoConsorcioMeses, i.prazoFinanciamentoMeses);
  const data: ChartDataPoint[] = [];
  let acumC = 0, acumP = 0, acumS = 0;
  for (let mes = 1; mes <= maxMeses; mes++) {
    if (mes <= i.prazoConsorcioMeses) acumC += c.valorParcela;
    if (mes <= i.prazoFinanciamentoMeses) acumP += p.valorParcela;
    if (mes <= i.prazoFinanciamentoMeses) acumS += s.parcelas[mes - 1] || 0;
    if (mes % 12 === 0 || mes === maxMeses) {
      data.push({ mes, ano: Math.ceil(mes / 12), custoAcumuladoConsorcio: acumC, custoAcumuladoPrice: acumP, custoAcumuladoSAC: acumS, parcelaSAC: s.parcelas[mes - 1] || 0 });
    }
  }
  return data;
};

type RankLabel = "mais-barato" | "intermediario" | "mais-caro";

const getRanking = (c: number, p: number, s: number): { consorcio: RankLabel; price: RankLabel; sac: RankLabel } => {
  const vals = [{ key: "consorcio" as const, val: c }, { key: "price" as const, val: p }, { key: "sac" as const, val: s }].sort((a, b) => a.val - b.val);
  const r = { consorcio: "intermediario" as RankLabel, price: "intermediario" as RankLabel, sac: "intermediario" as RankLabel };
  r[vals[0].key] = "mais-barato";
  r[vals[1].key] = "intermediario";
  r[vals[2].key] = "mais-caro";
  return r;
};

const rankStyles: Record<RankLabel, { bg: string; text: string; border: string; label: string }> = {
  "mais-barato": { bg: "bg-success/10", text: "text-success", border: "border-success/30", label: "Mais barato" },
  intermediario: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/30", label: "Intermediário" },
  "mais-caro": { bg: "bg-destructive/10", text: "text-destructive", border: "border-destructive/30", label: "Mais caro" },
};

// ─── TipCard ──────────────────────────────────────────────────────────────────
const TipCard = ({ icon: Icon, title, children, variant = "info" }: { icon: React.ElementType; title: string; children: React.ReactNode; variant?: "info" | "warning" | "success" }) => {
  const styles = {
    info: { bg: "bg-primary/5", border: "border-primary/20", icon: "text-primary", title: "text-primary" },
    warning: { bg: "bg-amber-500/10", border: "border-amber-500/20", icon: "text-amber-500", title: "text-amber-600" },
    success: { bg: "bg-success/5", border: "border-success/20", icon: "text-success", title: "text-success" },
  };
  const s = styles[variant];
  return (
    <div className={`rounded-xl p-4 ${s.bg} border ${s.border}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${s.icon}`} />
        <div>
          <p className={`font-heading font-semibold text-sm ${s.title}`}>{title}</p>
          <div className="text-sm text-muted-foreground mt-1 leading-relaxed font-body">{children}</div>
        </div>
      </div>
    </div>
  );
};

// ─── ExpandableSection ────────────────────────────────────────────────────────
const ExpandableSection = ({ title, icon: Icon, children, defaultOpen = false }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors text-left">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="font-heading font-semibold text-sm">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
};

// ─── CurrencyInput ────────────────────────────────────────────────────────────
const CurrencyInput = ({ value, onChange, label, helpText }: { value: number; onChange: (val: number) => void; label: string; helpText?: string }) => {
  const [display, setDisplay] = useState(fmtInputCurrency(value));
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    const num = parseInt(raw, 10) / 100 || 0;
    setDisplay(fmtInputCurrency(num));
    onChange(num);
  };
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" /></TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs"><p className="text-xs">{helpText}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <Input value={display} onChange={handleChange} onBlur={() => setDisplay(fmtInputCurrency(value))} className="pl-10 text-right h-10" placeholder="0,00" />
      </div>
    </div>
  );
};

// ─── PercentInput ─────────────────────────────────────────────────────────────
const PercentInput = ({ value, onChange, label, helpText, min = 0, max = 100, step = 0.5 }: { value: number; onChange: (val: number) => void; label: string; helpText?: string; min?: number; max?: number; step?: number }) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {helpText && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" /></TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs"><p className="text-xs">{helpText}</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span className="text-sm font-heading font-bold">{(value * 100).toFixed(1)}%</span>
    </div>
    <Slider value={[value * 100]} onValueChange={([v]) => onChange(v / 100)} min={min} max={max} step={step} className="w-full" />
    <div className="flex justify-between text-[10px] text-muted-foreground/60">
      <span>{min}%</span>
      <span>{max}%</span>
    </div>
  </div>
);

// ─── ResultCard ───────────────────────────────────────────────────────────────
const ResultCard = ({ title, icon: Icon, iconBg, iconColor, valorParcela, custoTotal, rank, extras }: { title: string; icon: React.ElementType; iconBg: string; iconColor: string; valorParcela: string; custoTotal: number; rank: RankLabel; extras?: { label: string; value: string }[] }) => {
  const r = rankStyles[rank];
  return (
    <div className={`rounded-xl border ${r.border} p-4 space-y-3 bg-card`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-8 w-8 rounded-lg ${iconBg} flex items-center justify-center`}>
            <Icon className={`h-4 w-4 ${iconColor}`} />
          </div>
          <h4 className="font-heading font-semibold text-sm">{title}</h4>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${r.bg} ${r.text}`}>{r.label}</span>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase">Parcela</p>
        <p className="text-base font-heading font-bold">{valorParcela}</p>
      </div>
      <div>
        <p className="text-[10px] text-muted-foreground uppercase">Custo total</p>
        <p className="text-base font-heading font-bold">{fmt(custoTotal)}</p>
      </div>
      {extras && extras.length > 0 && (
        <div className="border-t border-border/30 pt-2 space-y-1">
          {extras.map(e => (
            <div key={e.label} className="flex justify-between text-xs">
              <span className="text-muted-foreground">{e.label}</span>
              <span className="font-medium">{e.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── CustomTooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-card border border-border/60 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-heading font-semibold mb-2">Ano {label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const SimuladorFinanciamento = () => {
  const [inputs, setInputs] = useState<SimulationInputs>({
    valorBem: 500000,
    taxaAdministracao: 0.16,
    fundoReserva: 0.02,
    prazoConsorcioMeses: 180,
    jurosAnualPrice: 0.12,
    prazoFinanciamentoMeses: 360,
    jurosAnualSAC: 0.10,
  });

  const update = useCallback(<K extends keyof SimulationInputs>(key: K, value: SimulationInputs[K]) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  }, []);

  const consorcio = useMemo(() => calcConsorcio(inputs), [inputs]);
  const price = useMemo(() => calcPrice(inputs), [inputs]);
  const sac = useMemo(() => calcSAC(inputs), [inputs]);
  const chartData = useMemo(() => generateChartData(inputs, consorcio, price, sac), [inputs, consorcio, price, sac]);
  const ranking = useMemo(() => getRanking(consorcio.custoTotal, price.custoTotal, sac.custoTotal), [consorcio, price, sac]);
  const economiaMaxima = useMemo(() => {
    const sorted = [consorcio.custoTotal, price.custoTotal, sac.custoTotal].sort((a, b) => a - b);
    return sorted[2] - sorted[0];
  }, [consorcio, price, sac]);

  return (
    <div className="space-y-8 animate-fade-in">

      {/* Intro tip */}
      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-muted/30 border border-border/40">
        <Info className="h-4 w-4 text-primary flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Preencha o valor do bem e ajuste as taxas de cada modalidade. O simulador calcula parcelas, custo total e compara as três opções ao longo do tempo.{" "}
          <span className="font-semibold text-foreground">O mais barato nem sempre é o melhor — considere sua urgência e disciplina.</span>
        </p>
      </div>

      {/* Input card */}
      <Card className="border-primary/20 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" /> Dados da Simulação
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <CurrencyInput
            value={inputs.valorBem}
            onChange={v => update("valorBem", v)}
            label="Valor do Bem"
            helpText="Valor total do imóvel, veículo ou bem que deseja adquirir"
          />

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label className="text-xs text-muted-foreground">Prazo do Financiamento</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" /></TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs"><p className="text-xs">Prazo em meses para o financiamento Price e SAC</p></TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-sm font-heading font-bold">
                {inputs.prazoFinanciamentoMeses} meses ({(inputs.prazoFinanciamentoMeses / 12).toFixed(0)} anos)
              </span>
            </div>
            <Slider value={[inputs.prazoFinanciamentoMeses]} onValueChange={([v]) => update("prazoFinanciamentoMeses", v)} min={12} max={420} step={12} className="w-full" />
            <div className="flex justify-between text-[10px] text-muted-foreground/60">
              <span>1 ano</span><span>35 anos</span>
            </div>
          </div>

          <Tabs defaultValue="consorcio" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="consorcio" className="text-xs"><Landmark className="h-3.5 w-3.5 mr-1" />Consórcio</TabsTrigger>
              <TabsTrigger value="price" className="text-xs"><Building2 className="h-3.5 w-3.5 mr-1" />Price</TabsTrigger>
              <TabsTrigger value="sac" className="text-xs"><BadgeDollarSign className="h-3.5 w-3.5 mr-1" />SAC</TabsTrigger>
            </TabsList>

            <TabsContent value="consorcio" className="space-y-4 pt-3">
              <PercentInput value={inputs.taxaAdministracao} onChange={v => update("taxaAdministracao", v)} label="Taxa de Administração" helpText="Taxa cobrada pela administradora do consórcio. Varia de 10% a 25%" min={5} max={30} step={0.5} />
              <PercentInput value={inputs.fundoReserva} onChange={v => update("fundoReserva", v)} label="Fundo de Reserva" helpText="Percentual destinado ao fundo de reserva do grupo. Geralmente entre 1% e 5%" min={0} max={10} step={0.5} />
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Prazo do Consórcio</Label>
                  <span className="text-sm font-heading font-bold">
                    {inputs.prazoConsorcioMeses} meses ({(inputs.prazoConsorcioMeses / 12).toFixed(0)} anos)
                  </span>
                </div>
                <Slider value={[inputs.prazoConsorcioMeses]} onValueChange={([v]) => update("prazoConsorcioMeses", v)} min={12} max={240} step={12} className="w-full" />
                <div className="flex justify-between text-[10px] text-muted-foreground/60">
                  <span>1 ano</span><span>20 anos</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="price" className="space-y-4 pt-3">
              <PercentInput value={inputs.jurosAnualPrice} onChange={v => update("jurosAnualPrice", v)} label="Juros Anual (Price)" helpText="Taxa de juros anual do financiamento na tabela Price. Parcela fixa durante todo o período" min={4} max={25} step={0.5} />
              <div className="p-3 bg-muted/30 rounded-lg space-y-1 text-xs border border-border/30">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Juros mensal</span>
                  <span className="font-medium">{fmtPct(price.jurosMensal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CET (custo efetivo)</span>
                  <span className="font-medium">{fmtPct(price.custoEfetivoTotal)}</span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sac" className="space-y-4 pt-3">
              <PercentInput value={inputs.jurosAnualSAC} onChange={v => update("jurosAnualSAC", v)} label="Juros Anual (SAC)" helpText="Taxa de juros anual na tabela SAC. Parcela decresce ao longo do tempo" min={4} max={25} step={0.5} />
              <div className="p-3 bg-muted/30 rounded-lg space-y-1 text-xs border border-border/30">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Juros mensal</span>
                  <span className="font-medium">{fmtPct(sac.jurosMensal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">CET (custo efetivo)</span>
                  <span className="font-medium">{fmtPct(sac.custoEfetivoTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amortização mensal</span>
                  <span className="font-medium">{fmt(sac.amortizacao)}</span>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Results */}
      <div>
        <h2 className="text-sm font-heading font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
          <TrendingDown className="h-4 w-4" /> Resultado da Comparação
        </h2>

        <div className="mb-4 p-3 bg-success/5 border border-success/20 rounded-xl">
          <p className="text-sm text-foreground">
            <span className="font-heading font-semibold">Diferença entre o mais caro e o mais barato:</span>{" "}
            <span className="text-lg font-heading font-bold text-success">{fmt(economiaMaxima)}</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <ResultCard
            title="Consórcio"
            icon={Landmark}
            iconBg="bg-primary/10"
            iconColor="text-primary"
            valorParcela={fmt(consorcio.valorParcela)}
            custoTotal={consorcio.custoTotal}
            rank={ranking.consorcio}
            extras={[
              { label: "Custo total %", value: fmtPct(consorcio.custoTotalPct) },
              { label: "Prazo", value: `${inputs.prazoConsorcioMeses} meses` },
            ]}
          />
          <ResultCard
            title="Financ. Price"
            icon={Building2}
            iconBg="bg-info/10"
            iconColor="text-info"
            valorParcela={fmt(price.valorParcela)}
            custoTotal={price.custoTotal}
            rank={ranking.price}
            extras={[
              { label: "Juros mensal", value: fmtPct(price.jurosMensal) },
              { label: "CET mensal", value: fmtPct(price.custoEfetivoTotal) },
            ]}
          />
          <ResultCard
            title="Financ. SAC"
            icon={BadgeDollarSign}
            iconBg="bg-success/10"
            iconColor="text-success"
            valorParcela={`${fmt(sac.primeiraParcela)} → ${fmt(sac.ultimaParcela)}`}
            custoTotal={sac.custoTotal}
            rank={ranking.sac}
            extras={[
              { label: "1ª parcela", value: fmt(sac.primeiraParcela) },
              { label: "Última parcela", value: fmt(sac.ultimaParcela) },
            ]}
          />
        </div>
      </div>

      {/* Chart: Cumulative cost */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Custo Acumulado ao Longo do Tempo
          </CardTitle>
          <p className="text-xs text-muted-foreground">Quanto você vai pagar no total a cada ano</p>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="gradConsorcio" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D97706" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#D97706" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradPrice" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradSAC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}a`} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => fmtShort(v)} width={72} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="custoAcumuladoConsorcio" name="Consórcio" stroke="#D97706" strokeWidth={2} fill="url(#gradConsorcio)" />
                <Area type="monotone" dataKey="custoAcumuladoPrice" name="Price" stroke="#3b82f6" strokeWidth={2} fill="url(#gradPrice)" />
                <Area type="monotone" dataKey="custoAcumuladoSAC" name="SAC" stroke="#16a34a" strokeWidth={2} fill="url(#gradSAC)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Chart: SAC vs Price parcela */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" /> Evolução da Parcela SAC vs Price
          </CardTitle>
          <p className="text-xs text-muted-foreground">No SAC, a parcela diminui todo mês. No Price, ela é fixa.</p>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}a`} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => fmtShort(v)} width={72} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Line type="monotone" dataKey="parcelaSAC" name="Parcela SAC" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey={() => price.valorParcela} name="Parcela Price" stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Educational section */}
      <div className="space-y-3">
        <h2 className="text-sm font-heading font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Info className="h-4 w-4" /> Entenda cada modalidade
        </h2>

        <ExpandableSection title="O que é o Consórcio?" icon={Landmark} defaultOpen>
          <TipCard icon={CheckCircle2} title="Como funciona" variant="success">
            <p>Você entra em um grupo que contribui mensalmente. Todo mês, um participante é contemplado por sorteio ou lance. <strong>Não há juros</strong>, apenas taxa de administração e fundo de reserva.</p>
          </TipCard>
          <TipCard icon={AlertTriangle} title="Atenção" variant="warning">
            <p>Você <strong>não recebe o bem imediatamente</strong>. Pode levar meses ou anos até ser contemplado. Se precisar com urgência, essa não é a melhor opção.</p>
          </TipCard>
          <TipCard icon={Lightbulb} title="Ideal para quem..." variant="info">
            <p>Tem disciplina, não tem pressa e quer pagar menos no total. Funciona bem para quem planeja uma troca de imóvel ou veículo a médio prazo.</p>
          </TipCard>
        </ExpandableSection>

        <ExpandableSection title="Financiamento Tabela Price" icon={Building2}>
          <TipCard icon={CheckCircle2} title="Como funciona" variant="success">
            <p>Parcela fixa durante todo o período. Nos primeiros meses, a maior parte é juros. Você recebe o bem <strong>imediatamente</strong>.</p>
          </TipCard>
          <TipCard icon={AlertTriangle} title="Atenção" variant="warning">
            <p>O custo total é significativamente maior. Em financiamentos longos, você pode pagar <strong>mais de 3x o valor do bem</strong> em juros.</p>
          </TipCard>
          <TipCard icon={Lightbulb} title="Ideal para quem..." variant="info">
            <p>Precisa do bem agora e quer previsibilidade nas parcelas. A parcela fixa facilita o planejamento mensal.</p>
          </TipCard>
        </ExpandableSection>

        <ExpandableSection title="Financiamento Tabela SAC" icon={BadgeDollarSign}>
          <TipCard icon={CheckCircle2} title="Como funciona" variant="success">
            <p>A amortização é constante e os juros incidem sobre o saldo devedor decrescente. Resultado: <strong>a parcela começa mais alta e vai diminuindo</strong>.</p>
          </TipCard>
          <TipCard icon={AlertTriangle} title="Atenção" variant="warning">
            <p>A primeira parcela é mais alta que a do Price. Bancos geralmente exigem que a parcela não ultrapasse 30% da renda.</p>
          </TipCard>
          <TipCard icon={Lightbulb} title="Ideal para quem..." variant="info">
            <p>Tem renda para suportar parcelas iniciais maiores e quer pagar menos juros no total comparado ao Price.</p>
          </TipCard>
        </ExpandableSection>
      </div>

      {/* Final advice */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-5">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="space-y-1.5">
              <h4 className="font-heading font-semibold text-sm">Não é só sobre o valor da parcela</h4>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">
                É sobre o <strong className="text-foreground">custo total</strong>, o <strong className="text-foreground">objetivo</strong> e o{" "}
                <strong className="text-foreground">comportamento</strong>. Um consórcio pode ser mais barato no total, mas se você precisar do bem agora, a economia não vale a espera. Use este simulador para ter clareza dos números, mas tome sua decisão considerando{" "}
                <strong className="text-foreground">sua realidade financeira completa</strong> — e não apenas a parcela que cabe no bolso.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimuladorFinanciamento;
