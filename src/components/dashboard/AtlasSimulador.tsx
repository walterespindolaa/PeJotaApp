import { useState } from "react";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { simulateDecision, type ScoreDimensions, type SimulationResult } from "@/lib/atlasIntelligence";
import type { AtlasScoreInputs } from "@/lib/atlasScore";
import { ArrowRight, TrendingDown, TrendingUp, Info, Calculator, Sparkles, Lightbulb, Pin } from "lucide-react";

interface Props {
  currentScore: number;
  currentDims: ScoreDimensions;
  hasEmpresa: boolean;
  reservaAtual: number;
  despesasMensais: number;
  patrimonioAtual: number;
  poupancaMensal: number;
  taxaRealMensal: number;
  /** Pass real AtlasScoreInputs for official score computation */
  scoreInputs?: AtlasScoreInputs;
}

const DECISION_TYPES = [
  { value: "comprar_imovel", label: "Comprar imóvel" },
  { value: "trocar_carro", label: "Trocar carro" },
  { value: "aumentar_padrao", label: "Aumentar padrão de vida" },
  { value: "retirar_empresa", label: "Retirar valor da empresa" },
  { value: "reduzir_renda", label: "Reduzir renda" },
  { value: "aumentar_investimento", label: "Aumentar investimento" },
];

// Dynamic labels/helpers per type
const FIELD_CONFIG: Record<string, { valorLabel: string; prazoLabel: string; hint: string; impactoPatrimonio: string; impactoScore: string }> = {
  comprar_imovel: {
    valorLabel: "Valor do imóvel (R$)",
    prazoLabel: "Prazo do financiamento (meses)",
    hint: "30% do valor será retirado da reserva e o restante impacta o patrimônio líquido.",
    impactoPatrimonio: "O valor total do imóvel é considerado como saída de patrimônio líquido, pois o financiamento gera um passivo equivalente.",
    impactoScore: "O Score diminui pela redução da reserva de emergência e do patrimônio líquido disponível.",
  },
  trocar_carro: {
    valorLabel: "Valor do carro (R$)",
    prazoLabel: "Prazo do financiamento (meses)",
    hint: "30% será retirado da reserva (entrada) e o valor total impacta o patrimônio.",
    impactoPatrimonio: "Veículos são ativos depreciáveis. O valor total é tratado como redução patrimonial.",
    impactoScore: "O Score diminui pela saída de reserva e pela redução do patrimônio investido.",
  },
  aumentar_padrao: {
    valorLabel: "Aumento mensal desejado (R$)",
    prazoLabel: "Por quantos meses esse aumento vai ocorrer?",
    hint: "O valor será considerado como aumento mensal de despesas pelo período informado.",
    impactoPatrimonio: "Considerando que o aumento de despesas não será compensado por aumento de renda, o impacto acumulado reduz seu patrimônio nesse valor ao longo do período simulado.",
    impactoScore: "O Score diminui porque sua margem mensal e capacidade de poupança ficam menores durante o período simulado.",
  },
  retirar_empresa: {
    valorLabel: "Valor da retirada (R$)",
    prazoLabel: "Prazo da operação (meses)",
    hint: "Retirada pontual do caixa da empresa, reduzindo o patrimônio empresarial.",
    impactoPatrimonio: "O valor retirado sai diretamente do patrimônio empresarial vinculado.",
    impactoScore: "O Score é afetado pela redução da organização empresarial e do patrimônio.",
  },
  reduzir_renda: {
    valorLabel: "Redução mensal de renda (R$)",
    prazoLabel: "Por quantos meses a renda será menor?",
    hint: "Simula uma queda na renda mensal, como troca de emprego ou redução de jornada.",
    impactoPatrimonio: "A redução de renda diminui a capacidade de poupança, acumulando perdas ao longo do período.",
    impactoScore: "O Score diminui pela queda na margem financeira e menor capacidade de investimento.",
  },
  aumentar_investimento: {
    valorLabel: "Aporte mensal adicional (R$)",
    prazoLabel: "Por quantos meses pretende manter?",
    hint: "O valor será adicionado à sua poupança mensal, com rendimento composto no período.",
    impactoPatrimonio: "O aporte adicional, somado aos rendimentos compostos, aumenta seu patrimônio projetado.",
    impactoScore: "O Score melhora pelo aumento da margem de investimento e crescimento patrimonial.",
  },
};

// fmt provided by i18n context
const fmtPct = (v: number) => v.toFixed(1) + "%";

const AtlasSimulador = (props: Props) => {
  const { fmt } = useI18n();
  const [tipo, setTipo] = useState("comprar_imovel");
  const [valor, setValor] = useState("");
  const [prazo, setPrazo] = useState("12");
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const config = FIELD_CONFIG[tipo] || FIELD_CONFIG.comprar_imovel;
  const parsedValor = Number(valor.replace(/\D/g, "")) || 0;
  const parsedPrazo = Number(prazo) || 12;

  const isRecurring = ["aumentar_padrao", "reduzir_renda", "aumentar_investimento"].includes(tipo);
  const totalImpacto = isRecurring ? parsedValor * parsedPrazo : parsedValor;

  const handleSimulate = () => {
    if (parsedValor <= 0) return;
    const res = simulateDecision(
      { tipo, valor: parsedValor, prazoMeses: parsedPrazo },
      props.currentScore,
      props.currentDims,
      props.hasEmpresa,
      {
        reservaAtual: props.reservaAtual,
        despesasMensais: props.despesasMensais,
        patrimonioAtual: props.patrimonioAtual,
        poupancaMensal: props.poupancaMensal,
        taxaRealMensal: props.taxaRealMensal,
      },
      props.scoreInputs
    );
    setResult(res);
  };

  const summaryText = isRecurring
    ? `${tipo === "aumentar_investimento" ? "Aporte adicional" : tipo === "reduzir_renda" ? "Redução" : "Aumento"} de ${fmt(parsedValor)} por mês durante ${parsedPrazo} meses`
    : `${tipo === "retirar_empresa" ? "Retirada" : "Aquisição"} de ${fmt(parsedValor)}`;

  // Detail data for modal
  const margemAtualPct = props.despesasMensais > 0
    ? ((props.poupancaMensal / (props.despesasMensais + props.poupancaMensal)) * 100)
    : 0;
  const novaPoupanca = isRecurring
    ? (tipo === "aumentar_investimento" ? props.poupancaMensal + parsedValor : Math.max(0, props.poupancaMensal - parsedValor))
    : props.poupancaMensal;
  const novaReceitaEstimada = props.despesasMensais + novaPoupanca;
  const novaMargemPct = novaReceitaEstimada > 0 ? (novaPoupanca / novaReceitaEstimada) * 100 : 0;

  return (
    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-heading font-bold text-sm">Simular Decisão</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Tipo de decisão</Label>
            <Select value={tipo} onValueChange={v => { setTipo(v); setResult(null); }}>
              <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DECISION_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">{config.valorLabel}</Label>
            <Input
              className="rounded-xl h-9 text-xs"
              placeholder="Ex: 10.000"
              value={valor}
              onChange={e => setValor(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">{config.prazoLabel}</Label>
            <Input
              className="rounded-xl h-9 text-xs"
              value={prazo}
              onChange={e => setPrazo(e.target.value)}
            />
          </div>
        </div>

        <p className="text-[10px] text-muted-foreground/70 mb-4 leading-relaxed flex items-center gap-1.5">
          <Lightbulb className="h-3 w-3 flex-shrink-0" />{config.hint}
        </p>

        <Button onClick={handleSimulate} size="sm" className="rounded-xl text-xs mb-4">
          Simular impacto
        </Button>

        {result && (
          <div className="space-y-4 animate-fade-in">
            {/* Summary card */}
            <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
              <p className="text-[10px] uppercase tracking-[0.15em] text-primary/70 font-heading font-semibold mb-2 flex items-center gap-1.5">
                <Pin className="h-3 w-3" />Você está simulando
              </p>
              <p className="text-sm font-medium text-foreground">{summaryText}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Impacto total estimado: <span className="font-bold text-foreground">{fmt(totalImpacto)}</span>
              </p>
            </div>

            {/* Score before/after */}
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-2">
                Resultado da simulação
              </p>
              <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground/60 uppercase mb-1">Antes</p>
                  <p className="text-2xl font-heading font-extrabold">{result.scoreBefore}</p>
                </div>
                <ArrowRight className="h-5 w-5 text-muted-foreground" />
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground/60 uppercase mb-1">Depois</p>
                  <p className={`text-2xl font-heading font-extrabold ${
                    result.scoreAfter >= result.scoreBefore ? "text-success" : "text-destructive"
                  }`}>{result.scoreAfter}</p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  {result.scoreAfter >= result.scoreBefore
                    ? <TrendingUp className="h-4 w-4 text-success" />
                    : <TrendingDown className="h-4 w-4 text-destructive" />
                  }
                  <span className={`text-sm font-bold ${
                    result.scoreAfter >= result.scoreBefore ? "text-success" : "text-destructive"
                  }`}>
                    {result.scoreAfter >= result.scoreBefore ? "+" : ""}{result.scoreAfter - result.scoreBefore}
                  </span>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground/60 mt-2 leading-relaxed">
                {config.impactoScore}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground/60 uppercase mb-1">Reserva</p>
                <p className={`text-sm font-heading font-bold ${result.reservaImpact >= 0 ? "text-success" : "text-destructive"}`}>
                  {result.reservaImpact >= 0 ? "+" : ""}{result.reservaImpact.toFixed(0)}%
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="p-3 rounded-lg bg-muted/30 cursor-help">
                      <div className="flex items-center gap-1">
                        <p className="text-[10px] text-muted-foreground/60 uppercase mb-1">Patrimônio</p>
                        <Info className="h-3 w-3 text-muted-foreground/40 -mt-1" />
                      </div>
                      <p className={`text-sm font-heading font-bold ${result.patrimonioImpact >= 0 ? "text-success" : "text-destructive"}`}>
                        {fmt(result.patrimonioImpact)}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[260px] text-xs">
                    {config.impactoPatrimonio}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="p-3 rounded-lg bg-muted/30">
                <p className="text-[10px] text-muted-foreground/60 uppercase mb-1">Aposentadoria</p>
                <p className={`text-sm font-heading font-bold ${result.aposentImpact <= 0 ? "text-success" : "text-destructive"}`}>
                  {result.aposentImpact === 0 ? "Sem impacto" : `${result.aposentImpact > 0 ? "+" : ""}${result.aposentImpact} meses`}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs w-full"
              onClick={() => setShowDetail(true)}
            >
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              Ver cálculo detalhado
            </Button>
          </div>
        )}

        {/* Detail modal */}
        <Dialog open={showDetail} onOpenChange={setShowDetail}>
          <DialogContent className="sm:max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base font-heading">Cálculo Detalhado</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Veja como cada indicador foi afetado pela simulação.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <Row label="Margem atual" value={fmtPct(margemAtualPct)} />
              <Row label="Nova margem estimada" value={fmtPct(novaMargemPct)} highlight={novaMargemPct < margemAtualPct ? "destructive" : "success"} />
              <div className="border-t border-border/30 my-2" />
              <Row label="Patrimônio atual" value={fmt(props.patrimonioAtual)} />
              <Row label="Patrimônio projetado" value={fmt(props.patrimonioAtual + (result?.patrimonioImpact ?? 0))} highlight={(result?.patrimonioImpact ?? 0) < 0 ? "destructive" : "success"} />
              <div className="border-t border-border/30 my-2" />
              <Row label="Poupança mensal atual" value={fmt(props.poupancaMensal)} />
              <Row label="Nova poupança mensal" value={fmt(novaPoupanca)} highlight={novaPoupanca < props.poupancaMensal ? "destructive" : "success"} />
              <div className="border-t border-border/30 my-2" />
              <Row label="Impacto na reserva" value={`${(result?.reservaImpact ?? 0).toFixed(0)}%`} highlight={(result?.reservaImpact ?? 0) < 0 ? "destructive" : "success"} />
              <Row label="Impacto na aposentadoria" value={result?.aposentImpact === 0 ? "Nenhum" : `${result?.aposentImpact ?? 0} meses`} highlight={(result?.aposentImpact ?? 0) > 0 ? "destructive" : "success"} />
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

function Row({ label, value, highlight }: { label: string; value: string; highlight?: "destructive" | "success" }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={`font-heading font-bold text-xs ${highlight === "destructive" ? "text-destructive" : highlight === "success" ? "text-success" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default AtlasSimulador;
