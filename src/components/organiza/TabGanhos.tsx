import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import type { Receita } from "@/hooks/useOrganiza";
import EditReceitaDrawer from "./EditReceitaDrawer";
import { usePrivacyFmt } from "@/components/PrivacyValue";

import { CATEGORIAS_RECEITAS } from "@/lib/categories";
const CATEGORIAS = CATEGORIAS_RECEITAS;

interface Props {
  receitas: Receita[];
  totalGanhos: number;
  ganhosRecebidos: number;
  mesAno: string;
  mesFechado: boolean;
  onAdd: (data: Partial<Receita>) => Promise<void>;
  onUpdate: (id: string, data: Partial<Receita>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onAddEconomia: (data: any) => Promise<void>;
  nomePessoa1: string;
  nomePessoa2: string;
}

// fmt provided by usePrivacyFmt hook

const TabGanhos = ({ receitas, totalGanhos, ganhosRecebidos, mesAno, mesFechado, onAdd, onUpdate, onDelete, onAddEconomia, nomePessoa1, nomePessoa2 }: Props) => {
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const [open, setOpen] = useState(false);
  const [editingReceita, setEditingReceita] = useState<Receita | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  // econSuggestion state removed — economia is now auto-created
  const [form, setForm] = useState({
    descricao: "", valor: "", categoria: "Salário", tipo: "fixo",
    corresponde: "", data: `${mesAno}-01`,
    recorrente: false, dia_recebimento: "", porcentagem_economia: "",
    responsavel: "Pessoa 1",
    temPrazo: false, prazoMes: String(new Date().getMonth() + 1).padStart(2, "0"), prazoAno: String(new Date().getFullYear()),
  });

  const handleSubmit = async () => {
    const valor = parseBRL(form.valor);
    if (!valor) return;
    await onAdd({
      descricao: form.descricao, valor, categoria: form.categoria,
      tipo: form.tipo, status: "pendente", corresponde: form.corresponde, data: form.data,
      recorrente: form.recorrente,
      dia_recebimento: form.dia_recebimento ? Number(form.dia_recebimento) : null,
      porcentagem_economia: form.porcentagem_economia ? Number(form.porcentagem_economia) : null,
      responsavel: form.responsavel,
      recorrente_ate: form.recorrente && form.temPrazo && form.prazoMes && form.prazoAno ? `${form.prazoAno}-${form.prazoMes}` : null,
    } as any);
    setForm({ descricao: "", valor: "", categoria: "Salário", tipo: "fixo", corresponde: "", data: `${mesAno}-01`, recorrente: false, dia_recebimento: "", porcentagem_economia: "", responsavel: "Pessoa 1", temPrazo: false, prazoMes: String(new Date().getMonth() + 1).padStart(2, "0"), prazoAno: String(new Date().getFullYear()) });
    setOpen(false);
  };

  const cycleStatus = async (r: Receita) => {
    if (mesFechado) return;
    const order = ["pendente", "recebido", "em_atraso"];
    const next = order[(order.indexOf(r.status) + 1) % order.length];
    await onUpdate(r.id, { status: next });
    // Auto-create economia when marking as received with % economia
    if (next === "recebido" && r.porcentagem_economia && Number(r.porcentagem_economia) > 0) {
      const valorEcon = Math.round(Number(r.valor) * (Number(r.porcentagem_economia) / 100) * 100) / 100;
      await onAddEconomia({
        valor: valorEcon,
        destino_tipo: "investimento",
        descricao: `Economia automática (${r.porcentagem_economia}% de ${r.descricao || r.categoria})`,
        data: r.data,
        responsavel: r.responsavel,
      });
      toast({ title: "Economia registrada!", description: `${fmt(valorEcon)} separado automaticamente (${r.porcentagem_economia}%).` });
    }
  };

  const statusColor: Record<string, string> = {
    recebido: "bg-success text-success-foreground",
    pendente: "bg-muted text-muted-foreground",
    em_atraso: "bg-destructive text-destructive-foreground",
  };
  const statusLabelMap: Record<string, string> = { recebido: "✓ Recebido", pendente: "Pendente", em_atraso: "Atrasado" };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total Previsto</p><p className="text-lg font-heading font-bold">{fmt(totalGanhos)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Recebido</p><p className="text-lg font-heading font-bold text-success">{fmt(ganhosRecebidos)}</p></CardContent></Card>
        <Card className="shadow-soft"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pendente</p><p className="text-lg font-heading font-bold text-warning">{fmt(totalGanhos - ganhosRecebidos)}</p></CardContent></Card>
      </div>


      {!mesFechado && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Novo Ganho</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Adicionar Ganho</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input aria-label="Descrição do ganho" placeholder="Descrição" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
              <MoneyInput value={form.valor} onChange={v => setForm(f => ({ ...f, valor: v }))} />
              <Select value={form.categoria} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixo">Fixo</SelectItem>
                  <SelectItem value="variavel">Variável</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
              <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <Switch checked={form.recorrente} onCheckedChange={v => setForm(f => ({ ...f, recorrente: v }))} id="recorrente" />
                  <Label htmlFor="recorrente" className="flex items-center gap-1 text-sm"><RefreshCw className="h-3 w-3" /> Recorrente mensal</Label>
                </div>
                {form.recorrente && (
                  <>
                    <Input aria-label="Dia do recebimento (1-31)" placeholder="Dia do recebimento (1-31)" type="number" value={form.dia_recebimento} onChange={e => setForm(f => ({ ...f, dia_recebimento: e.target.value }))} />
                    <div className="flex items-center gap-3">
                      <Switch checked={form.temPrazo} onCheckedChange={v => setForm(f => ({ ...f, temPrazo: v }))} id="tem-prazo-ganho" />
                      <Label htmlFor="tem-prazo-ganho" className="text-sm">Tem prazo? (recebo até um mês específico)</Label>
                    </div>
                    {form.temPrazo && (
                      <div className="flex gap-2">
                        <Select value={form.prazoMes} onValueChange={v => setForm(f => ({ ...f, prazoMes: v }))}>
                          <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                          <SelectContent>
                            {[["01","Janeiro"],["02","Fevereiro"],["03","Março"],["04","Abril"],["05","Maio"],["06","Junho"],["07","Julho"],["08","Agosto"],["09","Setembro"],["10","Outubro"],["11","Novembro"],["12","Dezembro"]].map(([v,l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Select value={form.prazoAno} onValueChange={v => setForm(f => ({ ...f, prazoAno: v }))}>
                          <SelectTrigger><SelectValue placeholder="Ano" /></SelectTrigger>
                          <SelectContent>
                            {Array.from({ length: 11 }, (_, i) => String(new Date().getFullYear() + i)).map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </>
                )}
                <Input aria-label="Percentual de economia automática" placeholder="% economia automática (ex: 20)" type="number" value={form.porcentagem_economia} onChange={e => setForm(f => ({ ...f, porcentagem_economia: e.target.value }))} />
              </div>
              <Button onClick={handleSubmit} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-2">
        {receitas.length === 0 && <p className="text-muted-foreground text-sm">Nenhum ganho registrado neste mês.</p>}
        {receitas.map(r => (
          <Card key={r.id} className="shadow-soft cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => { setEditingReceita(r); setEditOpen(true); }}>
            <CardContent className="p-3 flex items-center gap-3">
              <button onClick={(e) => { e.stopPropagation(); cycleStatus(r); }} className="flex-shrink-0" disabled={mesFechado}>
                <Badge className={`cursor-pointer ${statusColor[r.status] || statusColor.pendente}`}>
                  {statusLabelMap[r.status] || r.status}
                </Badge>
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-sm font-medium truncate">{r.descricao || r.categoria}</p>
                  {r.recorrente && <RefreshCw className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                  {r.porcentagem_economia && Number(r.porcentagem_economia) > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">{r.porcentagem_economia}% econ.</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{r.categoria} · {getLabel(r.responsavel)}</p>
              </div>
              <p className="font-heading font-bold text-sm">{fmt(Number(r.valor))}</p>
              {!mesFechado && (
                <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} className="text-destructive h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <EditReceitaDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        receita={editingReceita}
        responsavelOptions={responsavelOptions}
        onUpdate={onUpdate}
        onDelete={onDelete}
        mesFechado={mesFechado}
      />
    </div>
  );
};

export default TabGanhos;
