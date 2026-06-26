import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import type { LifeEvent } from "@/lib/financial_engine/life_projection";

interface Props {
  event: LifeEvent;
  minYear: number;
  maxYear: number;
  onSave: (e: LifeEvent) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}

type ImpactType = "gasto_unico" | "gasto_recorrente" | "entrada";

function getImpactType(ev: LifeEvent): ImpactType {
  if (ev.impactValue < 0) return "entrada";
  if ((ev.monthlyImpact || 0) > 0) return "gasto_recorrente";
  return "gasto_unico";
}

export default function ProjecaoEventEditor({ event, minYear, maxYear, onSave, onRemove, onClose }: Props) {
  const [ev, setEv] = useState<LifeEvent>({ ...event });
  const [impactType, setImpactType] = useState<ImpactType>(getImpactType(event));

  const handleImpactTypeChange = (type: ImpactType) => {
    setImpactType(type);
    if (type === "entrada") {
      setEv(p => ({ ...p, impactValue: -Math.abs(p.impactValue || 10000), monthlyImpact: 0 }));
    } else if (type === "gasto_recorrente") {
      setEv(p => ({ ...p, impactValue: Math.abs(p.impactValue), monthlyImpact: p.monthlyImpact || 1000 }));
    } else {
      setEv(p => ({ ...p, impactValue: Math.abs(p.impactValue), monthlyImpact: 0 }));
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <span className="text-2xl">{ev.emoji}</span> {ev.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={ev.name} onChange={e => setEv(p => ({ ...p, name: e.target.value }))} className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <div className="flex items-center gap-2">
              <Slider value={[ev.year]} onValueChange={([v]) => setEv(p => ({ ...p, year: v }))} min={minYear} max={maxYear} step={1} className="flex-1" />
              <span className="text-sm font-mono font-semibold w-12 text-right text-primary">{ev.year}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo de Impacto</Label>
            <Select value={impactType} onValueChange={(v) => handleImpactTypeChange(v as ImpactType)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gasto_unico">Gasto Único</SelectItem>
                <SelectItem value="gasto_recorrente">Gasto Recorrente</SelectItem>
                <SelectItem value="entrada">Entrada de Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">
              {impactType === "entrada" ? "Valor da Entrada (R$)" : "Impacto Único (R$)"}
            </Label>
            <Input
              type="number"
              value={Math.abs(ev.impactValue)}
              onChange={e => {
                const abs = Number(e.target.value) || 0;
                setEv(p => ({ ...p, impactValue: impactType === "entrada" ? -abs : abs }));
              }}
              className="h-8 text-sm"
            />
          </div>
          {impactType === "gasto_recorrente" && (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Impacto Mensal (R$)</Label>
                <Input type="number" value={ev.monthlyImpact || 0} onChange={e => setEv(p => ({ ...p, monthlyImpact: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Duração (meses, 0 = permanente)</Label>
                <Input type="number" value={ev.durationMonths || 0} onChange={e => setEv(p => ({ ...p, durationMonths: Number(e.target.value) || 0 }))} className="h-8 text-sm" />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          {ev.type !== "aposentadoria" && (
            <Button variant="destructive" size="sm" onClick={() => { onRemove(ev.id); onClose(); }}>
              <Trash2 className="h-3 w-3 mr-1" /> Remover
            </Button>
          )}
          <Button size="sm" onClick={() => onSave(ev)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
