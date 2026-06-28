import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Link2, Copy, Send, Palette, Info, X, Upload, Loader2, FileUp, Image as ImageIcon, CreditCard, ExternalLink, CheckCircle2, ShoppingCart, PackageMinus, ChevronDown, DollarSign, Pencil, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useBusinessProposals, type ProposalItem, type Proposal } from "@/hooks/useBusinessProposals";
import { useBusinessInventory } from "@/hooks/useBusinessInventory";

interface Row { _key: string; product_id: string | null; label: string; valor: string; quantidade: string; }
const mkRow = (init?: Partial<Row>): Row => ({
  _key: (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `r-${Math.random().toString(36).slice(2)}`,
  product_id: null, label: "", valor: "", quantidade: "1", ...init,
});
const num = (s: string) => Number(String(s).replace(",", ".")) || 0;
const STATUS_LABEL: Record<string, string> = { enviada: "Enviada", vista: "Vista", aceita: "Aceita", recusada: "Recusada", ajuste: "Ajuste pedido", rascunho: "Rascunho" };

interface PrefillArg { dir: "in" | "out"; amount: number; description: string; clientId?: string | null; onConfirmed?: () => void }

export default function BusinessPropostas({ companyId, controlsStock = true, onPrefillLancamento }: { companyId: string; controlsStock?: boolean; onPrefillLancamento?: (p: PrefillArg) => void }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt } = usePrivacyFmt();
  const { proposals, createAndSend, updateProposal, deleteProposal, refetch: refetchProposals } = useBusinessProposals(companyId);
  const { items: invItems, recipes, registerSale, registerMovement } = useBusinessInventory(companyId);
  const [searchParams, setSearchParams] = useSearchParams();

  // Itens de todas as propostas (para totais, custo de produção e lista de compras)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByProp, setItemsByProp] = useState<Record<string, { product_id: string | null; label: string; valor: number; quantidade: number }[]>>({});
  const [baixando, setBaixando] = useState(false);

  useEffect(() => {
    const ids = proposals.map(p => p.id);
    if (!ids.length) { setItemsByProp({}); return; }
    (async () => {
      const { data } = await supabase.from("business_proposal_items" as any).select("proposal_id,product_id,label,valor,quantidade").in("proposal_id", ids);
      const map: Record<string, any[]> = {};
      (data as any[] || []).forEach(it => { (map[it.proposal_id] ||= []).push(it); });
      setItemsByProp(map);
    })();
  }, [proposals]);

  const toggleExpand = (id: string) => setExpandedId(prev => prev === id ? null : id);

  // Total da proposta = soma(valor×qtd) − desconto
  const totalProp = (p: Proposal) => {
    const items = itemsByProp[p.id] || [];
    const sub = items.reduce((s, i) => s + Number(i.valor) * Number(i.quantidade || 1), 0);
    return Math.max(0, sub - Number(p.desconto || 0));
  };
  // Custo de produção (insumos da ficha técnica de cada produto)
  const custoProducaoProp = (propId: string) => {
    const items = itemsByProp[propId] || [];
    let custo = 0;
    for (const it of items) {
      if (!it.product_id) continue;
      for (const line of recipes.filter(r => r.produto_id === it.product_id)) {
        custo += Number(invItems.find(i => i.id === line.insumo_id)?.custo_unitario || 0) * Number(line.quantidade) * Number(it.quantidade || 1);
      }
    }
    return custo;
  };

  // Avança/muda o status da proposta
  const setStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("business_proposals" as any).update({ status, ...(status === "entregue" ? { delivered_at: new Date().toISOString() } : {}) } as any).eq("id", id);
    if (error) {
      toast({ title: "Não foi possível atualizar a proposta", description: error.message, variant: "destructive" });
      return;
    }
    await refetchProposals();
  };
  // Lança a receita (na entrega) — pré-preenchido para confirmar
  const lancarReceita = (p: Proposal) => {
    onPrefillLancamento?.({
      dir: "in", amount: totalProp(p), description: p.titulo || "Venda (proposta)", clientId: p.client_id,
      onConfirmed: async () => { await supabase.from("business_proposals" as any).update({ revenue_done: true } as any).eq("id", p.id); await refetchProposals(); },
    });
  };
  // Gera conta a receber a partir da proposta (liga Vendas → Financeiro → Asaas)
  const gerarConta = async (p: Proposal) => {
    const amount = totalProp(p);
    if (!amount) { toast({ title: "Proposta sem valor", variant: "destructive" }); return; }
    const due = p.valid_until || new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const { data, error } = await supabase.from("business_bills" as any).insert({
      company_id: companyId, user_id: user?.id, kind: "receber",
      description: p.titulo || "Venda (proposta)", amount, due_date: due,
      status: "pendente", payer_name: targetName(p),
    } as any).select("id").single();
    if (error) { toast({ title: "Erro ao gerar conta", description: error.message, variant: "destructive" }); return; }
    await supabase.from("business_proposals" as any).update({ bill_id: (data as any).id } as any).eq("id", p.id);
    await refetchProposals();
    toast({ title: "Conta a receber gerada", description: "Veja em Financeiro → Contas a receber (com cobrança Asaas)." });
  };
  // Lança o custo de produção — pré-preenchido
  const lancarCusto = (p: Proposal) => {
    onPrefillLancamento?.({ dir: "out", amount: custoProducaoProp(p.id), description: `Custo de produção — ${p.titulo || "proposta"}`, clientId: p.client_id });
  };

  // Insumos necessários (via ficha técnica) agregados para os itens da proposta
  const shoppingList = (propId: string) => {
    const items = itemsByProp[propId] || [];
    const need: Record<string, number> = {};
    for (const it of items) {
      if (!it.product_id) continue;
      for (const line of recipes.filter(r => r.produto_id === it.product_id)) {
        need[line.insumo_id] = (need[line.insumo_id] || 0) + Number(line.quantidade) * Number(it.quantidade || 1);
      }
    }
    return Object.entries(need).map(([insumoId, precisa]) => {
      const ins = invItems.find(i => i.id === insumoId);
      const estoque = Number(ins?.saldo || 0);
      return { nome: ins?.nome || "Insumo", unidade: ins?.unidade || "", categoria: ins?.categoria || "Outros", precisa, estoque, comprar: Math.max(0, precisa - estoque) };
    });
  };
  // Agrupa a lista por categoria do insumo
  const groupByCategoria = (lista: ReturnType<typeof shoppingList>) => {
    const groups: Record<string, typeof lista> = {};
    for (const l of lista) { (groups[l.categoria] ||= []).push(l); }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  };

  const darBaixa = async (propId: string) => {
    const items = itemsByProp[propId] || [];
    setBaixando(true);
    let ok = true;
    for (const it of items) {
      if (!it.product_id) continue;
      const temReceita = recipes.some(r => r.produto_id === it.product_id);
      if (temReceita) {
        if (!(await registerSale(it.product_id, Number(it.quantidade || 1)))) ok = false;
      } else {
        const prod = invItems.find(i => i.id === it.product_id);
        if (prod) { if (!(await registerMovement(prod, "saida", Number(it.quantidade || 1), "Venda via proposta"))) ok = false; }
        else ok = false;
      }
    }
    // Só marca "estoque baixado" se TODOS os itens baixaram (evita divergência silenciosa).
    if (ok) {
      await supabase.from("business_proposals" as any).update({ stock_done: true } as any).eq("id", propId);
      await refetchProposals();
      toast({ title: "Baixa registrada no estoque" });
    } else {
      await refetchProposals();
      toast({ title: "Baixa parcial no estoque", description: "Nem todos os itens puderam ser baixados. Confira o estoque.", variant: "destructive" });
    }
    setBaixando(false);
  };

  // Card do kanban
  const renderCard = (p: Proposal) => {
    const isOpen = expandedId === p.id;
    const lista = isOpen ? shoppingList(p.id) : [];
    const custo = custoProducaoProp(p.id);
    return (
      <Card key={p.id} className="shadow-soft">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start gap-2">
            <button onClick={() => setDetailProp(p)} className="min-w-0 flex-1 text-left group" aria-label="Ver detalhes da proposta">
              <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{p.titulo || "Proposta"}</p>
              <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1"><User className="h-3 w-3 flex-shrink-0" />{targetName(p)}</p>
              <p className="text-[11px] text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")} · <span className="font-medium text-foreground">{fmt(totalProp(p))}</span></p>
            </button>
            {p.token && <button onClick={() => copyLink(`${window.location.origin}/proposta/${p.token}`)} aria-label="Copiar link" className="text-muted-foreground hover:text-primary flex-shrink-0"><Link2 className="h-3.5 w-3.5" /></button>}
            <button onClick={() => deleteProposal(p.id)} aria-label="Excluir" className="text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>

          {["enviada", "vista", "ajuste"].includes(p.status) && (
            <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" onClick={() => setStatus(p.id, "aceita")}><CheckCircle2 className="h-3.5 w-3.5" />Marcar como aceita</Button>
          )}

          {p.status === "aceita" && (
            <div className="space-y-1.5">
              {controlsStock && (
                <>
                  <button onClick={() => toggleExpand(p.id)} className="text-[11px] text-primary flex items-center gap-1"><ShoppingCart className="h-3 w-3" />Lista de compras <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>
                  {isOpen && (
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      {lista.length === 0 ? <p className="text-[11px] text-muted-foreground">Sem insumos na ficha técnica.</p> : (
                        <div className="space-y-1.5">
                          {groupByCategoria(lista).map(([cat, itens]) => (
                            <div key={cat}>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{cat}</p>
                              {itens.map((l, i) => (
                                <div key={i} className="flex justify-between text-[11px]">
                                  <span className="text-foreground">{l.nome}</span>
                                  <span className={l.comprar > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{l.comprar > 0 ? `comprar ${l.comprar}${l.unidade ? " " + l.unidade : ""}` : "ok"}</span>
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {custo > 0 && <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" onClick={() => lancarCusto(p)}><DollarSign className="h-3.5 w-3.5" />Lançar custo de produção ({fmt(custo)})</Button>}
                  {p.stock_done
                    ? <p className="text-[11px] text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Estoque baixado</p>
                    : <Button size="sm" variant="ghost" className="w-full h-7 text-xs gap-1 text-muted-foreground" disabled={baixando} onClick={() => darBaixa(p.id)}><PackageMinus className="h-3.5 w-3.5" />Dar baixa no estoque</Button>}
                </>
              )}
              <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={() => setStatus(p.id, "entregue")}><CheckCircle2 className="h-3.5 w-3.5" />Marcar entregue</Button>
            </div>
          )}

          {p.status === "entregue" && (
            p.revenue_done
              ? <p className="text-[11px] text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Receita lançada no Financeiro</p>
              : <Button size="sm" className="w-full h-7 text-xs gap-1" onClick={() => lancarReceita(p)}><DollarSign className="h-3.5 w-3.5" />Lançar receita ({fmt(totalProp(p))})</Button>
          )}

          {(p.status === "aceita" || p.status === "entregue") && (
            p.bill_id
              ? <p className="text-[11px] text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Conta a receber gerada</p>
              : <Button size="sm" variant="outline" className="w-full h-7 text-xs gap-1" onClick={() => gerarConta(p)}><CreditCard className="h-3.5 w-3.5" />Gerar conta a receber</Button>
          )}
        </CardContent>
      </Card>
    );
  };

  // Agrupamento do kanban
  const grupos = {
    aberto: proposals.filter(p => ["enviada", "vista", "ajuste"].includes(p.status)),
    aceita: proposals.filter(p => p.status === "aceita"),
    entregue: proposals.filter(p => p.status === "entregue"),
  };
  const recusadas = proposals.filter(p => p.status === "recusada");

  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [leads, setLeads] = useState<{ id: string; nome: string }[]>([]);
  const [products, setProducts] = useState<{ id: string; nome: string; preco_venda: number }[]>([]);

  // Branding
  const [brand, setBrand] = useState({ logo_url: "", brand_color: "#4F7942", media_kit_url: "" });
  const [helpDismissed, setHelpDismissed] = useState(() => { try { return localStorage.getItem("atlas-propostas-help") === "1"; } catch { return false; } });

  // Form
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [detailProp, setDetailProp] = useState<Proposal | null>(null);
  const [targetType, setTargetType] = useState<"cliente" | "lead">("cliente");
  const [targetId, setTargetId] = useState("");
  const [titulo, setTitulo] = useState("");
  const [terms, setTerms] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [desconto, setDesconto] = useState("");
  const [rows, setRows] = useState<Row[]>([mkRow()]);
  const [metodo, setMetodo] = useState<"" | "pix" | "cartao" | "ambos">("");
  const [parcelas, setParcelas] = useState("1");
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingKit, setUploadingKit] = useState(false);

  // Upload de arquivo para o bucket business-assets (logo/media kit)
  const uploadFile = async (file: File, kind: "logo" | "kit"): Promise<string | null> => {
    if (!user) return null;
    const maxMb = kind === "logo" ? 2 : 10;
    if (file.size > maxMb * 1024 * 1024) {
      toast({
        title: `Arquivo acima de ${maxMb}MB`,
        description: kind === "logo" ? "Comprima a imagem antes em squoosh.app e tente de novo." : "Use um PDF menor ou hospede em outro link.",
        variant: "destructive",
      });
      return null;
    }
    const ext = file.name.split(".").pop() || (kind === "logo" ? "png" : "pdf");
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("business-assets").upload(path, file, { upsert: true, contentType: file.type });
    if (error) { toast({ title: "Falha no upload", description: error.message, variant: "destructive" }); return null; }
    return supabase.storage.from("business-assets").getPublicUrl(path).data.publicUrl;
  };

  const onLogoFile = async (file?: File) => {
    if (!file) return;
    setUploadingLogo(true);
    const url = await uploadFile(file, "logo");
    setUploadingLogo(false);
    if (url) setBrand(b => ({ ...b, logo_url: url }));
  };
  const onKitFile = async (file?: File) => {
    if (!file) return;
    setUploadingKit(true);
    const url = await uploadFile(file, "kit");
    setUploadingKit(false);
    if (url) setBrand(b => ({ ...b, media_kit_url: url }));
  };

  const load = useCallback(async () => {
    if (!user || !companyId) return;
    const [cli, led, prod, comp] = await Promise.all([
      supabase.from("business_clients").select("id,name").eq("company_id", companyId).order("name").limit(1000),
      supabase.from("business_leads" as any).select("id,nome").eq("company_id", companyId).neq("estagio", "perdido").order("created_at", { ascending: false }).limit(500),
      supabase.from("business_inventory_items").select("id,nome,preco_venda").eq("company_id", companyId).eq("tipo", "produto").order("nome").limit(2000),
      supabase.from("companies").select("logo_url,brand_color,media_kit_url").eq("id", companyId).maybeSingle(),
    ]);
    setClients((cli.data as any[]) || []);
    setLeads((led.data as any[]) || []);
    setProducts((prod.data as any[]) || []);
    const c = comp.data as any;
    if (c) setBrand({ logo_url: c.logo_url || "", brand_color: c.brand_color || "#4F7942", media_kit_url: c.media_kit_url || "" });
  }, [user, companyId]);

  useEffect(() => { load(); }, [load]);

  const saveBrand = async () => {
    await supabase.from("companies").update(brand as any).eq("id", companyId);
    toast({ title: "Identidade salva" });
  };

  const addRow = () => setRows(r => [...r, mkRow()]);
  const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));
  const setRow = (i: number, patch: Partial<Row>) => setRows(r => r.map((x, idx) => idx === i ? { ...x, ...patch } : x));
  const pickProduct = (i: number, pid: string) => {
    const p = products.find(x => x.id === pid);
    if (p) setRow(i, { product_id: p.id, label: p.nome, valor: String(p.preco_venda || "") });
  };

  const subtotal = rows.reduce((s, r) => s + num(r.valor) * (num(r.quantidade) || 1), 0);
  const total = Math.max(0, subtotal - num(desconto));

  const reset = () => {
    setEditingId(null);
    setTargetType("cliente"); setTargetId(""); setTitulo(""); setTerms(""); setValidUntil(""); setDesconto("");
    setRows([mkRow()]); setMetodo(""); setParcelas("1"); setGeneratedLink(null);
  };

  const gerar = async () => {
    if (!targetId) { toast({ title: "Escolha o cliente ou lead", variant: "destructive" }); return; }
    const items: ProposalItem[] = rows.filter(r => r.label.trim()).map(r => ({
      product_id: r.product_id, label: r.label.trim(), valor: num(r.valor), quantidade: num(r.quantidade) || 1,
    }));
    if (items.length === 0) { toast({ title: "Adicione ao menos um item", variant: "destructive" }); return; }
    const payload = {
      client_id: targetType === "cliente" ? targetId : null,
      lead_id: targetType === "lead" ? targetId : null,
      titulo: titulo || undefined, terms: terms || undefined,
      valid_until: validUntil || null, desconto: num(desconto),
      payment_method: metodo || null, installments: metodo === "pix" ? 1 : (num(parcelas) || 1),
      items,
    };
    setSaving(true);
    if (editingId) {
      const ok = await updateProposal(editingId, payload);
      setSaving(false);
      if (ok) { toast({ title: "Proposta atualizada!" }); setOpen(false); reset(); }
      else toast({ title: "Não foi possível atualizar a proposta", variant: "destructive" });
      return;
    }
    const token = await createAndSend(payload);
    setSaving(false);
    if (token) {
      setGeneratedLink(`${window.location.origin}/proposta/${token}`);
      toast({ title: "Proposta gerada!" });
    } else {
      toast({ title: "Não foi possível gerar a proposta", variant: "destructive" });
    }
  };

  const copyLink = (link: string) => { navigator.clipboard?.writeText(link); toast({ title: "Link copiado" }); };

  // Nome do cliente/lead da proposta
  const targetName = (p: Proposal) =>
    p.client_id ? (clients.find(c => c.id === p.client_id)?.name || "Cliente")
    : p.lead_id ? (leads.find(l => l.id === p.lead_id)?.nome || "Lead")
    : "Sem cliente";

  // Abre o formulário em modo edição, pré-carregado
  const openEdit = (p: Proposal) => {
    setDetailProp(null);
    setEditingId(p.id);
    setTargetType(p.client_id ? "cliente" : "lead");
    setTargetId(p.client_id || p.lead_id || "");
    setTitulo(p.titulo || "");
    setTerms((p as any).terms || "");
    setValidUntil((p as any).valid_until || "");
    setDesconto(p.desconto ? String(p.desconto) : "");
    setMetodo((((p as any).payment_method) || "") as any);
    setParcelas(String((p as any).installments || 1));
    const its = itemsByProp[p.id] || [];
    setRows(its.length
      ? its.map(it => mkRow({ product_id: it.product_id, label: it.label, valor: String(it.valor), quantidade: String(it.quantidade || 1) }))
      : [mkRow()]);
    setGeneratedLink(null);
    setOpen(true);
  };

  // Pré-preenche a partir de um lead (vindo do Funil via ?lead=)
  useEffect(() => {
    const leadId = searchParams.get("lead");
    if (leadId && leads.some(l => l.id === leadId)) {
      reset();
      setTargetType("lead");
      setTargetId(leadId);
      setOpen(true);
      const next = new URLSearchParams(searchParams);
      next.delete("lead");
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, leads]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {!helpDismissed && (
        <Card className="border-primary/20 bg-primary/5 relative">
          <CardContent className="p-4">
            <button onClick={() => { try { localStorage.setItem("atlas-propostas-help", "1"); } catch { /* ignore */ } setHelpDismissed(true); }} aria-label="Fechar" className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            <p className="text-sm font-heading font-bold flex items-center gap-1.5 mb-2"><Info className="h-4 w-4 text-primary" />Como funcionam as propostas</p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li><span className="font-semibold text-foreground">1.</span> Personalize a identidade (logo + cor + media kit) — aparece na proposta.</li>
              <li><span className="font-semibold text-foreground">2.</span> Crie a proposta escolhendo o cliente ou lead e os produtos (puxa do estoque).</li>
              <li><span className="font-semibold text-foreground">3.</span> Gere o link e envie. A pessoa abre, vê e aceita/recusa. Se for <span className="font-medium text-foreground">lead</span>, o card já avança pra "Proposta" no funil.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {/* Branding */}
      <Card className="shadow-soft">
        <CardContent className="p-4 space-y-3">
          <p className="text-sm font-heading font-bold flex items-center gap-1.5"><Palette className="h-4 w-4 text-primary" />Identidade da proposta</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Logo */}
            <div className="space-y-1.5">
              <Label className="text-xs">Logo</Label>
              <div className="flex items-center gap-2">
                <span className="w-12 h-12 rounded-xl border border-border bg-muted/40 grid place-items-center overflow-hidden flex-shrink-0">
                  {brand.logo_url ? <img src={brand.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon className="h-5 w-5 text-muted-foreground" />}
                </span>
                <div className="space-y-1">
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs cursor-pointer hover:bg-muted/50">
                    {uploadingLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {brand.logo_url ? "Trocar" : "Enviar logo"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingLogo} onChange={e => onLogoFile(e.target.files?.[0])} />
                  </label>
                  {brand.logo_url && <button onClick={() => setBrand(b => ({ ...b, logo_url: "" }))} className="text-[10px] text-muted-foreground hover:text-destructive ml-1">remover</button>}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">PNG/JPG até 2MB. Maior?{" "}
                <a href="https://squoosh.app/" target="_blank" rel="noopener noreferrer" className="text-primary underline">comprima aqui</a>.
              </p>
            </div>
            {/* Cor */}
            <div className="space-y-1.5">
              <Label className="text-xs">Cor da marca</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={brand.brand_color} onChange={e => setBrand(b => ({ ...b, brand_color: e.target.value }))} className="h-9 w-9 rounded-lg border border-border p-0.5 cursor-pointer flex-shrink-0" aria-label="Cor" />
                <Input value={brand.brand_color} onChange={e => setBrand(b => ({ ...b, brand_color: e.target.value }))} className="h-9 text-sm font-mono w-24" />
              </div>
            </div>
            {/* Media kit */}
            <div className="space-y-1.5">
              <Label className="text-xs">Media kit (PDF)</Label>
              <label className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg border border-border text-xs cursor-pointer hover:bg-muted/50">
                {uploadingKit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                {brand.media_kit_url ? "Trocar PDF" : "Enviar PDF"}
                <input type="file" accept="application/pdf" className="hidden" disabled={uploadingKit} onChange={e => onKitFile(e.target.files?.[0])} />
              </label>
              <Input value={brand.media_kit_url} onChange={e => setBrand(b => ({ ...b, media_kit_url: e.target.value }))} placeholder="ou cole uma URL" className="h-8 text-xs" />
              {brand.media_kit_url && <a href={brand.media_kit_url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-primary underline inline-flex items-center gap-0.5">ver atual <ExternalLink className="h-2.5 w-2.5" /></a>}
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={saveBrand}>Salvar identidade</Button>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm font-heading font-bold">Propostas</p>
        <Button size="sm" className="gap-1.5" onClick={() => { reset(); setOpen(true); }}><Plus className="h-3.5 w-3.5" />Nova proposta</Button>
      </div>

      {/* Resumo de receita */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-[11px] text-muted-foreground">Receita prevista (aceitas)</p>
          <p className="font-heading font-bold text-amber-600">{fmt(grupos.aceita.reduce((s, p) => s + totalProp(p), 0))}</p>
        </div>
        <div className="rounded-xl border border-success/30 bg-success/5 p-3">
          <p className="text-[11px] text-muted-foreground">Receita realizada (entregues)</p>
          <p className="font-heading font-bold text-success">{fmt(grupos.entregue.reduce((s, p) => s + totalProp(p), 0))}</p>
        </div>
      </div>

      {proposals.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhuma proposta ainda.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
          {([
            ["Em aberto", grupos.aberto, "text-muted-foreground"],
            ["Aceita · prevista", grupos.aceita, "text-amber-600"],
            ["Entregue · realizada", grupos.entregue, "text-success"],
          ] as const).map(([title, list, cls]) => (
            <div key={title} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className={`text-xs font-bold ${cls}`}>{title}</span>
                <span className="text-[11px] text-muted-foreground">{list.length}</span>
              </div>
              {list.length === 0 ? <p className="text-[11px] text-muted-foreground px-1 py-2">—</p> : list.map(renderCard)}
            </div>
          ))}
        </div>
      )}

      {recusadas.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">Recusadas ({recusadas.length})</summary>
          <div className="mt-2 space-y-1">
            {recusadas.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="flex-1 truncate">{p.titulo || "Proposta"} · {fmt(totalProp(p))}</span>
                <button onClick={() => deleteProposal(p.id)} aria-label="Excluir" className="hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Dialog nova proposta */}
      <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) reset(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-heading">{editingId ? "Editar proposta" : "Nova proposta"}</DialogTitle></DialogHeader>

          {generatedLink ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Proposta gerada! Envie este link:</p>
              <div className="flex gap-2">
                <Input readOnly value={generatedLink} className="text-xs" />
                <Button onClick={() => copyLink(generatedLink)} className="gap-1.5 flex-shrink-0"><Copy className="h-4 w-4" />Copiar</Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => { setOpen(false); reset(); }}>Fechar</Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Para</Label>
                  <Select value={targetType} onValueChange={v => { setTargetType(v as any); setTargetId(""); }}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="cliente">Cliente</SelectItem><SelectItem value="lead">Lead (funil)</SelectItem></SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{targetType === "cliente" ? "Cliente" : "Lead"}</Label>
                  <Select value={targetId} onValueChange={setTargetId}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {(targetType === "cliente" ? clients.map(c => ({ id: c.id, nome: c.name })) : leads).map(o => (
                        <SelectItem key={o.id} value={o.id}>{(o as any).nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div><Label className="text-xs">Título</Label><Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex: Proposta de serviços / Cardápio" className="h-9 text-sm" /></div>

              <div className="space-y-2">
                <Label className="text-xs">Itens</Label>
                {rows.map((r, i) => (
                  <div key={r._key} className="rounded-lg border border-border/60 p-2 space-y-2">
                    <div className="flex items-center gap-1.5">
                      {products.length > 0 && (
                        <Select value={r.product_id || ""} onValueChange={v => pickProduct(i, v)}>
                          <SelectTrigger className="h-8 w-8 px-0 justify-center flex-shrink-0" aria-label="Puxar do estoque"><Plus className="h-3.5 w-3.5" /></SelectTrigger>
                          <SelectContent>{products.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                      <Input value={r.label} onChange={e => setRow(i, { label: e.target.value })} placeholder="Nome do item" className="h-8 text-sm flex-1" />
                      <button onClick={() => removeRow(i)} aria-label="Remover" className="text-muted-foreground hover:text-destructive flex-shrink-0 px-1"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    <div className="flex items-center gap-2 pl-0.5">
                      <div className="relative flex-1">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">R$</span>
                        <Input value={r.valor} onChange={e => setRow(i, { valor: e.target.value })} placeholder="0,00" inputMode="decimal" className="h-8 text-sm pl-8" />
                      </div>
                      <span className="text-sm text-muted-foreground">×</span>
                      <Input value={r.quantidade} onChange={e => setRow(i, { quantidade: e.target.value })} placeholder="1" inputMode="decimal" className="h-8 text-sm w-14 text-center" />
                      <span className="text-sm text-muted-foreground">=</span>
                      <span className="text-sm font-semibold w-24 text-right">{fmt(num(r.valor) * (num(r.quantidade) || 1))}</span>
                    </div>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={addRow}><Plus className="h-3 w-3" />Adicionar item</Button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Desconto (R$)</Label><Input value={desconto} onChange={e => setDesconto(e.target.value)} placeholder="0" inputMode="decimal" className="h-9 text-sm" /></div>
                <div><Label className="text-xs">Validade</Label><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="h-9 text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs flex items-center gap-1"><CreditCard className="h-3 w-3" />Pagamento</Label>
                  <Select value={metodo || "none"} onValueChange={v => setMetodo(v === "none" ? "" : v as any)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não informar</SelectItem>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="cartao">Cartão</SelectItem>
                      <SelectItem value="ambos">PIX ou Cartão</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(metodo === "cartao" || metodo === "ambos") && (
                  <div>
                    <Label className="text-xs">Parcelas</Label>
                    <Select value={parcelas} onValueChange={setParcelas}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>{Array.from({ length: 12 }, (_, i) => i + 1).map(n => <SelectItem key={n} value={String(n)}>{n}x</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <div><Label className="text-xs">Termos / observações</Label><Textarea rows={2} value={terms} onChange={e => setTerms(e.target.value)} className="text-sm resize-none" /></div>

              <div className="space-y-0.5 pt-1 border-t border-border/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Subtotal</span><span>{fmt(subtotal)}</span>
                </div>
                {num(desconto) > 0 && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Desconto</span><span>− {fmt(num(desconto))}</span>
                  </div>
                )}
              </div>
              {num(desconto) > subtotal && subtotal > 0 && (
                <p className="text-[11px] text-amber-600">O desconto está maior que o subtotal.</p>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total</span>
                <span className="font-heading font-bold">{fmt(total)}</span>
              </div>

              <Button onClick={gerar} disabled={saving} className="w-full gap-1.5"><Send className="h-4 w-4" />{editingId ? (saving ? "Salvando..." : "Salvar alterações") : (saving ? "Gerando..." : "Gerar link da proposta")}</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Detalhe da proposta */}
      <Dialog open={!!detailProp} onOpenChange={v => { if (!v) setDetailProp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">{detailProp?.titulo || "Proposta"}</DialogTitle></DialogHeader>
          {detailProp && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="h-4 w-4 flex-shrink-0" /> <span className="text-foreground font-medium">{targetName(detailProp)}</span>
                <Badge variant="outline" className="ml-auto text-[10px]">{STATUS_LABEL[detailProp.status] || detailProp.status}</Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">Criada em {new Date(detailProp.created_at).toLocaleDateString("pt-BR")}</p>
              <div className="rounded-lg border border-border/60 divide-y divide-border/60">
                {(itemsByProp[detailProp.id] || []).length === 0
                  ? <p className="text-xs text-muted-foreground p-2.5">Sem itens.</p>
                  : (itemsByProp[detailProp.id] || []).map((it, i) => (
                    <div key={i} className="flex justify-between gap-2 p-2.5 text-xs">
                      <span className="text-foreground">{it.label}{Number(it.quantidade) > 1 ? ` ×${it.quantidade}` : ""}</span>
                      <span className="font-medium">{fmt(Number(it.valor) * Number(it.quantidade || 1))}</span>
                    </div>
                  ))}
              </div>
              {Number(detailProp.desconto) > 0 && <div className="flex justify-between text-xs text-muted-foreground"><span>Desconto</span><span>− {fmt(Number(detailProp.desconto))}</span></div>}
              <div className="flex justify-between font-heading font-bold"><span>Total</span><span>{fmt(totalProp(detailProp))}</span></div>
              <div className="flex gap-2 pt-1">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEdit(detailProp)}><Pencil className="h-3.5 w-3.5" />Editar</Button>
                {detailProp.token && <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => copyLink(`${window.location.origin}/proposta/${detailProp.token}`)}><Link2 className="h-3.5 w-3.5" />Copiar link</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
