import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import type { RecurringTemplate } from "@/hooks/useBusinessRecurring";
import type { BusinessCategory } from "@/hooks/useCompanies";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: RecurringTemplate[];
  categories: BusinessCategory[];
  onUpdate: (id: string, updates: Partial<Pick<RecurringTemplate, "amount" | "due_day" | "active" | "end_month" | "title">>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export default function BusinessRecurringManager({ open, onOpenChange, templates, categories, onUpdate, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFields, setEditFields] = useState<{ amount: string; due_day: string; end_month: string }>({ amount: "", due_day: "", end_month: "" });

  const getCatLabel = (catId: string | null) => {
    if (!catId) return "";
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : "";
  };

  const startEdit = (tpl: RecurringTemplate) => {
    setEditingId(tpl.id);
    setEditFields({
      amount: String(tpl.amount),
      due_day: String(tpl.due_day),
      end_month: tpl.end_month ? tpl.end_month.substring(0, 7) : "",
    });
  };

  const saveEdit = async (tpl: RecurringTemplate) => {
    const amount = parseFloat(editFields.amount.replace(",", "."));
    const due_day = Math.min(28, Math.max(1, parseInt(editFields.due_day) || tpl.due_day));
    const end_month = editFields.end_month ? editFields.end_month + "-01" : null;

    await onUpdate(tpl.id, {
      amount: isNaN(amount) ? tpl.amount : amount,
      due_day,
      end_month,
    });
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">Gerenciar Recorrências</DialogTitle>
        </DialogHeader>

        {templates.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma recorrência cadastrada.</p>
        )}

        <div className="space-y-3">
          {templates.map(tpl => {
            const isEditing = editingId === tpl.id;

            return (
              <div key={tpl.id} className={`p-3 rounded-lg border ${tpl.active ? "bg-card border-border" : "bg-muted/50 border-border/50 opacity-60"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={tpl.type === "in" ? "default" : "destructive"} className="text-[9px] h-4">
                    {tpl.type === "in" ? "Entrada" : "Saída"}
                  </Badge>
                  <span className="text-sm font-medium flex-1 truncate">{tpl.title}</span>
                  <div className="flex items-center gap-1.5">
                    <Label className="text-[10px] text-muted-foreground">{tpl.active ? "Ativa" : "Pausada"}</Label>
                    <Switch
                      checked={tpl.active}
                      onCheckedChange={(checked) => onUpdate(tpl.id, { active: checked })}
                      className="scale-75"
                    />
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Valor padrão</Label>
                        <Input
                          className="h-7 text-xs mt-0.5"
                          type="number" step="0.01"
                          value={editFields.amount}
                          onChange={e => setEditFields(p => ({ ...p, amount: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground">Dia vencimento</Label>
                        <Input
                          className="h-7 text-xs mt-0.5"
                          type="number" min={1} max={28}
                          value={editFields.due_day}
                          onChange={e => setEditFields(p => ({ ...p, due_day: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Mês final (opcional)</Label>
                      <Input
                        className="h-7 text-xs mt-0.5"
                        type="month"
                        value={editFields.end_month}
                        onChange={e => setEditFields(p => ({ ...p, end_month: e.target.value }))}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                      <Button size="sm" className="h-6 text-xs" onClick={() => saveEdit(tpl)}>
                        <Check className="h-3 w-3 mr-1" /> Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>R$ {Number(tpl.amount).toFixed(2)}</span>
                    <span>•</span>
                    <span>Dia {tpl.due_day}</span>
                    {tpl.category_id && (
                      <>
                        <span>•</span>
                        <span>{getCatLabel(tpl.category_id)}</span>
                      </>
                    )}
                    {tpl.end_month && (
                      <>
                        <span>•</span>
                        <span>Até {tpl.end_month.substring(0, 7)}</span>
                      </>
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 ml-auto" onClick={() => startEdit(tpl)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => onDelete(tpl.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
