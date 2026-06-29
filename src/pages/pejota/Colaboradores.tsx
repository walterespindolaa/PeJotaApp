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
import { UserCog, Plus, Pencil, Trash2, Building2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const db = supabase as any;
type Payout = { id: string; company_id: string; ref_month: string; nome: string; tipo: string; valor_base: number; comissao: number; piso: number; total: number; notes: string | null };
const TIPOS: Record<string, string> = { colaborador: "Colaborador", comissionado: "Comissionado", socio: "Sócio" };
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtMonth = (d: string) => format(parseISO(d), "MMM/yyyy", { locale: ptBR });
const toMoney = (s: string) => parseInt(s.replace(/\D/g, "") || "0", 10) / 100;
const money = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2 });

export default function Colaboradores() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [rows, setRows] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fMonth, setFMonth] = useState(format(new Date(), "yyyy-MM"));
  const [fNome, setFNome] = useState("");
  const [fTipo, setFTipo] = useState("colaborador");
  const [fBase, setFBase] = useState("");
  const [fComissao, setFComissao] = useState("");
  const [fPiso, setFPiso] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchRows = useCallback(async () => {
    if (!selected) { setRows([]); return; }
    setLoading(true);
    const { data, error } = await db.from("business_payouts").select("*").eq("company_id", selected.id).order("ref_month", { ascending: false });
    if (error) toast({ title: "Erro ao carregar folha", description: error.message, variant: "destructive" });
    setRows((data || []) as Payout[]); setLoading(false);
  }, [selected, toast]);
  useEffect(() => { fetchRows(); }, [fetchRows]);

  const openNew = () => { setEditId(null); setFMonth(format(new Date(), "yyyy-MM")); setFNome(""); setFTipo("colaborador"); setFBase(""); setFComissao(""); setFPiso(""); setOpen(true); };
  const openEdit = (p: Payout) => { setEditId(p.id); setFMonth(p.ref_month.slice(0, 7)); setFNome(p.nome); setFTipo(p.tipo); setFBase(money(Number(p.valor_base || 0))); setFComissao(money(Number(p.comissao || 0))); setFPiso(money(Number(p.piso || 0))); setOpen(true); };

  const save = async () => {
    if (!selected) return;
    if (!fNome.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    const valor_base = toMoney(fBase), comissao = toMoney(fComissao), piso = toMoney(fPiso);
    const total = Math.max(piso, valor_base + comissao);
    setSaving(true);
    const payload = { company_id: selected.id, ref_month: `${fMonth}-01`, nome: fNome.trim(), tipo: fTipo, valor_base, comissao, piso, total };
    let error;
    if (editId) ({ error } = await db.from("business_payouts").update(payload).eq("id", editId));
    else { const { data: { user } } = await supabase.auth.getUser(); ({ error } = await db.from("business_payouts").insert({ ...payload, user_id: user?.id })); }
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: editId ? "Atualizado" : "Adicionado" }); setOpen(false); fetchRows();
  };
  const remove = async (id: string) => { const { error } = await db.from("business_payouts").delete().eq("id", id); if (!error) fetchRows(); };

  const totalFolha = rows.reduce((s, p) => s + Number(p.total || 0), 0);
  const previewTotal = Math.max(toMoney(fPiso), toMoney(fBase) + toMoney(fComissao));

  if (!companiesLoading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para gerir a folha.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><UserCog className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Colaboradores e folha</h1>
          <p className="text-sm text-muted-foreground">Repasses por colaborador, com piso mínimo {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Adicionar</Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Total da folha</p><p className="text-2xl font-semibold text-primary mt-1">{brl(totalFolha)}</p></div>
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Pessoas</p><p className="text-2xl font-semibold mt-1">{rows.length}</p></div>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        : rows.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Nenhum colaborador lançado. Clique em “Adicionar”.</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium p-3">Mês</th><th className="text-left font-medium p-3">Nome</th><th className="text-left font-medium p-3">Tipo</th>
              <th className="text-right font-medium p-3">Base</th><th className="text-right font-medium p-3">Comissão</th><th className="text-right font-medium p-3">Total</th><th className="text-right font-medium p-3">Ações</th>
            </tr></thead>
            <tbody>{rows.map(p => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="p-3 capitalize">{fmtMonth(p.ref_month)}</td>
                <td className="p-3 font-medium">{p.nome}</td>
                <td className="p-3">{TIPOS[p.tipo] || p.tipo}</td>
                <td className="p-3 text-right">{brl(Number(p.valor_base || 0))}</td>
                <td className="p-3 text-right">{brl(Number(p.comissao || 0))}</td>
                <td className="p-3 text-right font-medium">{brl(Number(p.total || 0))}</td>
                <td className="p-3"><div className="flex items-center justify-end gap-1">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div></td>
              </tr>
            ))}</tbody>
          </table></div>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>{editId ? "Editar colaborador" : "Novo colaborador"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Nome</Label><Input value={fNome} onChange={e => setFNome(e.target.value)} placeholder="Nome do colaborador" /></div>
            <div><Label className="text-xs">Mês</Label><Input type="month" value={fMonth} onChange={e => setFMonth(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Tipo</Label>
            <Select value={fTipo} onValueChange={setFTipo}><SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIPOS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-xs">Base (R$)</Label><Input inputMode="numeric" placeholder="0,00" value={fBase} onChange={e => setFBase(toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} /></div>
            <div><Label className="text-xs">Comissão (R$)</Label><Input inputMode="numeric" placeholder="0,00" value={fComissao} onChange={e => setFComissao(toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} /></div>
            <div><Label className="text-xs">Piso mín. (R$)</Label><Input inputMode="numeric" placeholder="0,00" value={fPiso} onChange={e => setFPiso(toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Total a pagar: <strong>{brl(previewTotal)}</strong> (maior entre piso e base+comissão).</p>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
