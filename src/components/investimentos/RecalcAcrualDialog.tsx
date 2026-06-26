import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, AlertCircle } from "lucide-react";
import { calcularAcrualValorAplicado } from "@/lib/investimentos/rendaFixaAcrual";
import { INDEXADORES } from "@/lib/investimentos/constants";
import type { MacroData } from "@/lib/investimentos/types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDataCompra: string;
  valorAtual: number;
  initialIndexador: string;
  initialTaxa: number;
  macroData: MacroData;
  onConfirm: (data: {
    totalAportado: number;
    indexador: string;
    taxa: number;
    dataCompra: string;
  }) => void;
};

export default function RecalcAcrualDialog({
  open, onOpenChange,
  initialDataCompra, valorAtual, initialIndexador, initialTaxa,
  macroData, onConfirm,
}: Props) {
  const [dataCompra, setDataCompra] = useState(initialDataCompra);
  const [indexador, setIndexador] = useState(initialIndexador || "Selic");
  const [taxa, setTaxa] = useState(initialTaxa || 100);

  useEffect(() => {
    if (open) {
      setDataCompra(initialDataCompra);
      setIndexador(initialIndexador || "Selic");
      setTaxa(initialTaxa || 100);
    }
  }, [open, initialDataCompra, initialIndexador, initialTaxa]);

  const isValid = dataCompra && indexador && taxa > 0 && valorAtual > 0;

  const result = isValid
    ? calcularAcrualValorAplicado({
        valorAtual,
        dataInicio: dataCompra,
        indexador,
        taxaContratada: taxa,
        macroData,
      })
    : null;

  const lucro = result ? valorAtual - result.valorAplicadoEstimado : 0;
  const lucroPct = result && result.valorAplicadoEstimado > 0
    ? (lucro / result.valorAplicadoEstimado) * 100
    : 0;

  const handleConfirm = () => {
    if (!result) return;
    onConfirm({
      totalAportado: result.valorAplicadoEstimado,
      indexador,
      taxa,
      dataCompra,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Recalcular Total Aportado
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Estima o valor inicial de aplicação usando histórico SELIC/IPCA do BCB e
            sua taxa contratada. Os campos abaixo serão atualizados também no formulário
            principal ao confirmar.
          </p>

          <div className="rounded-xl bg-muted/30 p-3 border border-border/40">
            <p className="text-[10px] text-muted-foreground uppercase">Valor atual</p>
            <p className="text-base font-heading font-bold">
              R$ {valorAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div>
            <Label className="text-xs">Data de compra</Label>
            <Input
              type="date"
              value={dataCompra}
              onChange={e => setDataCompra(e.target.value)}
              className="rounded-xl"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Indexador</Label>
              <Select value={indexador} onValueChange={setIndexador}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDEXADORES.filter(Boolean).map(i => (
                    <SelectItem key={i} value={i}>{i}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Taxa (%)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={taxa || ""}
                onChange={e => setTaxa(Math.max(0, +e.target.value))}
                className="rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {indexador === "CDI" || indexador === "Selic"
                  ? "Ex: 100 = 100% do indexador"
                  : "Taxa anual contratada"}
              </p>
            </div>
          </div>

          {result && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 space-y-2">
              <p className="text-[10px] text-emerald-900 uppercase font-semibold">
                Preview do cálculo
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <span className="text-muted-foreground">Aplicado estimado:</span>
                <span className="font-bold text-right">
                  R$ {result.valorAplicadoEstimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-muted-foreground">Lucro:</span>
                <span className={`font-semibold text-right ${lucro >= 0 ? "text-emerald-700" : "text-destructive"}`}>
                  {lucro >= 0 ? "+" : ""}R$ {lucro.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} ({lucroPct.toFixed(2)}%)
                </span>
                <span className="text-muted-foreground">Período:</span>
                <span className="text-right">{result.mesesDecorridos} mês(es)</span>
                <span className="text-muted-foreground">Método:</span>
                <span className="text-right text-[10px]">
                  {result.metodo === "pos_fixado" && "Pós-fixado"}
                  {result.metodo === "prefixado" && "Prefixado"}
                  {result.metodo === "hibrido_ipca" && "Híbrido IPCA+"}
                  {result.metodo === "fallback" && "Fallback (sem cálculo)"}
                </span>
              </div>
              {result.warnings.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-emerald-200/50">
                  {result.warnings.map((w, i) => (
                    <div key={i} className="flex items-start gap-1.5">
                      <AlertCircle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-[10px] text-amber-800">{w}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isValid && (
            <p className="text-[11px] text-amber-700 bg-amber-50/60 border border-amber-200 rounded-lg p-2">
              Preencha data de compra, indexador, taxa &gt; 0 e tenha valor atual válido.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1 rounded-xl"
              disabled={!isValid || result?.metodo === "fallback"}
              onClick={handleConfirm}
            >
              Aplicar e fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
