import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ResponsiveEditDialog from "@/components/ui/responsive-edit-dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, AlertTriangle } from "lucide-react";
import ExpenseSourceBadge from "./ExpenseSourceBadge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useToast } from "@/hooks/use-toast";
import type { Despesa } from "@/hooks/useOrganiza";

import { CATEGORIAS_PARCELAS } from "@/lib/categories";
import { logWarn } from "@/lib/log";
const CATEGORIAS = CATEGORIAS_PARCELAS;

interface Props {
  parcelas: Despesa[];
  totalParcelas: number;
  mesAno: string;
  mesFechado?: boolean;
  onAdd: (data: Partial<Despesa>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Despesa>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateInstanceStatus?: (instanceId: string, status: string) => Promise<void>;
  nomePessoa1: string;
  nomePessoa2: string;
}

// fmt provided by usePrivacyFmt hook

const statusColor: Record<string, string> = {
  pago: "bg-success text-success-foreground",
  a_pagar: "bg-warning text-warning-foreground",
  em_atraso: "bg-destructive text-destructive-foreground",
};
const statusLabel: Record<string, string> = { pago: "✓ Pago", a_pagar: "A pagar", em_atraso: "Em atraso" };

const TabParcelas = ({ parcelas, totalParcelas, mesAno, mesFechado, onAdd, onUpdate, onDelete, onUpdateInstanceStatus, nomePessoa1, nomePessoa2 }: Props) => {
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    descricao: "", valor_total: "", total_parcelas: "", parcela_atual: "",
    categoria: "Outros", data: `${mesAno}-01`, responsavel: "Pessoa 1",
    tipo_parcelamento: "compra_parcelada",
  });

  const valorParcela = form.valor_total && form.total_parcelas
    ? parseBRL(form.valor_total) / Number(form.total_parcelas) : 0;
  const mesesRestantes = form.total_parcelas && form.parcela_atual
    ? Number(form.total_parcelas) - Number(form.parcela_atual) : 0;

  const resetForm = () => {
    setForm({ descricao: "", valor_total: "", total_parcelas: "", parcela_atual: "", categoria: "Outros", data: `${mesAno}-01`, responsavel: "Pessoa 1", tipo_parcelamento: "compra_parcelada" });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!form.valor_total || !form.total_parcelas || !form.parcela_atual) return;
    const vt = parseBRL(form.valor_total);
    const tp = Number(form.total_parcelas);
    const pa = Number(form.parcela_atual);

    if (editingId) {
      await onUpdate(editingId, {
        descricao: form.descricao, valor: vt / tp, valor_total: vt,
        total_parcelas: tp, parcela_atual: pa, categoria: form.categoria,
        data: form.data, responsavel: form.responsavel,
        tipo_parcelamento: form.tipo_parcelamento,
        data_inicio_parcelas: form.data,
      } as any);
    } else {
      await onAdd({
        descricao: form.descricao, valor: vt / tp, valor_total: vt,
        total_parcelas: tp, parcela_atual: pa, categoria: form.categoria,
        tipo: "fixa", status: "a_pagar", data: form.data,
        is_parcelada: true, data_inicio_parcelas: form.data,
        responsavel: form.responsavel,
        tipo_parcelamento: form.tipo_parcelamento,
      } as any);
    }
    resetForm();
    setOpen(false);
  };

  const handleEdit = (d: Despesa) => {
    const realId = (d as any)._originalId || d.id;
    setEditingId(realId);
    setForm({
      descricao: d.descricao || "",
      valor_total: String(d.valor_total || 0),
      total_parcelas: String(d.total_parcelas || 1),
      parcela_atual: String((d as any)._originalParcela || d.parcela_atual || 1),
      categoria: d.categoria || "Outros",
      data: d.data_inicio_parcelas || d.data,
      responsavel: d.responsavel || "Pessoa 1",
      tipo_parcelamento: d.tipo_parcelamento || "compra_parcelada",
    });
    setOpen(true);
  };

  const handleDelete = async (d: Despesa) => {
    try {
      const realId = (d as any)._originalId || d.id;
      await onDelete(realId);
      toast({ title: "Parcelamento excluído" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    }
  };

  const today = new Date().toISOString().split("T")[0];
  const displayStatus = (d: Despesa): string => {
    const raw = (d as any)._rawStatus;
    const due = (d as any)._dueDate;
    if (raw === "paid") return "pago";
    if (raw === "pending" && due && due < today) return "em_atraso";
    if (raw === "late") return "em_atraso";
    return "a_pagar";
  };

  const cycleStatus = (d: Despesa) => {
    if (mesFechado) return;
    const instanceId = (d as any)._instanceId;
    const rawStatus = (d as any)._rawStatus;
    const next = rawStatus === "paid" ? "a_pagar" : "pago";

    if (instanceId && onUpdateInstanceStatus) {
      onUpdateInstanceStatus(instanceId, next);
    } else {
      logWarn("[TabParcelas] missing _instanceId for parcela:", d.id);
      onUpdate(d.id, { status: next });
    }
  };

  const [year, month] = mesAno.split("-").map(Number);
  const projection = Array.from({ length: 12 }, (_, i) => {
    const m = ((month - 1 + i) % 12) + 1;
    const y = year + Math.floor((month - 1 + i) / 12);
    const label = `${String(m).padStart(2, "0")}/${y}`;
    const total = parcelas.reduce((s, p) => {
      const remaining = Number(p.total_parcelas) - Number(p.parcela_atual);
      return s + (i < remaining + 1 ? Number(p.valor) : 0);
    }, 0);
    return { label, total };
  });

  const totalAno = parcelas.reduce((s, p) => {
    const remaining = Math.min(Number(p.total_parcelas) - Number(p.parcela_atual) + 1, 12);
    return s + Number(p.valor) * remaining;
  }, 0);

  const pago = parcelas.filter(d => displayStatus(d) === "pago").reduce((s, d) => s + Number(d.valor), 0);
  const aPagar = parcelas.filter(d => displayStatus(d) === "a_pagar").reduce((s, d) => s + Number(d.valor), 0);
  const emAtraso = parcelas.filter(d => displayStatus(d) === "em_atraso").reduce((s, d) => s + Number(d.valor), 0);

  // Deduplicate: show each original parcela only once (by original ID)
  const uniqueParcelas = parcelas.reduce<Despesa[]>((acc, d) => {
    const realId = (d as any)._originalId || d.id;
    if (!acc.find(x => ((x as any)._originalId || x.id) === realId)) {
      acc.push(d);
    }
    return acc;
  }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Parcelas (mês)</p><p className="text-lg font-heading font-bold">{fmt(totalParcelas)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pago</p><p className="text-lg font-heading font-bold text-success">{fmt(pago)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">A pagar</p><p className="text-lg font-heading font-bold text-warning">{fmt(aPagar)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em atraso</p><p className="text-lg font-heading font-bold text-destructive">{fmt(emAtraso)}</p></CardContent></Card>
      </div>

      {parcelas.length > 0 && (
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <p className="text-sm font-heading font-medium mb-3">Projeção de Parcelas</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={projection}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {!mesFechado && (
        <>
          <Button className="gap-2" onClick={() => { resetForm(); setOpen(true); }}>
            <Plus className="h-4 w-4" /> Nova Parcela
          </Button>
          <ResponsiveEditDialog
            open={open}
            onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}
            title={editingId ? "Editar Parcelamento" : "Adicionar Despesa Parcelada"}
            footer={
              <Button onClick={handleSubmit} className="w-full">
                {editingId ? "Atualizar" : "Salvar"}
              </Button>
            }
          >
            <Input aria-label="Descrição do parcelamento" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            <MoneyInput placeholder="0,00" value={form.valor_total} onChange={v => setForm(f => ({ ...f, valor_total: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Número total de parcelas</label>
                <Input aria-label="Número total de parcelas" placeholder="Ex: 12" type="number" value={form.total_parcelas} onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Parcela atual</label>
                <Input aria-label="Parcela atual" placeholder="Ex: 1" type="number" value={form.parcela_atual} onChange={e => setForm(f => ({ ...f, parcela_atual: e.target.value }))} />
              </div>
            </div>
            {valorParcela > 0 && (
              <div className="p-2 rounded bg-muted text-sm space-y-1">
                <p>Valor da parcela: <strong>{fmt(valorParcela)}</strong></p>
                <p>Meses restantes: <strong>{mesesRestantes}</strong></p>
              </div>
            )}
            <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data de início</label>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </ResponsiveEditDialog>
        </>
      )}

      <div className="space-y-2">
        {uniqueParcelas.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma parcela registrada.</p>}
        {uniqueParcelas.map(d => (
          <Card key={d.id} className="shadow-soft">
            <CardContent className="p-3 flex items-center gap-3">
              <button onClick={() => cycleStatus(d)} className="flex-shrink-0" disabled={mesFechado}>
                <Badge className={`cursor-pointer ${statusColor[displayStatus(d)] || statusColor.a_pagar}`}>
                  {statusLabel[displayStatus(d)] || displayStatus(d)}
                </Badge>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <ExpenseSourceBadge source={(d as any).forma_pagamento === "credit_card" ? "credit_card" : "manual"} />
                  <p className="text-sm font-medium truncate">{d.descricao || d.categoria}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Parcela {d.parcela_atual} de {d.total_parcelas} · Total: {fmt(Number(d.valor_total))} · Restam {Number(d.total_parcelas) - Number(d.parcela_atual)} meses · {getLabel(d.responsavel)}
                </p>
              </div>
              <p className="font-heading font-bold text-sm">{fmt(Number(d.valor))}/mês</p>
              {!mesFechado && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(d)} className="text-primary h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()} className="text-destructive h-8 w-8">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Excluir parcelamento?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-2">
                            <p>{d.descricao || d.categoria} — {Number(d.total_parcelas) - Number(d.parcela_atual)} parcela(s) restante(s) de {fmt(Number(d.valor))}</p>
                            <p className="text-destructive">Atenção: isso remove o parcelamento inteiro, incluindo as parcelas futuras. O valor já pago nos meses anteriores não será estornado.</p>
                            <p>Esta ação não pode ser desfeita.</p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(d)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TabParcelas;
