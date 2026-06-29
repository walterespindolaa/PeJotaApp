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
import { FileText, Building2, Plus, ExternalLink, RefreshCw, Loader2, AlertTriangle, Sparkles } from "lucide-react";
import { format, parseISO } from "date-fns";

const db = supabase as any;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toMoney = (s: string) => parseInt(s.replace(/\D/g, "") || "0", 10) / 100;
const fmtDate = (d: string) => { try { return format(parseISO(d), "dd/MM/yyyy HH:mm"); } catch { return d; } };

const STATUS: Record<string, { label: string; cls: string }> = {
  processando: { label: "Processando", cls: "bg-amber-500/15 text-amber-600" },
  concluido: { label: "Emitida", cls: "bg-emerald-500/15 text-emerald-600" },
  erro: { label: "Erro", cls: "bg-destructive/15 text-destructive" },
  cancelado: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

type Inv = { id: string; status: string; numero: string | null; valor: number; tomador_nome: string | null; tomador_doc: string | null; descricao: string | null; pdf_url: string | null; xml_url: string | null; erro: string | null; created_at: string };

export default function NotasFiscais() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [invs, setInvs] = useState<Inv[]>([]);
  const [loading, setLoading] = useState(false);
  const [emitenteOk, setEmitenteOk] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [doc, setDoc] = useState("");
  const [valor, setValor] = useState("");
  const [desc, setDesc] = useState("");
  const [emitindo, setEmitindo] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);

  const sugerirDescricao = async () => {
    setSugerindo(true);
    const { data, error } = await supabase.functions.invoke("pejota-ai-write", {
      body: { instrucao: `Escreva uma descrição curta e profissional do serviço prestado para uma nota fiscal de serviço (NFS-e). Tomador: ${nome || "cliente"}. Valor: ${valor || "—"}. Responda só com a descrição, 1 a 2 frases.` },
    });
    setSugerindo(false);
    if (error || data?.error) { toast({ title: "IA indisponível", variant: "destructive" }); return; }
    setDesc((data.text || "").trim());
  };

  const load = useCallback(async () => {
    if (!selected) { setInvs([]); return; }
    setLoading(true);
    const [{ data }, statusRes] = await Promise.all([
      db.from("business_invoices").select("*").eq("company_id", selected.id).order("created_at", { ascending: false }).limit(200),
      db.rpc("get_nfse_status", { p_company_id: selected.id }),
    ]);
    setInvs((data || []) as Inv[]);
    setEmitenteOk(!!statusRes.data?.[0]?.emitente_ok);
    setLoading(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const emitir = async () => {
    if (!selected) return;
    if (!nome.trim() || doc.replace(/\D/g, "").length < 11) { toast({ title: "Informe nome e CPF/CNPJ do tomador", variant: "destructive" }); return; }
    const v = toMoney(valor); if (!v) { toast({ title: "Informe o valor", variant: "destructive" }); return; }
    setEmitindo(true);
    const { data, error } = await supabase.functions.invoke("plugnotas-nfse", {
      body: { company_id: selected.id, tomador: { nome: nome.trim(), cpfCnpj: doc }, valor: v, descricao: desc.trim() || undefined },
    });
    setEmitindo(false);
    if (error || data?.error) {
      const msg = data?.error === "nfse_nao_configurado" ? "Configure a Nota Fiscal em Configuração → Nota fiscal." : (data?.error || error?.message || "Erro ao emitir");
      toast({ title: "Não foi possível emitir", description: msg, variant: "destructive" }); return;
    }
    toast({ title: "Nota enviada", description: "Acompanhe o status na lista." });
    setOpen(false); setNome(""); setDoc(""); setValor(""); setDesc(""); load();
  };

  const sincronizar = async () => {
    if (!selected) return;
    setSyncing(true);
    await supabase.functions.invoke("plugnotas-nfse", { body: { company_id: selected.id, action: "sync" } });
    setSyncing(false); load();
  };

  if (!companiesLoading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para emitir notas.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><FileText className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Notas fiscais (NFS-e)</h1>
          <p className="text-sm text-muted-foreground">Emita e acompanhe suas notas de serviço {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={sincronizar} disabled={syncing} className="gap-2"><RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} /> Sincronizar</Button>
          <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Emitir NFS-e</Button>
        </div>
      </div>

      {emitenteOk === false && (
        <Card className="border-amber-500/40 bg-amber-500/5"><CardContent className="flex items-center gap-3 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
          <p className="text-sm">Emitente ainda não configurado. Conclua a configuração em <Link to="/dashboard/nota-fiscal" className="text-primary underline">Configuração → Nota fiscal</Link> (token + dados fiscais + certificado A1).</p>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div>
        : invs.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">Nenhuma nota emitida ainda.</div>
        : <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium p-3">Data</th><th className="text-left font-medium p-3">Tomador</th>
              <th className="text-right font-medium p-3">Valor</th><th className="text-center font-medium p-3">Nº</th>
              <th className="text-center font-medium p-3">Status</th><th className="text-right font-medium p-3">Arquivos</th>
            </tr></thead>
            <tbody>{invs.map(n => {
              const st = STATUS[n.status] || STATUS.processando;
              return (
                <tr key={n.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 whitespace-nowrap">{fmtDate(n.created_at)}</td>
                  <td className="p-3">{n.tomador_nome || "—"}{n.erro && <span className="block text-[11px] text-destructive">{n.erro}</span>}</td>
                  <td className="p-3 text-right font-medium">{brl(Number(n.valor || 0))}</td>
                  <td className="p-3 text-center">{n.numero || "—"}</td>
                  <td className="p-3 text-center"><Badge variant="secondary" className={st.cls}>{st.label}</Badge></td>
                  <td className="p-3"><div className="flex items-center justify-end gap-1">
                    {n.pdf_url && <a href={n.pdf_url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" className="h-8 gap-1"><ExternalLink className="w-3.5 h-3.5" /> PDF</Button></a>}
                    {n.xml_url && <a href={n.xml_url} target="_blank" rel="noreferrer"><Button size="sm" variant="ghost" className="h-8 gap-1"><ExternalLink className="w-3.5 h-3.5" /> XML</Button></a>}
                  </div></td>
                </tr>
              );
            })}</tbody>
          </table></div>}
      </CardContent></Card>

      <Dialog open={open} onOpenChange={setOpen}><DialogContent>
        <DialogHeader><DialogTitle>Emitir NFS-e</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div><Label className="text-xs">Tomador (cliente)</Label><Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome / Razão social" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">CPF/CNPJ</Label><Input value={doc} onChange={e => setDoc(e.target.value)} placeholder="Só números" inputMode="numeric" /></div>
            <div><Label className="text-xs">Valor (R$)</Label><Input inputMode="numeric" placeholder="0,00" value={valor} onChange={e => setValor(toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }))} /></div>
          </div>
          <div>
            <div className="flex items-center justify-between"><Label className="text-xs">Descrição do serviço (opcional)</Label>
              <button type="button" onClick={sugerirDescricao} disabled={sugerindo} className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline disabled:opacity-50">{sugerindo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} Sugerir com IA</button>
            </div>
            <Input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Usa a descrição padrão se vazio" />
          </div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={emitir} disabled={emitindo} className="gap-2">{emitindo && <Loader2 className="w-4 h-4 animate-spin" />}{emitindo ? "Emitindo…" : "Emitir"}</Button></DialogFooter>
      </DialogContent></Dialog>
    </div>
  );
}
