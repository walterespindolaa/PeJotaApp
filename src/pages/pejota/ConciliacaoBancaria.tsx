import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Landmark, Building2, Upload, ArrowUpCircle, ArrowDownCircle, Check, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { parseOFX, type OFXTransaction } from "@/lib/ofxParser";

const db = supabase as any;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const fmtDate = (d: string) => { try { return format(parseISO(d), "dd/MM/yyyy"); } catch { return d; } };

type Row = OFXTransaction & { hash: string; existe: boolean; sel: boolean };

export default function ConciliacaoBancaria() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [conta, setConta] = useState<{ bankId?: string; accountId?: string } | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File) => {
    if (!selected) return;
    setParsing(true); setRows([]); setConta(null);
    try {
      const text = await file.text();
      const res = parseOFX(text);
      if (res.errors.length && res.transactions.length === 0) {
        toast({ title: "Não foi possível ler o OFX", description: res.errors[0], variant: "destructive" });
        setParsing(false); return;
      }
      const acct = res.accountId || "na";
      const mk = (t: OFXTransaction) => `ofx:${acct}:${t.fitId}`;
      const hashes = res.transactions.map(mk);
      // Verifica quais já existem (dedup por external_hash)
      const { data: existing } = await db.from("business_transactions").select("external_hash").eq("company_id", selected.id).in("external_hash", hashes);
      const existSet = new Set((existing || []).map((e: any) => e.external_hash));
      const mapped: Row[] = res.transactions.map(t => {
        const hash = mk(t);
        const existe = existSet.has(hash);
        return { ...t, hash, existe, sel: !existe };
      });
      setRows(mapped);
      setConta({ bankId: res.bankId, accountId: res.accountId });
      toast({ title: "Extrato lido", description: `${mapped.length} transações · ${mapped.filter(r => !r.existe).length} novas.` });
    } catch (e: any) {
      toast({ title: "Erro ao ler arquivo", description: String(e.message || e), variant: "destructive" });
    }
    setParsing(false);
  };

  const toggle = (i: number) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, sel: !r.sel } : r));
  const toggleAll = (v: boolean) => setRows(rs => rs.map(r => r.existe ? r : { ...r, sel: v }));

  const importar = async () => {
    if (!selected) return;
    const aImportar = rows.filter(r => r.sel && !r.existe);
    if (aImportar.length === 0) { toast({ title: "Nada selecionado" }); return; }
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = aImportar.map(r => ({
      company_id: selected.id, user_id: user?.id, date: r.date, amount: r.amount,
      direction: r.type === "income" ? "in" : "out", description: r.description,
      source: "ofx", external_hash: r.hash,
    }));
    const { error } = await db.from("business_transactions").insert(payload);
    setImporting(false);
    if (error) { toast({ title: "Erro ao importar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Importado", description: `${aImportar.length} lançamento(s) no caixa.` });
    setRows(rs => rs.map(r => r.sel && !r.existe ? { ...r, existe: true, sel: false } : r));
  };

  const novas = rows.filter(r => !r.existe);
  const selecionadas = rows.filter(r => r.sel && !r.existe);
  const totalIn = selecionadas.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalOut = selecionadas.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);

  if (!companiesLoading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para conciliar o extrato.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Landmark className="w-5 h-5" /></div>
        <div><h1 className="text-xl font-heading font-semibold">Conciliação bancária</h1>
        <p className="text-sm text-muted-foreground">Importe o extrato (.OFX) do banco e traga para o caixa só o que ainda não está lançado {selected ? `· ${selected.name}` : ""}.</p></div>
      </div>

      <Card><CardContent className="p-6">
        <input ref={fileRef} type="file" accept=".ofx,.qfx,.OFX,.QFX" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f); e.currentTarget.value = ""; }} />
        <div className="flex flex-col items-center justify-center gap-3 py-6 border-2 border-dashed rounded-xl">
          <Upload className="w-8 h-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground text-center">Selecione o arquivo <strong>.OFX</strong> exportado do internet banking.</p>
          <Button onClick={() => fileRef.current?.click()} disabled={parsing} className="gap-2">{parsing && <Loader2 className="w-4 h-4 animate-spin" />}{parsing ? "Lendo…" : "Escolher arquivo OFX"}</Button>
        </div>
      </CardContent></Card>

      {rows.length > 0 && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">No extrato</p><p className="text-2xl font-semibold mt-1">{rows.length}</p></div>
            <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Novas</p><p className="text-2xl font-semibold mt-1 text-primary">{novas.length}</p></div>
            <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Entradas (sel.)</p><p className="text-xl font-semibold mt-1 text-emerald-600">{brl(totalIn)}</p></div>
            <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Saídas (sel.)</p><p className="text-xl font-semibold mt-1 text-destructive">{brl(totalOut)}</p></div>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {conta?.bankId && <span>Banco {conta.bankId}</span>}{conta?.accountId && <span>Conta {conta.accountId}</span>}
              <button className="text-primary hover:underline" onClick={() => toggleAll(true)}>marcar novas</button>
              <button className="text-primary hover:underline" onClick={() => toggleAll(false)}>desmarcar</button>
            </div>
            <Button onClick={importar} disabled={importing || selecionadas.length === 0} className="gap-2">{importing && <Loader2 className="w-4 h-4 animate-spin" />}Importar {selecionadas.length > 0 ? `(${selecionadas.length})` : ""}</Button>
          </div>

          <Card><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="p-3 w-8"></th><th className="text-left font-medium p-3">Data</th>
              <th className="text-left font-medium p-3">Descrição</th><th className="text-right font-medium p-3">Valor</th><th className="text-center font-medium p-3">Status</th>
            </tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.hash + i} className={`border-b last:border-0 ${r.existe ? "opacity-50" : "hover:bg-muted/30"}`}>
                <td className="p-3">{!r.existe && <Checkbox checked={r.sel} onCheckedChange={() => toggle(i)} />}</td>
                <td className="p-3 whitespace-nowrap">{fmtDate(r.date)}</td>
                <td className="p-3">{r.description}</td>
                <td className={`p-3 text-right font-medium whitespace-nowrap ${r.type === "income" ? "text-emerald-600" : "text-destructive"}`}>
                  <span className="inline-flex items-center gap-1 justify-end">{r.type === "income" ? <ArrowUpCircle className="w-3.5 h-3.5" /> : <ArrowDownCircle className="w-3.5 h-3.5" />}{brl(r.amount)}</span>
                </td>
                <td className="p-3 text-center">{r.existe ? <Badge variant="secondary" className="gap-1"><Check className="w-3 h-3" /> já no caixa</Badge> : <Badge className="bg-primary/15 text-primary">nova</Badge>}</td>
              </tr>
            ))}</tbody>
          </table></div></CardContent></Card>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        A duplicidade é evitada pelo identificador único de cada transação no OFX (FITID + conta). Reimportar o mesmo extrato não duplica lançamentos.
        Os itens importados entram no caixa como entradas/saídas e já aparecem na DRE e no fluxo.
      </p>
    </div>
  );
}
