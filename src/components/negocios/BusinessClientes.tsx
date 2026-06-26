import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Search, Cake, Info, X, TrendingUp, ArrowLeft, BellRing, Clock, Phone, Mail, MessageCircle, PartyPopper, Pencil, Package } from "lucide-react";
import BusinessClienteCRM from "@/components/negocios/BusinessClienteCRM";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import BusinessClientsManager from "@/components/negocios/BusinessClientsManager";

const waNumber = (phone: string) => {
  const d = (phone || "").replace(/\D/g, "");
  return d.length > 0 && d.length <= 11 ? "55" + d : d;
};

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  document: string | null;
  data_nascimento: string | null;
}

// Transações e categorias vêm da página principal (fonte única) — garante que
// receita/lucro por cliente batem com os números do Financeiro (mesma fórmula).
interface Tx {
  id: string;
  client_id: string | null;
  category_id: string | null;
  product_id: string | null;
  quantidade: number | null;
  direction: "in" | "out";
  amount: number;
  date: string;
  description: string;
}
interface Cat { id: string; name: string; }

interface Props {
  companyId: string;
  transactions: Tx[];
  categories: Cat[];
  onNovoLancamento?: (clientId: string, dir?: "in" | "out") => void;
}

export default function BusinessClientes({ companyId, transactions, categories, onNovoLancamento }: Props) {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [products, setProducts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [managerOpen, setManagerOpen] = useState(false);
  const [editClientId, setEditClientId] = useState<string | null>(null);
  const [openClientId, setOpenClientId] = useState<string | null>(null);

  const [helpDismissed, setHelpDismissed] = useState(() => {
    try { return localStorage.getItem("atlas-clientes-help") === "1"; } catch { return false; }
  });
  const dismissHelp = () => { try { localStorage.setItem("atlas-clientes-help", "1"); } catch { /* ignore */ } setHelpDismissed(true); };

  const fetchClients = useCallback(async () => {
    if (!user || !companyId) { setClients([]); setLoading(false); return; }
    setLoading(true);
    const [cliRes, invRes] = await Promise.all([
      supabase.from("business_clients").select("id,name,email,phone,document,data_nascimento").eq("company_id", companyId).order("name").limit(1000),
      supabase.from("business_inventory_items").select("id,nome").eq("company_id", companyId).limit(2000),
    ]);
    setClients(((cliRes.data as unknown) as ClientRow[]) || []);
    const pmap: Record<string, string> = {};
    ((invRes.data as any[]) || []).forEach(p => { pmap[p.id] = p.nome; });
    setProducts(pmap);
    setLoading(false);
  }, [user, companyId]);

  useEffect(() => { fetchClients(); }, [fetchClients]);

  const catName = useCallback((id: string | null) => {
    if (!id) return "Sem categoria";
    return categories.find(c => c.id === id)?.name || "Sem categoria";
  }, [categories]);

  // Estatística por cliente — MESMA fórmula da página principal: lucro = entradas − saídas.
  const statsByClient = useMemo(() => {
    const map: Record<string, { receita: number; custos: number; nLanc: number; ultima: string | null }> = {};
    transactions.forEach(t => {
      if (!t.client_id) return;
      const e = map[t.client_id] || { receita: 0, custos: 0, nLanc: 0, ultima: null };
      const v = Number(t.amount) || 0;
      if (t.direction === "in") e.receita += v; else e.custos += v;
      e.nLanc += 1;
      if (!e.ultima || t.date > e.ultima) e.ultima = t.date;
      map[t.client_id] = e;
    });
    return map;
  }, [transactions]);

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.document || "").includes(search) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const mesAtual = String(new Date().getMonth() + 1).padStart(2, "0");

  // Lembretes: aniversariantes do mês + clientes sumidos (3+ meses sem lançamento).
  const monthsSince = (d: string) => {
    const then = new Date(d + "T12:00:00");
    const now = new Date();
    return (now.getFullYear() - then.getFullYear()) * 12 + (now.getMonth() - then.getMonth());
  };
  const aniversariantes = clients.filter(c => c.data_nascimento && c.data_nascimento.slice(5, 7) === mesAtual);
  const inativos = clients
    .map(c => ({ c, ultima: statsByClient[c.id]?.ultima || null }))
    .filter(x => x.ultima && monthsSince(x.ultima) >= 3)
    .map(x => ({ c: x.c, meses: monthsSince(x.ultima!) }))
    .sort((a, b) => b.meses - a.meses);

  // ── Detalhe de um cliente ──
  if (openClientId) {
    const c = clients.find(x => x.id === openClientId);
    const txs = transactions.filter(t => t.client_id === openClientId).sort((a, b) => b.date.localeCompare(a.date));
    const receita = txs.filter(t => t.direction === "in").reduce((s, t) => s + Number(t.amount), 0);
    const custos = txs.filter(t => t.direction === "out").reduce((s, t) => s + Number(t.amount), 0);
    const lucro = receita - custos;
    // Repasses por função (categoria das saídas)
    const repByCat: Record<string, number> = {};
    txs.filter(t => t.direction === "out").forEach(t => {
      const n = catName(t.category_id);
      repByCat[n] = (repByCat[n] || 0) + Number(t.amount);
    });
    const repasses = Object.entries(repByCat).sort((a, b) => b[1] - a[1]);
    // Itens comprados (produtos vinculados às entradas)
    const itensMap: Record<string, { nome: string; qtd: number; valor: number }> = {};
    txs.filter(t => t.product_id && t.direction === "in").forEach(t => {
      const id = t.product_id!;
      const e = itensMap[id] || { nome: products[id] || "Produto", qtd: 0, valor: 0 };
      e.qtd += Number(t.quantidade) || 0;
      e.valor += Number(t.amount) || 0;
      itensMap[id] = e;
    });
    const itens = Object.values(itensMap).sort((a, b) => b.valor - a.valor);
    // Métricas de CRM
    const entradas = txs.filter(t => t.direction === "in");
    const nCompras = entradas.length;
    const ticketMedio = nCompras > 0 ? receita / nCompras : 0;
    const ultimaCompra = entradas.reduce((m, t) => (t.date > m ? t.date : m), "");
    const diasDesde = ultimaCompra ? Math.floor((Date.now() - new Date(ultimaCompra + "T12:00:00").getTime()) / 86400000) : null;

    return (
      <div className="space-y-4">
        <button onClick={() => setOpenClientId(null)} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <p className="text-lg font-heading font-bold">{c?.name || "Cliente"}</p>
                <div className="flex flex-col gap-1.5 text-sm">
                  {c?.phone && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-foreground">{c.phone}</span>
                      <a href={`https://wa.me/${waNumber(c.phone)}`} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:underline">
                        <MessageCircle className="h-3.5 w-3.5" />WhatsApp
                      </a>
                    </div>
                  )}
                  {c?.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <a href={`mailto:${c.email}`} className="text-foreground hover:underline break-all">{c.email}</a>
                    </div>
                  )}
                  {c?.data_nascimento && (
                    <div className="flex items-center gap-2">
                      <PartyPopper className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                      <span className="text-foreground">{c.data_nascimento.slice(8, 10)}/{c.data_nascimento.slice(5, 7)}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                {onNovoLancamento && (
                  <Button size="sm" className="gap-1.5" onClick={() => onNovoLancamento(openClientId!, "in")}>
                    <Plus className="h-3.5 w-3.5" />Lançamento
                  </Button>
                )}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { setEditClientId(openClientId); setManagerOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />Editar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Métricas (CRM) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border/50 p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Total recebido</p>
            <p className="text-sm font-heading font-bold text-foreground">{fmt(receita)}</p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Ticket médio</p>
            <p className="text-sm font-heading font-bold text-foreground">{fmt(ticketMedio)}</p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Compras</p>
            <p className="text-sm font-heading font-bold text-foreground">{nCompras}</p>
          </div>
          <div className="rounded-xl border border-border/50 p-3">
            <p className="text-[10px] text-muted-foreground uppercase">Última compra</p>
            <p className="text-sm font-heading font-bold text-foreground">{ultimaCompra ? ultimaCompra.split("-").reverse().join("/") : "—"}</p>
            {diasDesde != null && <p className="text-[10px] text-muted-foreground">há {diasDesde} dia{diasDesde === 1 ? "" : "s"}</p>}
          </div>
        </div>

        {/* Rentabilidade — mesma fórmula da página principal (entradas − saídas) */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/40">
            <p className="text-[10px] text-muted-foreground uppercase">Receita</p>
            <p className="text-sm font-heading font-bold text-emerald-600">{fmt(receita)}</p>
          </div>
          <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
            <p className="text-[10px] text-muted-foreground uppercase">Repasses/Custos</p>
            <p className="text-sm font-heading font-bold text-destructive">{fmt(custos)}</p>
          </div>
          <div className={`p-3 rounded-xl border ${lucro >= 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/5 border-destructive/20"}`}>
            <p className="text-[10px] text-muted-foreground uppercase">Lucro líquido</p>
            <p className={`text-sm font-heading font-bold ${lucro >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(lucro)}</p>
          </div>
        </div>

        {repasses.length > 0 && (
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs font-heading font-bold mb-2">Repasses por função</p>
              <div className="space-y-1.5">
                {repasses.map(([nome, valor]) => (
                  <div key={nome} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{nome}</span>
                    <span className="font-medium text-destructive">{fmt(valor)}</span>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">A "função" é a categoria da saída. Cadastre categorias como "Design", "Copy", "Filmmaker" e vincule a despesa ao cliente.</p>
            </CardContent>
          </Card>
        )}

        {itens.length > 0 && (
          <Card className="shadow-soft">
            <CardContent className="p-4">
              <p className="text-xs font-heading font-bold mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-primary" />Itens comprados</p>
              <div className="space-y-1.5">
                {itens.map((it, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-1.5 last:border-0">
                    <span className="text-foreground truncate">
                      {it.nome}{it.qtd > 0 && <span className="text-muted-foreground text-xs"> · {it.qtd} un</span>}
                    </span>
                    <span className="font-medium text-emerald-600 flex-shrink-0">{fmt(it.valor)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <BusinessClienteCRM clientId={openClientId} companyId={companyId} />

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <p className="text-xs font-heading font-bold mb-2">Lançamentos ({txs.length})</p>
            {txs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum lançamento vinculado a este cliente ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {txs.slice(0, 50).map(t => (
                  <div key={t.id} className="flex items-center justify-between gap-2 text-sm border-b border-border/40 pb-1.5 last:border-0">
                    <div className="min-w-0">
                      <p className="truncate">{t.description}</p>
                      <p className="text-[10px] text-muted-foreground">{t.date.split("-").reverse().join("/")} · {catName(t.category_id)}</p>
                    </div>
                    <span className={`font-medium flex-shrink-0 ${t.direction === "in" ? "text-emerald-600" : "text-destructive"}`}>
                      {t.direction === "in" ? "+" : "−"}{fmt(Number(t.amount))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <BusinessClientsManager
          open={managerOpen}
          onOpenChange={(o) => { setManagerOpen(o); if (!o) { setEditClientId(null); fetchClients(); } }}
          companyId={companyId}
          initialEditId={editClientId}
        />
      </div>
    );
  }

  // ── Lista de clientes ──
  return (
    <div className="space-y-4">
      {!helpDismissed && (
        <Card className="border-primary/20 bg-primary/5 relative">
          <CardContent className="p-4">
            <button onClick={dismissHelp} aria-label="Fechar ajuda" className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="text-sm font-heading font-bold flex items-center gap-1.5 mb-2">
              <Info className="h-4 w-4 text-primary" />Como funcionam os Clientes
            </p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li><span className="font-semibold text-foreground">1. Cadastre seus clientes</span> com contato e aniversário.</li>
              <li><span className="font-semibold text-foreground">2. Vincule os lançamentos ao cliente</span> — na entrada (venda) e na saída (repasse a Design, Copy, Filmmaker…), escolha o cliente e a categoria/função.</li>
              <li><span className="font-semibold text-foreground">3. Abra o cliente</span> pra ver receita, repasses por função e o <span className="font-medium text-foreground">lucro líquido</span> (receita − repasses) — o mesmo cálculo da página Financeiro.</li>
            </ol>
          </CardContent>
        </Card>
      )}

      {(aniversariantes.length > 0 || inativos.length > 0) && (
        <Card className="shadow-soft">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-heading font-bold flex items-center gap-1.5"><BellRing className="h-3.5 w-3.5 text-primary" />Lembretes</p>
            {aniversariantes.length > 0 && (
              <div className="flex items-start gap-2">
                <Cake className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-foreground"><span className="font-semibold">Aniversário este mês:</span> {aniversariantes.map(c => c.name).join(", ")}</p>
              </div>
            )}
            {inativos.length > 0 && (
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-xs text-foreground">
                  <span className="font-semibold">Clientes sumidos (3+ meses):</span>
                  <div className="mt-0.5 space-y-0.5">
                    {inativos.slice(0, 6).map(({ c, meses }) => (
                      <button key={c.id} onClick={() => setOpenClientId(c.id)} className="block text-left hover:text-primary">
                        {c.name} — há {meses} {meses === 1 ? "mês" : "meses"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar cliente..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Button size="sm" className="gap-1.5 h-9" onClick={() => { setEditClientId(null); setManagerOpen(true); }}>
          <Plus className="h-3.5 w-3.5" /> Novo / Gerenciar
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Users className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">{search ? "Nenhum cliente encontrado." : "Nenhum cliente cadastrado ainda."}</p>
          {!search && <Button size="sm" className="mt-3 gap-1.5" onClick={() => { setEditClientId(null); setManagerOpen(true); }}><Plus className="h-3.5 w-3.5" />Cadastrar cliente</Button>}
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map(c => {
            const s = statsByClient[c.id] || { receita: 0, custos: 0, nLanc: 0, ultima: null };
            const lucro = s.receita - s.custos;
            const aniversarioMes = c.data_nascimento && c.data_nascimento.slice(5, 7) === mesAtual;
            return (
              <button key={c.id} onClick={() => setOpenClientId(c.id)} className="text-left">
                <Card className="shadow-soft hover:border-primary/40 transition-colors">
                  <CardContent className="p-3.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-heading font-bold truncate">{c.name}</p>
                        {(c.phone || c.email) && <p className="text-[11px] text-muted-foreground truncate">{c.phone || c.email}</p>}
                      </div>
                      {aniversarioMes && (
                        <Badge variant="outline" className="text-[9px] text-primary border-primary/30 flex items-center gap-0.5 flex-shrink-0">
                          <Cake className="h-2.5 w-2.5" />este mês
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between pt-1 border-t border-border/50">
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><TrendingUp className="h-3 w-3" />Lucro</p>
                        <p className={`text-sm font-heading font-bold ${lucro >= 0 ? "text-primary" : "text-destructive"}`}>{fmt(lucro)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground">Receita {fmt(s.receita)}</p>
                        {s.ultima && <p className="text-[10px] text-muted-foreground">última: {s.ultima.split("-").reverse().join("/")}</p>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <BusinessClientsManager open={managerOpen} onOpenChange={(o) => { setManagerOpen(o); if (!o) { setEditClientId(null); fetchClients(); } }} companyId={companyId} initialEditId={editClientId} />
    </div>
  );
}
