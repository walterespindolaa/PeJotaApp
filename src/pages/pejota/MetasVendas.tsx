import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Target, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const db = supabase as any;
type Goal = { id: string; company_id: string; ref_month: string; metric: string; target: number };
const METRICS: Record<string, string> = { receita: "Receita", resultado: "Resultado", vendas: "Vendas (qtd)" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMonth = (d: string) => format(parseISO(d), "MMM/yyyy", { locale: ptBR });
const toMoney = (s: string) => parseInt(s.replace(/\D/g, "") || "0", 10) / 100;

export default function MetasVendas() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fMonth, setFMonth] = useState(format(new Date(), "yyyy-MM"));
  const [fMetric, setFMetric] = useState("receita");
  const [fTarget, setFTarget] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchGoals = useCallback(async () => {
    if (!selected) { setGoals([]); return; }
    setLoading(true);
    const { data, error } = await db.from("business_goals").select("*").eq("company_id", selected.id).order("ref_month", { ascending: false });
    if (error) toast({ title: "Erro ao carregar metas", description: error.message, variant: "destructive" });
    setGoals((data || []) as Goal[]); setLoading(false);
  }, [selected, toast]);
  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const openNew = () => { setEditId(null); setFMonth(format(new Date(), "yyyy-MM")); setFMetric("receita"); setFTarget(""); setOpen(true); };
  const openEdit = (g: Goal) => { setEditId(g.id); setFMonth(g.ref_month.slice(0, 7)); setFMetric(g.metric); setFTarget(g.target.toLocaleString("pt-BR", { minimumFractionDigits: 2 })); setOpen(true); };

  const save = async () => {
    if (!selected) return;
    const target = fMetric === "vendas" ? Number(fTarget.replace(/\D/g, "")) : toMoney(fTarget);
    if (!target) { toast({ title: "Informe a meta", variant: "destructive" }); return; }
    setSaving(true);
    const payload = { company_id: selected.id, ref_month: `${fMonth}-01`, metric: fMetric, target };
    let error;
    if (editId) ({ error } = await db.from("business_goals").update(payload).eq("id", editId));
    else { const { data: { user } } = await supabase.auth.getUser(); ({ error } = await db.from("business_goals").upsert({ ...payload, user_id: user?.id }, { onConflict: "company_id,ref_month,metric" })); }
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Meta atualizada" : "Meta definida" }); setOpen(false); fetchGoals();
  };
  const remove = async (id: string) => { const { error } = await db.from("business_goals").delete().eq("id", id); if (!error) fetchGoals(); };

  if (!companiesLoading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para definir metas.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Target className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Metas de vendas</h1>
          <p className="text-sm text-muted-foreground">Metas mensais de receita, resultado e vendas {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova meta</Button>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        : goals.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma meta definida. Clique em “Nova meta”.</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium p-3">Mês</th><th className="text-left font-medium p-3">Métrica</th>
              <th className="text-right font-medium p-3">Meta</th><th className="text-right font-medium p-3">Ações</th>
            </tr></thead>
            <tbody>{goals.map(g => (
              <tr key={g.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 capitalize">{fmtMonth(g.ref_month)}</td>
                <td className="p-3">{METRICS[g.metric] || g.metric}</td>
                <td className="p-3 text-right font-medium">{g.metric === "vendas" ? `${g.target} un` : brl(Number(g.target || 0))}</td>
                <td className="p-3"><div className="flex items-center justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(g)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(g.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>{editId ? "Editar meta" : "Nova meta"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Mês</Label><Input type="month" value={fMonth} onChange={e => setFMonth(e.target.value)} /></div>
            <div><Label className="text-xs">Métrica</Label>
              <Select value={fMetric} onValueChange={setFMetric}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(METRICS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select>
            </div>
          </div>
          <div><Label className="text-xs">{fMetric === "vendas" ? "Meta (quantidade)" : "Meta (R$)"}</Label>
            <Input inputMode="numeric" placeholder={fMetric === "vendas" ? "0" : "0,00"} value={fTarget}
              onChange={e => setFTarget(fMetric === "vendas" ? e.target.value.replace(/\D/g, "") : toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
