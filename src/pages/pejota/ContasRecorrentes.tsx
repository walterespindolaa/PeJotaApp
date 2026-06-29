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
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Repeat, Plus, Pencil, Trash2, Building2, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";
import { ensureRecurringBills } from "@/lib/pejota/recurringBills";

const db = supabase as any;
type Rec = { id: string; company_id: string; kind: "receber" | "pagar"; description: string; amount: number; day_of_month: number; payer_name: string | null; active: boolean };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toMoney = (s: string) => parseInt(s.replace(/\D/g, "") || "0", 10) / 100;

export default function ContasRecorrentes() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fKind, setFKind] = useState<"receber" | "pagar">("pagar");
  const [fDesc, setFDesc] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDay, setFDay] = useState("5");
  const [fPayer, setFPayer] = useState("");
  const [saving, setSaving] = useState(false);
  const [gerando, setGerando] = useState(false);

  const load = useCallback(async () => {
    if (!selected) { setRecs([]); return; }
    setLoading(true);
    const { data } = await db.from("business_recurring_bills").select("*").eq("company_id", selected.id).order("kind").order("day_of_month");
    setRecs((data || []) as Rec[]); setLoading(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const openNew = () => { setEditId(null); setFKind("pagar"); setFDesc(""); setFAmount(""); setFDay("5"); setFPayer(""); setOpen(true); };
  const openEdit = (r: Rec) => { setEditId(r.id); setFKind(r.kind); setFDesc(r.description); setFAmount(Number(r.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })); setFDay(String(r.day_of_month)); setFPayer(r.payer_name || ""); setOpen(true); };

  const save = async () => {
    if (!selected) return;
    if (!fDesc.trim()) { toast({ title: "Descreva a conta", variant: "destructive" }); return; }
    const amount = toMoney(fAmount); if (!amount) { toast({ title: "Informe o valor", variant: "destructive" }); return; }
    const day = Math.min(28, Math.max(1, parseInt(fDay) || 5));
    setSaving(true);
    const payload = { company_id: selected.id, kind: fKind, description: fDesc.trim(), amount, day_of_month: day, payer_name: fPayer.trim() || null };
    let error;
    if (editId) ({ error } = await db.from("business_recurring_bills").update(payload).eq("id", editId));
    else { const { data: { user } } = await supabase.auth.getUser(); ({ error } = await db.from("business_recurring_bills").insert({ ...payload, user_id: user?.id, active: true })); }
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Recorrência atualizada" : "Recorrência criada" }); setOpen(false); load();
  };

  const toggleActive = async (r: Rec) => { setRecs(rs => rs.map(x => x.id === r.id ? { ...x, active: !x.active } : x)); await db.from("business_recurring_bills").update({ active: !r.active }).eq("id", r.id); };
  const remove = async (r: Rec) => { const { error } = await db.from("business_recurring_bills").delete().eq("id", r.id); if (!error) load(); };

  const gerarAgora = async () => {
    if (!selected) return;
    setGerando(true);
    const a = await ensureRecurringBills(selected.id, "receber");
    const b = await ensureRecurringBills(selected.id, "pagar");
    setGerando(false);
    toast({ title: "Geração concluída", description: `${a + b} conta(s) criada(s) para este mês.` });
  };

  if (!companiesLoading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para configurar recorrências.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Repeat className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Contas recorrentes</h1>
          <p className="text-sm text-muted-foreground">Aluguel, salários, assinaturas — geradas automaticamente todo mês {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={gerarAgora} disabled={gerando} className="gap-2"><RefreshCw className={`w-4 h-4 ${gerando ? "animate-spin" : ""}`} /> Gerar deste mês</Button>
          <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova recorrência</Button>
        </div>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        : recs.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma recorrência. Clique em “Nova recorrência”.</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium p-3">Descrição</th><th className="text-center font-medium p-3">Tipo</th>
              <th className="text-center font-medium p-3">Dia</th><th className="text-right font-medium p-3">Valor</th>
              <th className="text-center font-medium p-3">Ativa</th><th className="text-right font-medium p-3">Ações</th>
            </tr></thead>
            <tbody>{recs.map(r => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 font-medium">{r.description}{r.payer_name && <span className="block text-[11px] text-muted-foreground">{r.payer_name}</span>}</td>
                <td className="p-3 text-center"><Badge variant="secondary" className={r.kind === "receber" ? "bg-emerald-500/15 text-emerald-600 gap-1" : "bg-muted text-muted-foreground gap-1"}>{r.kind === "receber" ? <ArrowUpCircle className="w-3 h-3" /> : <ArrowDownCircle className="w-3 h-3" />}{r.kind}</Badge></td>
                <td className="p-3 text-center">dia {r.day_of_month}</td>
                <td className={`p-3 text-right font-medium ${r.kind === "receber" ? "text-emerald-600" : "text-destructive"}`}>{brl(Number(r.amount || 0))}</td>
                <td className="p-3 text-center"><Switch checked={r.active} onCheckedChange={() => toggleActive(r)} /></td>
                <td className="p-3"><div className="flex items-center justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(r)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </CardContent></Card>

      <p className="text-xs text-muted-foreground">As contas do mês são criadas automaticamente quando você abre Contas a pagar/receber (uma vez por mês, sem duplicar). Desligar uma recorrência para de gerar a partir do próximo mês.</p>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>{editId ? "Editar recorrência" : "Nova recorrência"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-xs">Tipo</Label>
            <Select value={fKind} onValueChange={(v) => setFKind(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="pagar">A pagar (despesa)</SelectItem><SelectItem value="receber">A receber (receita)</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Descrição</Label><Input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder="Ex.: Aluguel, Salário Ana, Assinatura X" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Valor (R$)</Label><Input inputMode="numeric" placeholder="0,00" value={fAmount} onChange={e => setFAmount(toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} /></div>
            <div><Label className="text-xs">Dia do vencimento</Label><Input type="number" min={1} max={28} value={fDay} onChange={e => setFDay(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Pagador / cliente (opcional)</Label><Input value={fPayer} onChange={e => setFPayer(e.target.value)} placeholder="Para contas a receber" /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
