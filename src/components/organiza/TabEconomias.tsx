import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, PiggyBank, TrendingUp, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { useToast } from "@/hooks/use-toast";
import type { Economia } from "@/hooks/useOrganiza";
import ReservaEconomias from "./ReservaEconomias";
import { usePrivacyFmt } from "@/components/PrivacyValue";

interface Props {
  economias: Economia[];
  totalEconomias: number;
  saldoDisponivel: number;
  mesAno: string;
  onAdd: (data: Partial<Economia>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  nomePessoa1: string;
  nomePessoa2: string;
  mediaDespesas: number;
  mediaEconomiasMensal: number;
}

// fmt provided by usePrivacyFmt hook

const TabEconomias = ({ economias, totalEconomias, saldoDisponivel, mesAno, onAdd, onDelete, nomePessoa1, nomePessoa2, mediaDespesas, mediaEconomiasMensal }: Props) => {
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ valor: "", destino_tipo: "investimento", descricao: "", data: `${mesAno}-15`, responsavel: "Pessoa 1" });

  const handleRowDelete = async (id: string) => {
    try {
      await onDelete(id);
      toast({ title: "Economia excluída" });
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    }
  };

  // Filter out reserva_emergencia — reserve lives in Patrimônio/Investimentos
  const economiasVisiveis = economias.filter(e => e.destino_tipo !== "reserva_emergencia");

  const handleSubmit = async () => {
    const valor = parseBRL(form.valor);
    if (!valor) return;
    await onAdd({ valor, destino_tipo: form.destino_tipo, descricao: form.descricao, data: form.data, responsavel: form.responsavel } as any);
    setForm({ valor: "", destino_tipo: "investimento", descricao: "", data: `${mesAno}-15`, responsavel: "Pessoa 1" });
    setOpen(false);
  };

  const totalVisivel = economiasVisiveis.reduce((s, e) => s + Number(e.valor), 0);
  const porInvestimento = economiasVisiveis.filter(e => e.destino_tipo === "investimento").reduce((s, e) => s + Number(e.valor), 0);
  const porMeta = economiasVisiveis.filter(e => e.destino_tipo === "meta").reduce((s, e) => s + Number(e.valor), 0);

  const chartData = economiasVisiveis
    .sort((a, b) => a.data.localeCompare(b.data))
    .reduce<{ label: string; total: number }[]>((acc, e) => {
      const last = acc[acc.length - 1];
      const cumulative = (last?.total || 0) + Number(e.valor);
      acc.push({ label: e.data.slice(5), total: cumulative });
      return acc;
    }, []);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><PiggyBank className="h-4 w-4 text-success" /><p className="text-xs text-muted-foreground">Total Economias</p></div>
            <p className="text-lg font-heading font-bold text-success">{fmt(totalVisivel)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-info" /><p className="text-xs text-muted-foreground">→ Investimentos</p></div>
            <p className="text-lg font-heading font-bold">{fmt(porInvestimento)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><PiggyBank className="h-4 w-4 text-accent" /><p className="text-xs text-muted-foreground">→ Metas</p></div>
            <p className="text-lg font-heading font-bold">{fmt(porMeta)}</p>
          </CardContent>
        </Card>
      </div>

      {chartData.length > 0 && (
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <p className="text-sm font-heading font-medium mb-3">Acumulação no Mês</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={10} />
                <YAxis fontSize={10} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Bar dataKey="total" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="gap-2 w-full"><Plus className="h-4 w-4" /> Registrar Economia</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar Economia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <MoneyInput placeholder="0,00" value={form.valor} onChange={v => setForm(f => ({ ...f, valor: v }))} />
            <Select value={form.destino_tipo} onValueChange={v => setForm(f => ({ ...f, destino_tipo: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="investimento">Investimento</SelectItem>
                <SelectItem value="meta">Meta / Objetivo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input aria-label="Descrição da economia (opcional)" placeholder="Descrição (opcional)" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
            <Input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            <Button onClick={handleSubmit} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🛡️ Reserva de Emergência — read-only view */}
      <ReservaEconomias mediaDespesas={mediaDespesas} mediaEconomiasMensal={mediaEconomiasMensal} />

      <div className="space-y-2">
        {economiasVisiveis.length === 0 && <p className="text-muted-foreground text-sm">Nenhuma economia registrada neste mês.</p>}
        {economiasVisiveis.map(e => (
          <Card key={e.id} className="shadow-soft">
            <CardContent className="p-3 flex items-center gap-3">
              {e.destino_tipo === "investimento" ? <TrendingUp className="h-4 w-4 text-info" /> : <PiggyBank className="h-4 w-4 text-accent" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{e.descricao || (e.destino_tipo === "investimento" ? "Investimento" : "Meta")}</p>
                <p className="text-xs text-muted-foreground">{e.data} · {getLabel(e.responsavel)}</p>
              </div>
              <p className="font-heading font-bold text-sm text-success">{fmt(Number(e.valor))}</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={(ev) => ev.stopPropagation()} className="text-destructive h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent onClick={(ev) => ev.stopPropagation()}>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      Excluir economia?
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2">
                        <p>{e.descricao || (e.destino_tipo === "investimento" ? "Investimento" : "Meta")} — {fmt(Number(e.valor))}</p>
                        <p>Se for recorrente, a exclusão afeta apenas o mês atual. Os meses anteriores permanecem registrados.</p>
                        <p className="text-destructive">Esta ação não pode ser desfeita.</p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleRowDelete(e.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TabEconomias;
