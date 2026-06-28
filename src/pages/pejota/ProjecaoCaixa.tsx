import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarRange, Plus, Pencil, Trash2, Building2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { format, parseISO } from "date-fns";

const db = supabase as any;
type Ev = { id: string; company_id: string; ref_month: string; event_date: string | null; description: string; amount: number; status: string };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? format(parseISO(d), "dd/MM/yyyy") : "—");
const toMoney = (s: string) => parseInt(s.replace(/\D/g, "") || "0", 10) / 100;

export default function ProjecaoCaixa() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [events, setEvents] = useState<Ev[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fDesc, setFDesc] = useState("");
  const [fDate, setFDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [fDir, setFDir] = useState<"in" | "out">("out");
  const [fAmount, setFAmount] = useState("");
  const [fStatus, setFStatus] = useState("previsto");
  const [saving, setSaving] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (!selected) { setEvents([]); return; }
    setLoading(true);
    const { data, error } = await db.from("business_planned_events").select("*").eq("company_id", selected.id).order("event_date", { ascending: true });
    if (error) toast({ title: "Erro ao carregar projeção", description: error.message, variant: "destructive" });
    setEvents((data || []) as Ev[]); setLoading(false);
  }, [selected, toast]);
  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const openNew = () => { setEditId(null); setFDesc(""); setFDate(format(new Date(), "yyyy-MM-dd")); setFDir("out"); setFAmount(""); setFStatus("previsto"); setOpen(true); };
  const openEdit = (e: Ev) => { setEditId(e.id); setFDesc(e.description); setFDate(e.event_date || format(new Date(), "yyyy-MM-dd")); setFDir(e.amount < 0 ? "out" : "in"); setFAmount(Math.abs(e.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })); setFStatus(e.status); setOpen(true); };

  const save = async () => {
    if (!selected) return;
    if (!fDesc.trim()) { toast({ title: "Descreva o evento", variant: "destructive" }); return; }
    const val = toMoney(fAmount); if (!val) { toast({ title: "Informe o valor", variant: "destructive" }); return; }
    const amount = fDir === "out" ? -Math.abs(val) : Math.abs(val);
    setSaving(true);
    const payload = { company_id: selected.id, ref_month: `${fDate.slice(0, 7)}-01`, event_date: fDate, description: fDesc.trim(), amount, status: fStatus };
    let error;
    if (editId) ({ error } = await db.from("business_planned_events").update(payload).eq("id", editId));
    else { const { data: { user } } = await supabase.auth.getUser(); ({ error } = await db.from("business_planned_events").insert({ ...payload, user_id: user?.id })); }
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Evento atualizado" : "Evento adicionado" }); setOpen(false); fetchEvents();
  };
  const remove = async (id: string) => { const { error } = await db.from("business_planned_events").delete().eq("id", id); if (!error) fetchEvents(); };

  const ativos = events.filter(e => e.status !== "descartado");
  const entradas = ativos.filter(e => e.amount > 0).reduce((s, e) => s + Number(e.amount), 0);
  const saidas = ativos.filter(e => e.amount < 0).reduce((s, e) => s + Number(e.amount), 0);

  if (!companiesLoading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para projetar o caixa.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><CalendarRange className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Projeção de caixa</h1>
          <p className="text-sm text-muted-foreground">Entradas e custos futuros previstos {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo evento</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Entradas previstas</p><p className="text-xl font-semibold text-emerald-600 mt-1">{brl(entradas)}</p></div>
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Saídas previstas</p><p className="text-xl font-semibold text-destructive mt-1">{brl(saidas)}</p></div>
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Saldo projetado</p><p className="text-xl font-semibold mt-1">{brl(entradas + saidas)}</p></div>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        : events.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Nenhum evento futuro. Clique em “Novo evento”.</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium p-3">Data</th><th className="text-left font-medium p-3">Evento</th>
              <th className="text-right font-medium p-3">Valor</th><th className="text-center font-medium p-3">Status</th><th className="text-right font-medium p-3">Ações</th>
            </tr></thead>
            <tbody>{events.map(e => (
              <tr key={e.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3">{fmtDate(e.event_date)}</td>
                <td className="p-3 font-medium flex items-center gap-2">{e.amount < 0 ? <ArrowDownCircle className="w-4 h-4 text-destructive" /> : <ArrowUpCircle className="w-4 h-4 text-emerald-600" />}{e.description}</td>
                <td className={`p-3 text-right font-medium ${e.amount < 0 ? "text-destructive" : "text-emerald-600"}`}>{brl(Number(e.amount))}</td>
                <td className="p-3 text-center"><Badge variant="secondary" className={e.status === "confirmado" ? "bg-emerald-500/15 text-emerald-600" : e.status === "descartado" ? "bg-muted text-muted-foreground" : "bg-blue-500/15 text-blue-600"}>{e.status}</Badge></td>
                <td className="p-3"><div className="flex items-center justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(e.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>{editId ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-xs">Descrição</Label><Input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Ex.: Feira comercial, compra de equipamento…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Data prevista</Label><Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} /></div>
            <div><Label className="text-xs">Tipo</Label>
              <Select value={fDir} onValueChange={(v) => setFDir(v as "in" | "out")}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="in">Entrada</SelectItem><SelectItem value="out">Saída</SelectItem></SelectContent></Select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Valor (R$)</Label><Input inputMode="numeric" placeholder="0,00" value={fAmount} onChange={e => setFAmount(toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} /></div>
            <div><Label className="text-xs">Status</Label>
              <Select value={fStatus} onValueChange={setFStatus}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="previsto">Previsto</SelectItem><SelectItem value="confirmado">Confirmado</SelectItem><SelectItem value="descartado">Descartado</SelectItem></SelectContent></Select></div>
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
