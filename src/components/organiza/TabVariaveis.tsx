import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Link2, RefreshCw, Trash2 } from "lucide-react";
import ExpenseSourceBadge from "./ExpenseSourceBadge";
import SkipMonthButton from "@/components/common/SkipMonthButton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { useExpenseLinks } from "@/hooks/useExpenseLinks";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useToast } from "@/hooks/use-toast";
import CategoryManager from "./CategoryManager";
import EditVariavelDialog from "./EditVariavelDialog";
import type { Despesa } from "@/hooks/useOrganiza";

type Investimento = { id: string; nome: string; instituicao: string; recebe_proventos: boolean; frequencia_proventos: string };

interface Props {
  variaveis: Despesa[];
  totalVariaveis: number;
  totalFixas: number;
  mesAno: string;
  onAdd: (data: Partial<Despesa>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Despesa>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  nomePessoa1: string;
  nomePessoa2: string;
  investimentos?: Investimento[];
  mesFechado?: boolean;
}

// fmt provided by usePrivacyFmt hook

const statusColor: Record<string, string> = {
  pago: "bg-success text-success-foreground",
  a_pagar: "bg-warning text-warning-foreground",
  em_atraso: "bg-destructive text-destructive-foreground",
};
const statusLabel: Record<string, string> = { pago: "✓ Pago", a_pagar: "A pagar", em_atraso: "Em atraso" };

const TabVariaveis = ({ variaveis, totalVariaveis, totalFixas, mesAno, onAdd, onUpdate, onDelete, nomePessoa1, nomePessoa2, investimentos = [], mesFechado }: Props) => {
  const { fmt, isPrivate } = usePrivacyFmt();
  const { toast } = useToast();
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const { customs, allVariaveis: CATEGORIAS, add: addCat, remove: removeCat } = useCustomCategories();
  const { getLinkForExpense, upsertLink, removeLink } = useExpenseLinks();
  const [open, setOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [form, setForm] = useState({
    descricao: "", valor: "", categoria: "Alimentação", data: `${mesAno}-01`, responsavel: "Pessoa 1",
    vincularInvestimento: false, investimento_id: "", valor_vinculado: "",
    recorrente: false, ajuste_variacao: true,
  });

  const ativosComProventos = investimentos.filter(i => i.recebe_proventos && i.frequencia_proventos !== "sem_proventos");

  const handleSubmit = async () => {
    const valor = parseBRL(form.valor);
    if (!valor) return;
    await onAdd({ descricao: form.descricao, valor, categoria: form.categoria, tipo: "variavel", status: "a_pagar", data: form.data, is_parcelada: false, responsavel: form.responsavel, recorrente: form.recorrente, ajuste_variacao: form.ajuste_variacao } as any);
    setForm({ descricao: "", valor: "", categoria: "Alimentação", data: `${mesAno}-01`, responsavel: "Pessoa 1", vincularInvestimento: false, investimento_id: "", valor_vinculado: "", recorrente: false, ajuste_variacao: true });
    setOpen(false);
  };

  const cycleStatus = (e: React.MouseEvent, d: Despesa) => {
    e.stopPropagation();
    const order = ["a_pagar", "pago", "em_atraso"];
    const next = order[(order.indexOf(d.status) + 1) % order.length];
    onUpdate(d.id, { status: next });
  };

  const openEdit = (d: Despesa) => {
    setEditingDespesa(d);
    setDrawerOpen(true);
  };

  const handleRowDelete = async (d: Despesa) => {
    try {
      const realId = d._originalId || d.id;
      const link = getLinkForExpense(realId);
      if (link) await removeLink(realId);
      await onDelete(d.id);
      toast({ title: "Despesa excluída" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    }
  };

  // Category breakdown
  const categoriaMap: Record<string, number> = {};
  variaveis.forEach(d => {
    const cat = d.categoria || "Outros";
    categoriaMap[cat] = (categoriaMap[cat] || 0) + Number(d.valor);
  });
  const COLORS = [
    "hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--chart-3))",
    "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(210 60% 50%)",
    "hsl(30 70% 50%)", "hsl(280 50% 50%)", "hsl(160 50% 45%)",
  ];
  const donutData = Object.entries(categoriaMap)
    .map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Variáveis</p>
            <p className="text-lg font-heading font-bold text-accent">{fmt(totalVariaveis)}</p>
          </CardContent>
        </Card>
        {donutData.length > 0 && (
          <Card className="shadow-soft">
            <CardContent className="p-4 flex items-center gap-4">
              <ResponsiveContainer width={100} height={100}>
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={25} outerRadius={45} paddingAngle={3}>
                    {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 text-sm">
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    <span>{d.name}: {isPrivate ? "••••" : `${totalVariaveis > 0 ? ((d.value / totalVariaveis) * 100).toFixed(0) : 0}%`}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nova Variável</Button></DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Adicionar Despesa Variável</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input aria-label="Descrição da despesa variável" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              <MoneyInput value={form.valor} onChange={v => setForm(f => ({ ...f, valor: v }))} />
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={form.recorrente} onCheckedChange={v => setForm(f => ({ ...f, recorrente: v }))} id="rec-var" />
                  <Label htmlFor="rec-var" className="flex items-center gap-1 text-sm"><RefreshCw className="h-3 w-3" /> Recorrente mensal</Label>
                </div>
                {form.recorrente && (
                  <div className="flex items-center gap-3">
                    <Switch checked={form.ajuste_variacao} onCheckedChange={v => setForm(f => ({ ...f, ajuste_variacao: v }))} id="ajuste-var" />
                    <Label htmlFor="ajuste-var" className="text-sm">Permite ajuste de valor</Label>
                  </div>
                )}
              </div>
              {ativosComProventos.length > 0 && (
                <div className="border-t pt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.vincularInvestimento} onCheckedChange={v => setForm(f => ({ ...f, vincularInvestimento: v }))} id="vinc-inv-var" />
                    <Label htmlFor="vinc-inv-var" className="flex items-center gap-1 text-sm"><Link2 className="h-3 w-3" /> Vincular a investimento</Label>
                  </div>
                  {form.vincularInvestimento && (
                    <>
                      <Select value={form.investimento_id} onValueChange={v => setForm(f => ({ ...f, investimento_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione o ativo" /></SelectTrigger>
                        <SelectContent>
                          {ativosComProventos.map(i => (
                            <SelectItem key={i.id} value={i.id}>{i.nome} — {i.instituicao}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input aria-label="Valor do provento vinculado (R$)" placeholder="Valor do provento vinculado (R$)" type="number" value={form.valor_vinculado} onChange={e => setForm(f => ({ ...f, valor_vinculado: e.target.value }))} />
                    </>
                  )}
                </div>
              )}
              <Button onClick={handleSubmit} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
        <CategoryManager customs={customs} onAdd={addCat} onRemove={removeCat} tipoFilter="variavel" />
      </div>

      <div className="space-y-2">
        {variaveis.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma despesa variável neste mês.</p>}
        {variaveis.map(d => {
          const link = getLinkForExpense(d._originalId || d.id);
          const linkedInv = link ? investimentos.find(i => i.id === link.investment_id) : null;
          return (
            <Card
              key={d.id}
              className={`shadow-soft ${(d as any)._skipped ? "opacity-50" : "cursor-pointer"} hover:ring-1 hover:ring-primary/30 transition-all`}
              onClick={(d as any)._skipped ? undefined : () => openEdit(d)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                {(d as any)._skipped ? (
                  <Badge className="bg-muted text-muted-foreground flex-shrink-0">Pulado</Badge>
                ) : (
                  <button onClick={(e) => cycleStatus(e, d)} className="flex-shrink-0">
                    <Badge className={`cursor-pointer ${statusColor[d.status] || statusColor.a_pagar}`}>{statusLabel[d.status] || d.status}</Badge>
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <ExpenseSourceBadge source={(d as any).forma_pagamento === "credit_card" ? "credit_card" : "manual"} />
                    <p className="text-sm font-medium truncate">{d.descricao || d.categoria}</p>
                    {d.recorrente && <RefreshCw className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                    {d.ajuste_variacao && <Badge variant="outline" className="text-[10px] px-1 py-0">variável</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{d.categoria} · {getLabel(d.responsavel)}</p>
                  {linkedInv && link && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Link2 className="h-3 w-3 text-primary" />
                      <span className="text-[10px] text-primary font-medium">
                        {linkedInv.nome} — {linkedInv.instituicao} · Vinculado: {fmt(link.valor_vinculado)}
                      </span>
                    </div>
                  )}
                </div>
                <p className="font-heading font-bold text-sm">{fmt(Number(d.valor))}</p>
                {d.recorrente && !mesFechado && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <SkipMonthButton
                      templateId={(d as any)._originalId || d.id}
                      monthRef={mesAno}
                      variant="ghost"
                      size="sm"
                      showLabel={false}
                    />
                  </div>
                )}
                {!mesFechado && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => e.stopPropagation()}
                        className="text-destructive h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {d.descricao || d.categoria} — {fmt(Number(d.valor))}. Essa ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleRowDelete(d)}>Excluir</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EditVariavelDialog
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        despesa={editingDespesa}
        categorias={CATEGORIAS}
        responsavelOptions={responsavelOptions}
        investimentos={investimentos}
        existingLink={editingDespesa ? getLinkForExpense(editingDespesa._originalId || editingDespesa.id) : undefined}
        onUpdate={onUpdate}
        onDelete={onDelete}
        onUpsertLink={upsertLink}
        onRemoveLink={removeLink}
        mesFechado={mesFechado}
      />
    </div>
  );
};

export default TabVariaveis;
