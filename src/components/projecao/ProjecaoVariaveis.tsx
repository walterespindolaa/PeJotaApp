import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SlidersHorizontal, Info } from "lucide-react";

interface Props {
  idadeAtual: number; setIdadeAtual: (v: number) => void;
  idadeAposentadoria: number; setIdadeAposentadoria: (v: number) => void;
  patrimonioInicial: number; setPatrimonioInicial: (v: number) => void;
  rendaMensal: number; setRendaMensal: (v: number) => void;
  poupancaMensal: number; setPoupancaMensal: (v: number) => void;
  taxaRetorno: number; setTaxaRetorno: (v: number) => void;
  inflacao: number; setInflacao: (v: number) => void;
}

const HINTS: Record<string, string> = {
  idadeAtual: "Idade usada como ponto de partida da projeção.",
  aposentadoria: "Idade em que o PeJota passa a considerar o início da fase de usufruto e renda passiva.",
  patrimonioInicial: "Valor total do patrimônio financeiro usado como base da projeção.",
  rendaMensal: "Renda mensal desejada para manter seu padrão de vida. Na aposentadoria, esse valor será sacado do patrimônio.",
  poupancaMensal: "Valor médio que sobra para investir ou acumular por mês dentro da simulação.",
  retornoAnual: "Taxa anual esperada de crescimento do patrimônio no cenário projetado.",
  inflacaoAnual: "Taxa anual usada para ajustar o poder de compra ao longo do tempo.",
};

function HintIcon({ hint }: { hint: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="h-3 w-3 text-muted-foreground/60 cursor-help flex-shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-[11px]">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function VSlider({ label, hint, value, onChange, min, max, step = 1, suffix = "" }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number; suffix?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {hint && <HintIcon hint={hint} />}
        </div>
        <span className="text-xs font-mono font-semibold text-primary tabular-nums">{value}{suffix}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
    </div>
  );
}

function VMoneySlider({ label, hint, value, onChange, min, max, step = 500 }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void;
  min: number; max: number; step?: number;
}) {
  const fmt = (v: number) =>
    v >= 1000
      ? `R$ ${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
      : `R$ ${v}`;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {hint && <HintIcon hint={hint} />}
        </div>
        <span className="text-xs font-mono font-semibold text-primary tabular-nums">{fmt(value)}</span>
      </div>
      <Slider value={[value]} onValueChange={([v]) => onChange(v)} min={min} max={max} step={step} />
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-muted-foreground">R$</span>
        <Input
          type="text"
          inputMode="numeric"
          value={new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value)}
          onChange={e => {
            const raw = e.target.value.replace(/\D/g, "");
            onChange(Number(raw) || 0);
          }}
          className="h-7 text-xs"
        />
      </div>
    </div>
  );
}

function VMoneyInput({ label, hint, value, onChange }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void;
}) {
  const display = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(value));
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        {hint && <HintIcon hint={hint} />}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground font-medium">R$</span>
        <Input
          type="text"
          inputMode="numeric"
          value={display}
          onChange={e => {
            const raw = e.target.value.replace(/\D/g, "");
            onChange(Number(raw) || 0);
          }}
          className="h-8 text-xs"
        />
      </div>
    </div>
  );
}

export default function ProjecaoVariaveis(p: Props) {
  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm animate-fade-in" style={{ animationDelay: "100ms" }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          Variáveis de Simulação
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">Alterações aqui são apenas para simulação — não afetam seu planejamento real.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <VSlider label="Idade Atual" hint={HINTS.idadeAtual} value={p.idadeAtual} onChange={p.setIdadeAtual} min={18} max={80} suffix=" anos" />
        <VSlider label="Aposentadoria" hint={HINTS.aposentadoria} value={p.idadeAposentadoria} onChange={p.setIdadeAposentadoria} min={Math.min(p.idadeAtual + 1, 85)} max={85} suffix=" anos" />
        <div className="border-t border-border/30 pt-3 space-y-4">
          <VMoneyInput label="Patrimônio Inicial" hint={HINTS.patrimonioInicial} value={p.patrimonioInicial} onChange={p.setPatrimonioInicial} />
          <VMoneySlider label="Renda Mensal" hint={HINTS.rendaMensal} value={p.rendaMensal} onChange={p.setRendaMensal} min={0} max={100000} step={500} />
          <VMoneySlider label="Poupança Mensal" hint={HINTS.poupancaMensal} value={p.poupancaMensal} onChange={p.setPoupancaMensal} min={0} max={50000} step={250} />
        </div>
        <div className="border-t border-border/30 pt-3 space-y-4">
          <VSlider label="Retorno Anual" hint={HINTS.retornoAnual} value={p.taxaRetorno} onChange={p.setTaxaRetorno} min={0} max={20} step={0.5} suffix="%" />
          <VSlider label="Inflação Anual" hint={HINTS.inflacaoAnual} value={p.inflacao} onChange={p.setInflacao} min={0} max={15} step={0.5} suffix="%" />
        </div>
      </CardContent>
    </Card>
  );
}
