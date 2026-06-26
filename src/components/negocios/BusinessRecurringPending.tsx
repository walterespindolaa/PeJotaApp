import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { Check, SkipForward, Pencil, RefreshCw, Settings } from "lucide-react";
import { format, parseISO } from "date-fns";
import PrivacyValue from "@/components/PrivacyValue";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import type { RecurringInstance, RecurringTemplate } from "@/hooks/useBusinessRecurring";
import type { BusinessCategory } from "@/hooks/useCompanies";

interface Props {
  pendingInstances: RecurringInstance[];
  templates: RecurringTemplate[];
  categories: BusinessCategory[];
  onConfirm: (instance: RecurringInstance, amount?: number) => Promise<any>;
  onSkip: (id: string) => void;
  onOpenManagement?: () => void;
}

export default function BusinessRecurringPending({ pendingInstances, templates, categories, onConfirm, onSkip, onOpenManagement }: Props) {
  const { fmt } = usePrivacyFmt();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [confirming, setConfirming] = useState<string | null>(null);

  if (pendingInstances.length === 0 && templates.length === 0) return null;

  const getTemplate = (id: string) => templates.find(t => t.id === id);
  const getCatLabel = (catId: string | null) => {
    if (!catId) return "";
    const cat = categories.find(c => c.id === catId);
    return cat ? cat.name : "";
  };

  const handleConfirm = async (inst: RecurringInstance) => {
    // Idempotency: already confirmed
    if (inst.transaction_id || inst.status === "confirmed") return;
    setConfirming(inst.id);
    try {
      const amount = editingId === inst.id ? parseFloat(editAmount.replace(",", ".")) : undefined;
      await onConfirm(inst, amount && !isNaN(amount) ? amount : undefined);
    } finally {
      setConfirming(null);
      setEditingId(null);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.02]">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-heading">Recorrências deste mês</CardTitle>
          {pendingInstances.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{pendingInstances.length} pendente{pendingInstances.length > 1 ? "s" : ""}</Badge>
          )}
          {onOpenManagement && (
            <Button variant="ghost" size="sm" className="ml-auto h-6 text-[10px] gap-1 text-muted-foreground" onClick={onOpenManagement}>
              <Settings className="h-3 w-3" /> Gerenciar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {pendingInstances.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-2">Tudo em dia! Nenhuma recorrência pendente.</p>
        )}
        {pendingInstances.map(inst => {
          const tpl = getTemplate(inst.template_id);
          if (!tpl) return null;
          const isEditing = editingId === inst.id;
          const isConfirming = confirming === inst.id;
          const alreadyConfirmed = !!inst.transaction_id || inst.status === "confirmed";

          return (
            <div key={inst.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg bg-card border border-border">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={tpl.type === "in" ? "default" : "destructive"} className="text-[9px] h-4">
                    {tpl.type === "in" ? "Entrada" : "Saída"}
                  </Badge>
                  <span className="text-sm font-medium truncate">{tpl.title}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-muted-foreground">
                    Venc. {format(parseISO(inst.due_date), "dd/MM")}
                  </span>
                  {tpl.category_id && (
                    <span className="text-[10px] text-muted-foreground">{getCatLabel(tpl.category_id)}</span>
                  )}
                </div>
                {isEditing && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic">Essa edição vale apenas para este mês.</p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {isEditing ? (
                  <Input
                    className="w-24 h-7 text-xs"
                    value={editAmount}
                    onChange={e => setEditAmount(e.target.value)}
                    type="number"
                    step="0.01"
                  />
                ) : (
                  <span className={`text-sm font-bold ${tpl.type === "in" ? "text-emerald-600" : "text-destructive"}`}>
                    <PrivacyValue>{fmt(inst.amount)}</PrivacyValue>
                  </span>
                )}

                <Button
                  variant="ghost" size="icon" className="h-7 w-7"
                  disabled={isConfirming || alreadyConfirmed}
                  onClick={() => {
                    if (isEditing) { setEditingId(null); }
                    else { setEditingId(inst.id); setEditAmount(String(inst.amount)); }
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>

                <Button
                  size="sm" className="h-7 text-xs gap-1"
                  disabled={isConfirming || alreadyConfirmed}
                  onClick={() => handleConfirm(inst)}
                >
                  {isConfirming ? (
                    <RefreshCw className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  {alreadyConfirmed ? "Confirmado" : "Confirmar"}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline" size="icon" className="h-7 w-7"
                      disabled={isConfirming || alreadyConfirmed}
                      title="Pular este mês"
                    >
                      <SkipForward className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Pular "{tpl.title}" este mês?</AlertDialogTitle>
                      <AlertDialogDescription>
                        O lançamento não será registrado neste mês. A recorrência continuará normalmente no próximo mês.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onSkip(inst.id)}>Pular</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
