import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Target, Pencil, Check, X, ArrowDownToLine, Loader2 } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useToast } from "@/hooks/use-toast";

import { ALL_DESPESA_CATEGORY_NAMES, CATEGORY_ICON_MAP } from "@/lib/categories";

const CATEGORY_ICONS = CATEGORY_ICON_MAP;
const DEFAULT_CATEGORIES = ALL_DESPESA_CATEGORY_NAMES;

interface OrcamentoItem {
  categoria: string;
  gasto: number;
  limite: number;
  percentual: number;
}

interface InheritanceState {
  isInherited: boolean;
  fromMonth: string | null;
}

interface Props {
  orcamentoPorCategoria: OrcamentoItem[];
  onUpsertOrcamento: (categoria: string, valor: number) => Promise<void>;
  mesAno: string;
  inheritanceState?: InheritanceState;
  onConfirmInheritance?: () => Promise<number>;
}

function formatBudgetMonth(mesAno: string): string {
  const [y, m] = mesAno.split("-").map(Number);
  const d = new Date(y, m - 1);
  const month = d.toLocaleDateString("pt-BR", { month: "long" });
  return `${month}/${y}`;
}

// fmt provided by usePrivacyFmt hook

const TabOrcamento = ({ orcamentoPorCategoria, onUpsertOrcamento, mesAno, inheritanceState, onConfirmInheritance }: Props) => {
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();
  const [editingCat, setEditingCat] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [confirmingInheritance, setConfirmingInheritance] = useState(false);

  const showInheritanceBanner =
    !!inheritanceState?.isInherited &&
    !!inheritanceState.fromMonth &&
    !bannerDismissed;

  const handleConfirmInheritance = async () => {
    if (!onConfirmInheritance || !inheritanceState?.fromMonth) return;
    setConfirmingInheritance(true);
    try {
      await onConfirmInheritance();
      toast({
        title: "Orçamento confirmado",
        description: `Orçamento de ${formatBudgetMonth(mesAno)} criado a partir de ${formatBudgetMonth(inheritanceState.fromMonth)}.`,
      });
    } finally {
      setConfirmingInheritance(false);
    }
  };

  // Merge defaults with existing budgets
  const allCategories = DEFAULT_CATEGORIES.map(cat => {
    const existing = orcamentoPorCategoria.find(o => o.categoria === cat);
    return {
      categoria: cat,
      gasto: existing?.gasto || 0,
      limite: existing?.limite || 0,
      percentual: existing?.percentual || 0,
    };
  });

  // Add any custom categories from data not in defaults
  orcamentoPorCategoria.forEach(o => {
    if (!DEFAULT_CATEGORIES.includes(o.categoria)) {
      allCategories.push(o);
    }
  });

  const handleSave = async (cat: string) => {
    const val = parseFloat(editValue);
    if (!isNaN(val) && val > 0) {
      await onUpsertOrcamento(cat, val);
    }
    setEditingCat(null);
    setEditValue("");
  };

  const getBudgetColor = (pct: number) => {
    if (pct <= 80) return "bg-success";
    if (pct <= 100) return "bg-warning";
    return "bg-destructive";
  };

  const getBudgetTextColor = (pct: number) => {
    if (pct <= 80) return "text-success";
    if (pct <= 100) return "text-warning";
    return "text-destructive";
  };

  const totalLimite = allCategories.reduce((s, c) => s + c.limite, 0);
  const totalGasto = allCategories.reduce((s, c) => s + c.gasto, 0);

  return (
    <div className="space-y-6">
      {showInheritanceBanner && inheritanceState?.fromMonth && (
        <Card className="border-l-4 border-l-primary shadow-soft">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
                <ArrowDownToLine className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-heading font-semibold text-foreground">
                  Valores herdados de {formatBudgetMonth(inheritanceState.fromMonth)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 leading-snug">
                  Ajuste o que precisar e confirme. Sem confirmar, nada é salvo.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-3">
                  <Button
                    size="sm"
                    onClick={handleConfirmInheritance}
                    disabled={confirmingInheritance}
                    className="h-8 text-xs font-heading font-semibold"
                  >
                    {confirmingInheritance ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      "Confirmar valores herdados"
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setBannerDismissed(true)}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                  >
                    começar zerado
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-heading font-bold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Orçamento por Categoria
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Defina limites mensais recorrentes para cada categoria. Eles serão aplicados automaticamente em todos os meses futuros.
          </p>
        </div>
        {totalLimite > 0 && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Orçamento total</p>
            <p className="text-lg font-heading font-bold">{fmt(totalLimite)}</p>
            <p className="text-xs text-muted-foreground">Gasto: {fmt(totalGasto)} ({totalLimite > 0 ? ((totalGasto / totalLimite) * 100).toFixed(0) : 0}%)</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {allCategories.map(item => {
          const Icon = CATEGORY_ICONS[item.categoria] || Target;
          const isEditing = editingCat === item.categoria;
          const pct = item.limite > 0 ? Math.min((item.gasto / item.limite) * 100, 150) : 0;
          const restante = item.limite - item.gasto;

          return (
            <Card key={item.categoria} className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">{item.categoria}</span>
                  </div>
                  {!isEditing ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => { setEditingCat(item.categoria); setEditValue(item.limite > 0 ? String(item.limite) : ""); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-success" onClick={() => handleSave(item.categoria)}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingCat(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      type="number"
                      min={0}
                      placeholder="Limite mensal (R$)"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      className="h-8 text-sm rounded-xl"
                      onKeyDown={e => { if (e.key === "Enter") handleSave(item.categoria); }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                      <span>Gasto: {fmt(item.gasto)}</span>
                      <span>Limite: {item.limite > 0 ? fmt(item.limite) : "—"}</span>
                    </div>
                    {item.limite > 0 ? (
                      <>
                        <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${getBudgetColor(pct)}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1.5">
                          <span className={`text-xs font-medium ${getBudgetTextColor(pct)}`}>
                            {pct.toFixed(0)}%
                          </span>
                          <span className={`text-xs ${restante >= 0 ? "text-muted-foreground" : "text-destructive font-medium"}`}>
                            {restante >= 0 ? `Restante: ${fmt(restante)}` : `Excedido: ${fmt(Math.abs(restante))}`}
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic mt-1">Clique no lápis para definir o limite.</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TabOrcamento;
