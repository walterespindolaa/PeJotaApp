import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import SkipMonthButton from "@/components/common/SkipMonthButton";
import type { Despesa, Receita, InstallmentInstance } from "@/hooks/useOrganiza";

interface Props {
  despesas: Despesa[];
  receitas: Receita[];
  installmentInstances?: (InstallmentInstance & { descricao?: string; total_parcelas?: number })[];
  mesAno: string;
  mesFechado: boolean;
  onUpdateDespesa: (id: string, data: Partial<Despesa>) => Promise<void>;
  onUpdateReceita: (id: string, data: Partial<Receita>) => Promise<void>;
  onUpdateInstance?: (id: string, status: string) => Promise<void>;
}

// fmt provided by usePrivacyFmt hook

const despesaStatusColor: Record<string, string> = {
  pago: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
  a_pagar: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
  em_atraso: "bg-destructive text-destructive-foreground",
};
const despesaStatusLabel: Record<string, string> = {
  pago: "✓ Pago", a_pagar: "A pagar", em_atraso: "Em atraso",
};
const receitaStatusColor: Record<string, string> = {
  recebido: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
  pendente: "bg-muted text-muted-foreground",
  em_atraso: "bg-destructive text-destructive-foreground",
};
const receitaStatusLabel: Record<string, string> = {
  recebido: "✓ Recebido", pendente: "A receber", em_atraso: "Atrasado",
};
// Installment status maps (pending/paid/late → same visual as despesas)
const instStatusColor: Record<string, string> = {
  paid: "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]",
  pending: "bg-[hsl(var(--warning))] text-[hsl(var(--warning-foreground))]",
  late: "bg-destructive text-destructive-foreground",
};
const instStatusLabel: Record<string, string> = {
  paid: "✓ Pago", pending: "A pagar", late: "Em atraso",
};

type CalendarItem = {
  id: string;
  type: "despesa" | "receita" | "installment";
  descricao: string;
  valor: number;
  status: string;
  categoria: string;
  day: number;
  dueDate?: string;
  recorrente?: boolean;
  templateId?: string;
  _skipped?: boolean;
};

const todayStr = () => new Date().toISOString().split("T")[0];

const resolveItemStatus = (it: { type: string; status: string; dueDate?: string }): string => {
  if (it.type !== "installment") return it.status;
  if (it.status === "paid") return "paid";
  if (it.status === "pending" && it.dueDate && it.dueDate < todayStr()) return "late";
  if (it.status === "late") return "late";
  return "pending";
};

const TabCalendario = ({ despesas, receitas, installmentInstances = [], mesAno, mesFechado, onUpdateDespesa, onUpdateReceita, onUpdateInstance }: Props) => {
  const { fmt } = usePrivacyFmt();
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [editItem, setEditItem] = useState<CalendarItem | null>(null);

  const [year, month] = mesAno.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const mesLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const itemsByDay = useMemo(() => {
    const map: Record<number, CalendarItem[]> = {};
    for (let i = 1; i <= daysInMonth; i++) map[i] = [];

    despesas.forEach(d => {
      const day = d.vencimento || d.dia_vencimento || new Date(d.data + "T12:00:00").getDate();
      if (day >= 1 && day <= daysInMonth) {
        map[day].push({
          id: d.id, type: "despesa", descricao: d.descricao || d.categoria,
          valor: Number(d.valor), status: d.status, categoria: d.categoria, day,
          recorrente: d.recorrente,
          templateId: (d as any)._originalId || d.id,
          _skipped: (d as any)._skipped,
        });
      }
    });

    receitas.forEach(r => {
      const day = r.dia_recebimento || new Date(r.data + "T12:00:00").getDate();
      if (day >= 1 && day <= daysInMonth) {
        map[day].push({
          id: r.id, type: "receita", descricao: r.descricao || r.categoria,
          valor: Number(r.valor), status: r.status, categoria: r.categoria, day,
          recorrente: r.recorrente,
          templateId: (r as any)._originalId || r.id,
        });
      }
    });

    // Installment instances
    installmentInstances.forEach(inst => {
      const day = new Date(inst.due_date + "T12:00:00").getDate();
      if (day >= 1 && day <= daysInMonth) {
        const label = `${inst.descricao || "Parcela"} (${inst.installment_number}/${inst.total_parcelas || "?"})`;
        map[day].push({
          id: inst.id, type: "installment", descricao: label,
          valor: Number(inst.amount), status: inst.status, categoria: "Parcelamento", day,
          dueDate: inst.due_date,
        });
      }
    });

    return map;
  }, [despesas, receitas, installmentInstances, daysInMonth]);

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;

  const handleStatusChange = async (item: CalendarItem, newStatus: string) => {
    if (mesFechado) return;
    if (item.type === "despesa") {
      await onUpdateDespesa(item.id, { status: newStatus });
    } else if (item.type === "receita") {
      await onUpdateReceita(item.id, { status: newStatus });
    } else if (item.type === "installment" && onUpdateInstance) {
      await onUpdateInstance(item.id, newStatus);
    }
    setEditItem(null);
  };

  const dayItems = selectedDay ? itemsByDay[selectedDay] || [] : [];

  const getColorMap = (type: string) => type === "receita" ? receitaStatusColor : type === "installment" ? instStatusColor : despesaStatusColor;
  const getLabelMap = (type: string) => type === "receita" ? receitaStatusLabel : type === "installment" ? instStatusLabel : despesaStatusLabel;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-heading font-bold capitalize">{mesLabel}</h3>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div>
            <p className="text-[10px] text-muted-foreground font-medium mb-1">Despesas / Parcelas</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" /> Pago</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[hsl(var(--warning))]" /> A pagar</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Atraso</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground font-medium mb-1">Receitas</p>
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[hsl(var(--success))]" /> Recebido</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-muted" /> A receber</span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-destructive" /> Atraso</span>
            </div>
          </div>
        </div>
      </div>

      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
            ))}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const items = itemsByDay[day] || [];
              const visibleItems = items.filter(it => !it._skipped);
              const hasAtraso = visibleItems.some(it => { const s = resolveItemStatus(it); return s === "em_atraso" || s === "late"; });
              const hasPendente = visibleItems.some(it => { const s = resolveItemStatus(it); return s === "a_pagar" || s === "pendente" || s === "pending"; });
              const allPago = visibleItems.length > 0 && visibleItems.every(it => { const s = resolveItemStatus(it); return s === "pago" || s === "recebido" || s === "paid"; });
              const isToday = isCurrentMonth && today.getDate() === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(day)}
                  className={`relative p-2 min-h-[80px] md:min-h-[96px] rounded-xl border text-left transition-all duration-200 hover:bg-muted/50 hover:shadow-sm
                    ${selectedDay === day ? "border-primary bg-primary/5 shadow-sm" : "border-border/60"}
                    ${isToday ? "ring-2 ring-primary/40 bg-primary/3" : ""}
                  `}
                >
                  <span className={`text-sm font-medium ${isToday ? "text-primary font-bold" : "text-foreground"}`}>{day}</span>
                  {items.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {items.slice(0, 3).map((it, idx) => {
                        const effStatus = resolveItemStatus(it);
                        const isPaid = effStatus === "pago" || effStatus === "recebido" || effStatus === "paid";
                        const isOverdue = effStatus === "em_atraso" || effStatus === "late";
                        const isIncome = it.type === "receita";
                        const isSkipped = it._skipped;
                        return (
                          <div key={idx} className={`text-[10px] leading-snug truncate px-1.5 py-0.5 rounded-md font-medium ${
                            isSkipped ? "bg-muted text-muted-foreground opacity-50 line-through" :
                            isPaid ? "bg-success/15 text-success" : isOverdue ? "bg-destructive/15 text-destructive" : isIncome ? "bg-muted text-muted-foreground" : "bg-warning/15 text-warning"
                          }`}>
                            {isIncome ? "↑" : "↓"} {fmt(it.valor).replace("R$\u00a0", "")}
                          </div>
                        );
                      })}
                      {items.length > 3 && (
                        <p className="text-[10px] text-muted-foreground px-1.5 font-medium">+{items.length - 3}</p>
                      )}
                    </div>
                  )}
                  {items.length > 0 && (
                    <div className={`absolute top-2 right-2 w-2 h-2 rounded-full ${
                      hasAtraso ? "bg-destructive" : hasPendente ? "bg-warning" : allPago ? "bg-success" : ""
                    }`} />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {selectedDay && (
        <Card className="shadow-soft">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-heading font-bold text-sm">Dia {selectedDay}</h4>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDay(null)}>Fechar</Button>
            </div>
            {dayItems.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nenhum lançamento neste dia.</p>
            ) : (
              dayItems.map(it => {
                const colorMap = getColorMap(it.type);
                const labelMap = getLabelMap(it.type);
                const effStatus = resolveItemStatus(it);
                const isSkipped = it._skipped;
                return (
                  <div key={it.id} className={`flex items-center gap-3 p-2 rounded-md border border-border ${isSkipped ? "opacity-50" : ""}`}>
                    {isSkipped ? (
                      <Badge className="bg-muted text-muted-foreground flex-shrink-0">Pulado</Badge>
                    ) : (
                      <Badge className={`cursor-pointer ${colorMap[effStatus] || "bg-muted text-muted-foreground"}`}
                        onClick={() => !mesFechado && setEditItem(it)}
                      >
                        {labelMap[effStatus] || effStatus}
                      </Badge>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{it.descricao}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.type === "receita" ? "Receita" : it.type === "installment" ? "Parcela" : "Despesa"} · {it.categoria}
                      </p>
                    </div>
                    <p className={`font-heading font-bold text-sm ${it.type === "receita" ? "text-[hsl(var(--success))]" : "text-destructive"}`}>
                      {it.type === "receita" ? "+" : "-"}{fmt(it.valor)}
                    </p>
                    {it.type === "despesa" && it.recorrente && it.templateId && !mesFechado && (
                      <SkipMonthButton
                        templateId={it.templateId}
                        monthRef={mesAno}
                        variant="ghost"
                        size="sm"
                        showLabel={false}
                      />
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editItem} onOpenChange={() => setEditItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Status</DialogTitle>
          </DialogHeader>
          {editItem && (
            <div className="space-y-3">
              <p className="text-sm"><strong>{editItem.descricao}</strong> — {fmt(editItem.valor)}</p>
              <Select
                value={editItem.status}
                onValueChange={(v) => handleStatusChange(editItem, v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {editItem.type === "despesa" ? (
                    <>
                      <SelectItem value="a_pagar">A pagar</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="em_atraso">Em atraso</SelectItem>
                    </>
                  ) : editItem.type === "installment" ? (
                    <>
                      <SelectItem value="pending">A pagar</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                      <SelectItem value="late">Em atraso</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="recebido">Recebido</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TabCalendario;
