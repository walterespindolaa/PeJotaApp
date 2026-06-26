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
import { Plus, RefreshCw, Link2, Trash2, AlertTriangle } from "lucide-react";
import ExpenseSourceBadge from "./ExpenseSourceBadge";
import SkipMonthButton from "@/components/common/SkipMonthButton";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { useCustomCategories } from "@/hooks/useCustomCategories";
import { useExpenseLinks } from "@/hooks/useExpenseLinks";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useToast } from "@/hooks/use-toast";
import AlertConfigSection from "@/components/alerts/AlertConfigSection";
import { usePaymentAlerts } from "@/hooks/usePaymentAlerts";
import CategoryManager from "./CategoryManager";
import EditExpenseDrawer from "./EditExpenseDrawer";
import type { Despesa } from "@/hooks/useOrganiza";

const FORMAS = ["Débito automático", "Boleto", "Cartão crédito", "Pix", "Dinheiro"];

type Investimento = { id: string; nome: string; instituicao: string; recebe_proventos: boolean; frequencia_proventos: string };

interface Props {
  fixas: Despesa[];
  totalFixas: number;
  mesAno: string;
  mesFechado: boolean;
  onAdd: (data: Partial<Despesa>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Despesa>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  nomePessoa1: string;
  nomePessoa2: string;
  investimentos?: Investimento[];
}

// fmt is now provided by usePrivacyFmt hook inside component

const statusColor: Record<string, string> = {
  pago: "bg-success text-success-foreground",
  a_pagar: "bg-warning text-warning-foreground",
  em_atraso: "bg-destructive text-destructive-foreground",
};
const statusLabel: Record<string, string> = { pago: "✓ Pago", a_pagar: "A pagar", em_atraso: "Em atraso" };

const TabFixas = ({ fixas, totalFixas, mesAno, mesFechado, onAdd, onUpdate, onDelete, nomePessoa1, nomePessoa2, investimentos = [] }: Props) => {
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const { customs, allFixas: CATEGORIAS, add: addCat, remove: removeCat } = useCustomCategories();
  const { getLinkForExpense, upsertLink, removeLink } = useExpenseLinks();
  const { upsertAlert, getAlertForSource } = usePaymentAlerts();
  const [open, setOpen] = useState(false);
  const [editingDespesa, setEditingDespesa] = useState<Despesa | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [alertEnabled, setAlertEnabled] = useState(false);
  const [alertOffsets, setAlertOffsets] = useState<number[]>([7, 3, 1]);
  const [alertMessage, setAlertMessage] = useState("");
  const [form, setForm] = useState({
    descricao: "", valor: "", categoria: "Moradia", vencimento: "",
    forma_pagamento: "Pix", data: `${mesAno}-01`,
    recorrente: true, dia_vencimento: "", ajuste_variacao: false,
    responsavel: "Pessoa 1",
    vincularInvestimento: false, investimento_id: "", valor_vinculado: "",
  });

  const pago = fixas.filter(d => d.status === "pago").reduce((s, d) => s + Number(d.valor), 0);
  const aPagar = fixas.filter(d => d.status === "a_pagar").reduce((s, d) => s + Number(d.valor), 0);
  const emAtraso = fixas.filter(d => d.status === "em_atraso").reduce((s, d) => s + Number(d.valor), 0);

  const ativosComProventos = investimentos.filter(i => i.recebe_proventos && i.frequencia_proventos !== "sem_proventos");

  const handleSubmit = async () => {
    const val = parseBRL(form.valor);
    if (!val) return;
    const diaVenc = form.vencimento ? Number(form.vencimento) : null;
    await onAdd({
      descricao: form.descricao, valor: val, valor_base: val, categoria: form.categoria,
      tipo: "fixa", status: "a_pagar",
      vencimento: diaVenc,
      dia_vencimento: diaVenc,
      forma_pagamento: form.forma_pagamento, data: `${mesAno}-${String(diaVenc || 1).padStart(2, "0")}`, is_parcelada: false,
      recorrente: form.recorrente, ajuste_variacao: form.ajuste_variacao,
      responsavel: form.responsavel,
    } as any);
    setForm({ descricao: "", valor: "", categoria: "Moradia", vencimento: "", forma_pagamento: "Pix", data: `${mesAno}-01`, recorrente: true, dia_vencimento: "", ajuste_variacao: false, responsavel: "Pessoa 1", vincularInvestimento: false, investimento_id: "", valor_vinculado: "" });
    setOpen(false);
  };

  const cycleStatus = (e: React.MouseEvent, d: Despesa) => {
    e.stopPropagation();
    if (mesFechado) return;
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
      toast({ title: "Despesa fixa excluída" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Fixas</p><p className="text-lg font-heading font-bold">{fmt(totalFixas)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pago</p><p className="text-lg font-heading font-bold text-success">{fmt(pago)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">A pagar</p><p className="text-lg font-heading font-bold text-warning">{fmt(aPagar)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Em atraso</p><p className="text-lg font-heading font-bold text-destructive">{fmt(emAtraso)}</p></CardContent></Card>
      </div>

      <div className="flex items-center gap-2">
        {!mesFechado && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Nova Despesa Fixa</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Adicionar Despesa Fixa</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input aria-label="Descrição da despesa fixa" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
                <MoneyInput value={form.valor} onChange={v => setForm(f => ({ ...f, valor: v }))} />
                <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <div>
                  <Label className="text-xs">Dia de vencimento (1–31)</Label>
                  <Input type="number" min={1} max={31} value={form.vencimento} onChange={e => setForm(f => ({ ...f, vencimento: e.target.value, dia_vencimento: e.target.value }))} placeholder="Ex: 10" />
                </div>
                <Select value={form.forma_pagamento} onValueChange={v => setForm(f => ({ ...f, forma_pagamento: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FORMAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
                <div className="border-t pt-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={form.recorrente} onCheckedChange={v => setForm(f => ({ ...f, recorrente: v }))} id="rec-fixa" />
                    <Label htmlFor="rec-fixa" className="flex items-center gap-1 text-sm"><RefreshCw className="h-3 w-3" /> Recorrente mensal</Label>
                  </div>
                  {form.recorrente && (
                    <div className="flex items-center gap-3">
                      <Switch checked={form.ajuste_variacao} onCheckedChange={v => setForm(f => ({ ...f, ajuste_variacao: v }))} id="ajuste" />
                      <Label htmlFor="ajuste" className="text-sm">Permite ajuste de valor (água, luz...)</Label>
                    </div>
                  )}
                </div>
                {ativosComProventos.length > 0 && (
                  <div className="border-t pt-3 space-y-3">
                    <div className="flex items-center gap-3">
                      <Switch checked={form.vincularInvestimento} onCheckedChange={v => setForm(f => ({ ...f, vincularInvestimento: v }))} id="vinc-inv" />
                      <Label htmlFor="vinc-inv" className="flex items-center gap-1 text-sm"><Link2 className="h-3 w-3" /> Vincular a investimento</Label>
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
                <AlertConfigSection enabled={alertEnabled} onEnabledChange={setAlertEnabled} offsets={alertOffsets} onOffsetsChange={setAlertOffsets} customMessage={alertMessage} onCustomMessageChange={setAlertMessage} />
                <Button onClick={handleSubmit} className="w-full">Salvar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
        <CategoryManager customs={customs} onAdd={addCat} onRemove={removeCat} tipoFilter="fixa" />
      </div>

      <div className="space-y-2">
        {fixas.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma despesa fixa neste mês.</p>}
        {fixas.map(d => {
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
                  <button onClick={(e) => cycleStatus(e, d)} className="flex-shrink-0" disabled={mesFechado}>
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
                  <p className="text-xs text-muted-foreground">{d.categoria} · Venc: dia {d.vencimento || d.dia_vencimento || "—"} · {getLabel(d.responsavel)}</p>
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
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-destructive" />
                          Excluir despesa fixa?
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-2">
                            <p>
                              {d.descricao || d.categoria} — {fmt(Number(d.valor))}
                            </p>
                            <p className="text-destructive">
                              Atenção: despesas fixas são recorrentes. Excluir aqui remove apenas este mês. Para desativar a recorrência inteira, edite a despesa e desative "Recorrente mensal".
                            </p>
                            <p>Esta ação não pode ser desfeita.</p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRowDelete(d)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Excluir
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <EditExpenseDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        despesa={editingDespesa}
        tipo="fixa"
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

export default TabFixas;
