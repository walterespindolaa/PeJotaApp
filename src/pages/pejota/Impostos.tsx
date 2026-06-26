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
import { Receipt, Plus, Pencil, Trash2, Check, Building2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const db = supabase as any;

type Tax = {
  id: string;
  company_id: string;
  tipo: string;
  competencia: string;     // YYYY-MM-DD (1º dia do mês)
  due_date: string | null; // YYYY-MM-DD
  amount: number;
  status: "pendente" | "pago";
  paid_date: string | null;
  notes: string | null;
};

const TIPOS = ["DAS", "ISSQN", "IRPJ", "CSLL", "PIS", "COFINS", "ICMS", "INSS", "Outro"];

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMonth = (d: string) => format(parseISO(d), "MMM/yyyy", { locale: ptBR });
const fmtDate = (d: string | null) => (d ? format(parseISO(d), "dd/MM/yyyy") : "—");
const toMoney = (s: string) => {
  const digits = s.replace(/\D/g, "");
  return parseInt(digits || "0", 10) / 100;
};

export default function Impostos() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(false);

  // form
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fTipo, setFTipo] = useState("DAS");
  const [fComp, setFComp] = useState(format(new Date(), "yyyy-MM"));
  const [fDue, setFDue] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchTaxes = useCallback(async () => {
    if (!selected) { setTaxes([]); return; }
    setLoading(true);
    const { data, error } = await db
      .from("business_taxes")
      .select("*")
      .eq("company_id", selected.id)
      .order("competencia", { ascending: false });
    if (error) toast({ title: "Erro ao carregar impostos", description: error.message, variant: "destructive" });
    setTaxes((data || []) as Tax[]);
    setLoading(false);
  }, [selected, toast]);

  useEffect(() => { fetchTaxes(); }, [fetchTaxes]);

  const resetForm = () => {
    setEditId(null); setFTipo("DAS"); setFComp(format(new Date(), "yyyy-MM"));
    setFDue(""); setFAmount(""); setFNotes("");
  };

  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (t: Tax) => {
    setEditId(t.id); setFTipo(t.tipo); setFComp(t.competencia.slice(0, 7));
    setFDue(t.due_date || ""); setFAmount(t.amount ? String(t.amount.toFixed(2)).replace(".", ",") : "");
    setFNotes(t.notes || ""); setOpen(true);
  };

  const save = async () => {
    if (!selected) return;
    const amount = toMoney(fAmount);
    if (!amount) { toast({ title: "Informe o valor", variant: "destructive" }); return; }
    setSaving(true);
    const payload = {
      company_id: selected.id,
      tipo: fTipo,
      competencia: `${fComp}-01`,
      due_date: fDue || null,
      amount,
      notes: fNotes || null,
    };
    let error;
    if (editId) {
      ({ error } = await db.from("business_taxes").update(payload).eq("id", editId));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      ({ error } = await db.from("business_taxes").insert({ ...payload, user_id: user?.id, status: "pendente" }));
    }
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Imposto atualizado" : "Imposto adicionado" });
    setOpen(false); resetForm(); fetchTaxes();
  };

  const togglePaid = async (t: Tax) => {
    const paying = t.status !== "pago";
    const { error } = await db.from("business_taxes").update({
      status: paying ? "pago" : "pendente",
      paid_date: paying ? format(new Date(), "yyyy-MM-dd") : null,
    }).eq("id", t.id);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
    fetchTaxes();
  };

  const remove = async (id: string) => {
    const { error } = await db.from("business_taxes").delete().eq("id", id);
    if (error) { toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" }); return; }
    fetchTaxes();
  };

  const totalPendente = taxes.filter(t => t.status !== "pago").reduce((s, t) => s + Number(t.amount || 0), 0);
  const totalPago = taxes.filter(t => t.status === "pago").reduce((s, t) => s + Number(t.amount || 0), 0);

  if (!companiesLoading && !selected) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Card><CardContent className="py-12 text-center">
          <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para controlar os impostos.</p>
          <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-heading font-semibold">Impostos</h1>
            <p className="text-sm text-muted-foreground">Controle de impostos a pagar e pagos {selected ? `· ${selected.name}` : ""}.</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo imposto</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">A pagar</p>
          <p className="text-2xl font-semibold text-primary mt-1">{brl(totalPendente)}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Pago</p>
          <p className="text-2xl font-semibold mt-1">{brl(totalPago)}</p>
        </div>
        <div className="bg-muted/50 rounded-xl p-4">
          <p className="text-xs text-muted-foreground">Lançamentos</p>
          <p className="text-2xl font-semibold mt-1">{taxes.length}</p>
        </div>
      </div>

      {/* List */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : taxes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Nenhum imposto lançado ainda. Clique em “Novo imposto”.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b">
                    <th className="text-left font-medium p-3">Imposto</th>
                    <th className="text-left font-medium p-3">Competência</th>
                    <th className="text-left font-medium p-3">Vencimento</th>
                    <th className="text-right font-medium p-3">Valor</th>
                    <th className="text-center font-medium p-3">Status</th>
                    <th className="text-right font-medium p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {taxes.map(t => (
                    <tr key={t.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="p-3 font-medium">{t.tipo}</td>
                      <td className="p-3 capitalize">{fmtMonth(t.competencia)}</td>
                      <td className="p-3">{fmtDate(t.due_date)}</td>
                      <td className="p-3 text-right">{brl(Number(t.amount || 0))}</td>
                      <td className="p-3 text-center">
                        <Badge variant="secondary" className={t.status === "pago" ? "bg-emerald-500/15 text-emerald-600" : "bg-amber-500/15 text-amber-600"}>
                          {t.status === "pago" ? "Pago" : "Pendente"}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8 gap-1.5" onClick={() => togglePaid(t)}>
                            <Check className="w-3.5 h-3.5" /> {t.status === "pago" ? "Reabrir" : "Pagar"}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(t)}><Pencil className="w-3.5 h-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editId ? "Editar imposto" : "Novo imposto"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Imposto</Label>
                <Select value={fTipo} onValueChange={setFTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Competência</Label>
                <Input type="month" value={fComp} onChange={e => setFComp(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={fDue} onChange={e => setFDue(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input inputMode="numeric" placeholder="0,00" value={fAmount}
                  onChange={e => setFAmount(toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Observação (opcional)</Label>
              <Input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Ex.: parcelamento, código de barras…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
