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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowUpCircle, ArrowDownCircle, Plus, Pencil, Trash2, Check, Building2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { statusVencimento } from "@/lib/pejota/businessFinance";

const db = supabase as any;
type Bill = { id: string; company_id: string; kind: "receber" | "pagar"; description: string; amount: number; due_date: string | null; status: string; paid_date: string | null; tx_id: string | null; notes: string | null };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string | null) => (d ? format(parseISO(d), "dd/MM/yyyy") : "—");
const toMoney = (s: string) => parseInt(s.replace(/\D/g, "") || "0", 10) / 100;
const today = () => format(new Date(), "yyyy-MM-dd");

const VENC_BADGE: Record<string, { label: string; cls: string }> = {
  liquidado: { label: "Liquidado", cls: "bg-emerald-500/15 text-emerald-600" },
  atrasado: { label: "Atrasado", cls: "bg-destructive/15 text-destructive" },
  vence_hoje: { label: "Vence hoje", cls: "bg-amber-500/15 text-amber-600" },
  a_vencer: { label: "A vencer", cls: "bg-blue-500/15 text-blue-600" },
  sem_data: { label: "Sem data", cls: "bg-muted text-muted-foreground" },
};

export default function BillsPage({ kind }: { kind: "receber" | "pagar" }) {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fDesc, setFDesc] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDue, setFDue] = useState(today());
  const [saving, setSaving] = useState(false);

  const titulo = kind === "receber" ? "Contas a receber" : "Contas a pagar";
  const Icon = kind === "receber" ? ArrowUpCircle : ArrowDownCircle;
  const accent = kind === "receber" ? "text-emerald-600" : "text-destructive";

  const fetchBills = useCallback(async () => {
    if (!selected) { setBills([]); return; }
    setLoading(true);
    const { data, error } = await db.from("business_bills").select("*").eq("company_id", selected.id).eq("kind", kind).order("due_date", { ascending: true });
    if (error) toast({ title: "Erro ao carregar", description: error.message, variant: "destructive" });
    setBills((data || []) as Bill[]); setLoading(false);
  }, [selected, kind, toast]);
  useEffect(() => { fetchBills(); }, [fetchBills]);

  const openNew = () => { setEditId(null); setFDesc(""); setFAmount(""); setFDue(today()); setOpen(true); };
  const openEdit = (b: Bill) => { setEditId(b.id); setFDesc(b.description); setFAmount(Number(b.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })); setFDue(b.due_date || today()); setOpen(true); };

  const save = async () => {
    if (!selected) return;
    if (!fDesc.trim()) { toast({ title: "Descreva a conta", variant: "destructive" }); return; }
    const amount = toMoney(fAmount); if (!amount) { toast({ title: "Informe o valor", variant: "destructive" }); return; }
    setSaving(true);
    const payload = { company_id: selected.id, kind, description: fDesc.trim(), amount, due_date: fDue || null, updated_at: new Date().toISOString() };
    let error;
    if (editId) ({ error } = await db.from("business_bills").update(payload).eq("id", editId));
    else { const { data: { user } } = await supabase.auth.getUser(); ({ error } = await db.from("business_bills").insert({ ...payload, user_id: user?.id, status: "pendente" })); }
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Conta atualizada" : "Conta adicionada" }); setOpen(false); fetchBills();
  };

  // Liquidar: marca como liquidado e gera o lançamento no caixa (entra se receber, sai se pagar).
  const liquidar = async (b: Bill) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: tx, error: txErr } = await db.from("business_transactions").insert({
      company_id: b.company_id, user_id: user?.id, date: today(),
      description: `${kind === "receber" ? "Recebimento" : "Pagamento"}: ${b.description}`,
      amount: b.amount, direction: kind === "receber" ? "in" : "out", source: "bill",
    }).select("id").single();
    if (txErr) { toast({ title: "Erro ao lançar no caixa", description: txErr.message, variant: "destructive" }); return; }
    const { error } = await db.from("business_bills").update({ status: "liquidado", paid_date: today(), tx_id: tx?.id }).eq("id", b.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    toast({ title: kind === "receber" ? "Recebido" : "Pago", description: "Lançado no caixa." });
    fetchBills();
  };
  const reabrir = async (b: Bill) => {
    if (b.tx_id) await db.from("business_transactions").delete().eq("id", b.tx_id);
    const { error } = await db.from("business_bills").update({ status: "pendente", paid_date: null, tx_id: null }).eq("id", b.id);
    if (!error) fetchBills();
  };
  const remove = async (b: Bill) => {
    if (b.tx_id) await db.from("business_transactions").delete().eq("id", b.tx_id);
    const { error } = await db.from("business_bills").delete().eq("id", b.id);
    if (!error) fetchBills();
  };

  const pendentes = bills.filter(b => b.status === "pendente");
  const totalPend = pendentes.reduce((s, b) => s + Number(b.amount || 0), 0);
  const totalLiq = bills.filter(b => b.status === "liquidado").reduce((s, b) => s + Number(b.amount || 0), 0);
  const atrasado = pendentes.filter(b => statusVencimento(b.due_date, b.status, today()) === "atrasado").reduce((s, b) => s + Number(b.amount || 0), 0);

  if (!companiesLoading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para usar {titulo.toLowerCase()}.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Icon className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">{titulo}</h1>
          <p className="text-sm text-muted-foreground">{kind === "receber" ? "O que entra: cobranças e recebimentos" : "O que sai: contas e fornecedores"} {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Nova conta</Button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">{kind === "receber" ? "A receber" : "A pagar"}</p><p className={`text-2xl font-semibold mt-1 ${accent}`}>{brl(totalPend)}</p></div>
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Atrasado</p><p className="text-2xl font-semibold mt-1 text-destructive">{brl(atrasado)}</p></div>
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Liquidado</p><p className="text-2xl font-semibold mt-1">{brl(totalLiq)}</p></div>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        : bills.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma conta. Clique em “Nova conta”.</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium p-3">Descrição</th><th className="text-left font-medium p-3">Vencimento</th>
              <th className="text-right font-medium p-3">Valor</th><th className="text-center font-medium p-3">Status</th><th className="text-right font-medium p-3">Ações</th>
            </tr></thead>
            <tbody>{bills.map(b => {
              const st = statusVencimento(b.due_date, b.status, today());
              const badge = VENC_BADGE[st];
              return (
                <tr key={b.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{b.description}</td>
                  <td className="p-3">{fmtDate(b.due_date)}</td>
                  <td className={`p-3 text-right font-medium ${accent}`}>{brl(Number(b.amount || 0))}</td>
                  <td className="p-3 text-center"><Badge variant="secondary" className={badge.cls}>{badge.label}</Badge></td>
                  <td className="p-3"><div className="flex items-center justify-end gap-1">
                    {b.status === "pendente"
                      ? <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => liquidar(b)}><Check className="w-3.5 h-3.5" /> {kind === "receber" ? "Receber" : "Pagar"}</Button>
                      : <Button size="sm" variant="ghost" className="h-8" onClick={() => reabrir(b)}>Reabrir</Button>}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(b)}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(b)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>{editId ? "Editar conta" : `Nova conta a ${kind}`}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-xs">Descrição</Label><Input value={fDesc} onChange={e => setFDesc(e.target.value)} placeholder={kind === "receber" ? "Ex.: Cliente Alpha — serviço" : "Ex.: Fornecedor Beta — insumos"} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Valor (R$)</Label><Input inputMode="numeric" placeholder="0,00" value={fAmount} onChange={e => setFAmount(toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} /></div>
            <div><Label className="text-xs">Vencimento</Label><Input type="date" value={fDue} onChange={e => setFDue(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
