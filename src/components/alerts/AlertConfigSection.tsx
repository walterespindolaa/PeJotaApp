import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

const OFFSET_OPTIONS = [15, 10, 7, 5, 3, 1];

interface Props {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  offsets: number[];
  onOffsetsChange: (v: number[]) => void;
  customMessage: string;
  onCustomMessageChange: (v: string) => void;
}

const AlertConfigSection = ({
  enabled, onEnabledChange, offsets, onOffsetsChange,
  customMessage, onCustomMessageChange,
}: Props) => {
  const toggleOffset = (offset: number) => {
    if (offsets.includes(offset)) {
      onOffsetsChange(offsets.filter(o => o !== offset));
    } else {
      onOffsetsChange([...offsets, offset].sort((a, b) => b - a));
    }
  };

  return (
    <div className="border-t pt-3 space-y-3">
      <div className="flex items-center gap-3">
        <Switch checked={enabled} onCheckedChange={onEnabledChange} id="alert-toggle" />
        <Label htmlFor="alert-toggle" className="flex items-center gap-1 text-sm">
          <Bell className="h-3 w-3" /> Receber alertas de vencimento
        </Label>
      </div>
      {enabled && (
        <>
          <div>
            <Label className="text-xs text-muted-foreground mb-2 block">Antecedência (dias)</Label>
            <div className="flex flex-wrap gap-1.5">
              {OFFSET_OPTIONS.map(offset => (
                <button
                  key={offset}
                  type="button"
                  onClick={() => toggleOffset(offset)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    offsets.includes(offset)
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {offset}d
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Mensagem do alerta (opcional)</Label>
            <Input
              value={customMessage}
              onChange={e => onCustomMessageChange(e.target.value)}
              placeholder="Deixe em branco para usar mensagem padrão"
              className="mt-1"
            />
          </div>
        </>
      )}
    </div>
  );
};

export default AlertConfigSection;
