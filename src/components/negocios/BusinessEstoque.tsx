import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Pencil, Trash2, Package, Boxes, AlertTriangle, ClipboardList, ShoppingCart, Info, X } from "lucide-react";
import { useBusinessInventory, type InventoryItem } from "@/hooks/useBusinessInventory";
import { MoneyInput, parseBRL } from "@/components/ui/money-input";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useToast } from "@/hooks/use-toast";

const emptyItem = { nome: "", unidade: "un", custo_unitario: "", preco_venda: "", saldo: "", estoque_minimo: "", categoria: "" };
const num = (s: string) => Number(String(s).replace(",", ".")) || 0;
const rid = () => (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `k-${Math.random().toString(36).slice(2)}`;

const UNIDADES: { v: string; label: string }[] = [
  { v: "un", label: "Unidade (un)" },
  { v: "kg", label: "Quilo (kg)" },
  { v: "g", label: "Grama (g)" },
  { v: "L", label: "Litro (L)" },
  { v: "ml", label: "Mililitro (ml)" },
  { v: "cx", label: "Caixa (cx)" },
  { v: "pct", label: "Pacote (pct)" },
  { v: "lote", label: "Lote" },
  { v: "dz", label: "Dúzia (dz)" },
  { v: "m", label: "Metro (m)" },
];

export default function BusinessEstoque({ companyId, categorias = [] }: { companyId: string; categorias?: string[] }) {
  const { items, recipes, addItem, updateItem, deleteItem, registerMovement, setRecipe, registerSale } = useBusinessInventory(companyId);

  const [helpDismissed, setHelpDismissed] = useState(() => {
    try { return localStorage.getItem("atlas-estoque-help") === "1"; } catch { return false; }
  });
  const dismissHelp = () => { try { localStorage.setItem("atlas-estoque-help", "1"); } catch { /* ignore */ } setHelpDismissed(true); };
  const { fmt } = usePrivacyFmt();
  const { toast } = useToast();

  const insumos = items.filter(i => i.tipo === "insumo");
  const produtos = items.filter(i => i.tipo === "produto");
  // Categorias sugeridas = preset do nicho ∪ categorias já usadas (permite criar novas)
  const categoriaOptions = Array.from(new Set([...categorias, ...(insumos.map(i => i.categoria).filter(Boolean) as string[])]));

  const [itemOpen, setItemOpen] = useState(false);
  const [itemTipo, setItemTipo] = useState<"insumo" | "produto">("insumo");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyItem);
  const [markup, setMarkup] = useState("");
  const [addingCat, setAddingCat] = useState(false);
  const [newCat, setNewCat] = useState("");
  // Inclui a categoria atualmente selecionada (caso seja uma custom ainda não salva)
  const selectCategorias = Array.from(new Set([...categoriaOptions, ...(form.categoria ? [form.categoria] : [])]));

  const [movItem, setMovItem] = useState<InventoryItem | null>(null);
  const [movTipo, setMovTipo] = useState<"entrada" | "saida">("entrada");
  const [movQtd, setMovQtd] = useState("");

  const [recProduto, setRecProduto] = useState<InventoryItem | null>(null);
  const [recLines, setRecLines] = useState<{ _key: string; insumo_id: string; quantidade: string }[]>([]);
  const [recPreco, setRecPreco] = useState("");
  const [recMargem, setRecMargem] = useState("");
  const [recModo, setRecModo] = useState<"completa" | "simples">("completa");
  const [recDescricao, setRecDescricao] = useState("");

  const [saleProduto, setSaleProduto] = useState<InventoryItem | null>(null);
  const [saleQtd, setSaleQtd] = useState("");

  const custoProduto = (produtoId: string) =>
    recipes.filter(r => r.produto_id === produtoId).reduce((s, r) => {
      const insumo = items.find(i => i.id === r.insumo_id);
      return s + (insumo ? Number(insumo.custo_unitario) * Number(r.quantidade) : 0);
    }, 0);

  const produzivel = (produtoId: string): number | null => {
    const lines = recipes.filter(r => r.produto_id === produtoId);
    if (lines.length === 0) return null;
    return Math.min(...lines.map(r => {
      const insumo = items.find(i => i.id === r.insumo_id);
      if (!insumo || Number(r.quantidade) <= 0) return 0;
      return Math.floor(Number(insumo.saldo) / Number(r.quantidade));
    }));
  };

  const baixoEstoque = insumos.filter(i => Number(i.saldo) <= Number(i.estoque_minimo) && Number(i.estoque_minimo) > 0);

  // ── Item (insumo/produto) ──
  const openNewItem = (tipo: "insumo" | "produto") => { setItemTipo(tipo); setEditingId(null); setForm(emptyItem); setMarkup(""); setAddingCat(false); setNewCat(""); setItemOpen(true); };
  const openEditItem = (it: InventoryItem) => {
    setItemTipo(it.tipo); setEditingId(it.id); setMarkup("");
    setForm({ nome: it.nome, unidade: it.unidade || "un", custo_unitario: String(it.custo_unitario || ""), preco_venda: String(it.preco_venda || ""), saldo: String(it.saldo || ""), estoque_minimo: String(it.estoque_minimo || ""), categoria: it.categoria || "" });
    setItemOpen(true);
  };
  const saveItem = async () => {
    if (!form.nome.trim()) { toast({ title: "Informe o nome", variant: "destructive" }); return; }
    const payload = {
      nome: form.nome.trim(), tipo: itemTipo, unidade: form.unidade || "un",
      custo_unitario: parseBRL(form.custo_unitario), preco_venda: parseBRL(form.preco_venda),
      saldo: num(form.saldo), estoque_minimo: num(form.estoque_minimo),
      categoria: itemTipo === "insumo" ? (form.categoria || null) : null,
    };
    if (editingId) await updateItem(editingId, payload);
    else await addItem(payload);
    setItemOpen(false);
    toast({ title: editingId ? "Item atualizado" : "Item adicionado" });
  };

  // ── Movimentação ──
  const openMov = (it: InventoryItem, tipo: "entrada" | "saida") => { setMovItem(it); setMovTipo(tipo); setMovQtd(""); };
  const saveMov = async () => {
    if (!movItem || num(movQtd) <= 0) { toast({ title: "Informe a quantidade", variant: "destructive" }); return; }
    await registerMovement(movItem, movTipo, num(movQtd));
    setMovItem(null);
    toast({ title: movTipo === "entrada" ? "Entrada registrada" : "Saída registrada" });
  };

  // ── Ficha técnica ──
  const openRecipe = (p: InventoryItem) => {
    setRecProduto(p);
    const lines = recipes.filter(r => r.produto_id === p.id).map(r => ({ _key: rid(), insumo_id: r.insumo_id, quantidade: String(r.quantidade) }));
    setRecLines(lines.length ? lines : [{ _key: rid(), insumo_id: "", quantidade: "" }]);
    setRecPreco(p.preco_venda ? String(p.preco_venda) : "");
    setRecMargem("");
    setRecDescricao(p.ficha_descricao || "");
    setRecModo(p.ficha_descricao && lines.length === 0 ? "simples" : "completa");
  };
  // Custo de uma linha = custo unitário do insumo × quantidade da receita
  const custoLinha = (l: { insumo_id: string; quantidade: string }) => {
    const ins = items.find(i => i.id === l.insumo_id);
    return ins ? Number(ins.custo_unitario) * num(l.quantidade) : 0;
  };
  const recCustoTotal = recLines.reduce((s, l) => s + custoLinha(l), 0);
  const recPrecoNum = num(recPreco);
  const recMargemAtual = recPrecoNum > 0 ? ((recPrecoNum - recCustoTotal) / recPrecoNum) * 100 : null;
  // Preço sugerido a partir da margem desejada (margem sobre o preço): preço = custo / (1 - margem%)
  const recPrecoSugerido = (() => {
    const m = num(recMargem);
    if (m <= 0 || m >= 100 || recCustoTotal <= 0) return null;
    return recCustoTotal / (1 - m / 100);
  })();
  const saveRecipe = async () => {
    if (!recProduto) return;
    if (recModo === "completa") {
      await setRecipe(recProduto.id, recLines.filter(l => l.insumo_id).map(l => ({ insumo_id: l.insumo_id, quantidade: num(l.quantidade) })));
      await updateItem(recProduto.id, { preco_venda: recPrecoNum, ficha_descricao: recDescricao || null });
    } else {
      // Simples: só anotação em texto livre (limpa a receita estruturada)
      await setRecipe(recProduto.id, []);
      await updateItem(recProduto.id, { preco_venda: recPrecoNum, ficha_descricao: recDescricao || null });
    }
    setRecProduto(null);
    toast({ title: "Ficha técnica salva" });
  };

  // ── Venda ──
  const saveSale = async () => {
    if (!saleProduto || num(saleQtd) <= 0) { toast({ title: "Informe a quantidade vendida", variant: "destructive" }); return; }
    await registerSale(saleProduto.id, num(saleQtd));
    setSaleProduto(null);
    toast({ title: "Venda registrada — estoque baixado" });
  };

  const precoSugerido = markup && parseBRL(form.custo_unitario) > 0 ? parseBRL(form.custo_unitario) * (1 + num(markup) / 100) : 0;

  return (
    <div className="space-y-4">
      {!helpDismissed && (
        <Card className="border-primary/20 bg-primary/5 relative">
          <CardContent className="p-4">
            <button onClick={dismissHelp} aria-label="Fechar ajuda" className="absolute top-2 right-2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
            <p className="text-sm font-heading font-bold flex items-center gap-1.5 mb-2">
              <Info className="h-4 w-4 text-primary" />Como funciona o estoque
            </p>
            <ol className="space-y-1.5 text-xs text-muted-foreground">
              <li><span className="font-semibold text-foreground">1. Cadastre os insumos (matéria-prima)</span> — o que você compra pra produzir: farinha, ovo, embalagem… com o custo e quanto tem em estoque.</li>
              <li><span className="font-semibold text-foreground">2. Cadastre os produtos</span> — o que você vende: bolo, marmita, etc.</li>
              <li><span className="font-semibold text-foreground">3. Monte a ficha técnica de cada produto</span> — quanto de cada insumo 1 unidade do produto usa (ex.: 1 bolo = 200g de farinha + 3 ovos). É a ficha técnica que liga o insumo ao produto.</li>
              <li><span className="font-semibold text-foreground">4. Registre a venda</span> — o PeJota calcula o custo, sugere o preço pela sua margem e <span className="font-medium text-foreground">baixa os insumos automaticamente</span> conforme a ficha técnica.</li>
            </ol>
            <p className="text-[11px] text-muted-foreground mt-2">Assim você sempre sabe quanto custa produzir, quantas unidades dá pra fazer com o estoque atual e a hora de repor.</p>
          </CardContent>
        </Card>
      )}

      {baixoEstoque.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
          {baixoEstoque.length} insumo(s) com estoque baixo: {baixoEstoque.map(i => i.nome).slice(0, 3).join(", ")}{baixoEstoque.length > 3 ? "…" : ""}
        </div>
      )}

      {/* ── Insumos ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-heading font-bold flex items-center gap-1.5"><Boxes className="h-4 w-4 text-primary" />Insumos (matéria-prima)</p>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => openNewItem("insumo")}><Plus className="h-3.5 w-3.5" />Novo insumo</Button>
          </div>
          {insumos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Cadastre seus insumos (ex: farinha, ovo) com custo e saldo.</p>
          ) : (
            <div className="space-y-2">
              {insumos.map(it => {
                const baixo = Number(it.saldo) <= Number(it.estoque_minimo) && Number(it.estoque_minimo) > 0;
                return (
                  <div key={it.id} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate flex items-center gap-1.5">{it.nome} {baixo && <Badge variant="outline" className="text-[9px] border-warning/40 text-warning px-1.5 py-0">baixo</Badge>}</p>
                      <p className="text-[10px] text-muted-foreground">Saldo: {Number(it.saldo)} {it.unidade} · custo {fmt(Number(it.custo_unitario))}/{it.unidade}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-600" onClick={() => openMov(it, "entrada")} aria-label="Entrada"><Plus className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => openMov(it, "saida")} aria-label="Saída"><Minus className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditItem(it)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(it.id)} aria-label="Excluir"><Trash2 className="h-3 w-3" /></Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Produtos ── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-heading font-bold flex items-center gap-1.5"><Package className="h-4 w-4 text-primary" />Produtos finais</p>
            <Button size="sm" variant="outline" className="text-xs h-7 gap-1" onClick={() => openNewItem("produto")}><Plus className="h-3.5 w-3.5" />Novo produto</Button>
          </div>
          {produtos.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Cadastre seus produtos e a ficha técnica (quais insumos cada um usa) para calcular custo e baixar estoque na venda.</p>
          ) : (
            <div className="space-y-2">
              {produtos.map(p => {
                const custo = custoProduto(p.id);
                const preco = Number(p.preco_venda);
                const margem = preco > 0 ? ((preco - custo) / preco) * 100 : null;
                const prod = produzivel(p.id);
                const nInsumos = recipes.filter(r => r.produto_id === p.id).length;
                return (
                  <div key={p.id} className="rounded-lg border border-border/50 px-3 py-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.nome}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Preço {fmt(preco)} · custo {fmt(custo)}{margem != null && <> · margem <span className={margem >= 0 ? "text-emerald-600" : "text-destructive"}>{margem.toFixed(0)}%</span></>}
                          {prod != null && <> · dá p/ {prod}</>}
                        </p>
                      </div>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" onClick={() => { setSaleProduto(p); setSaleQtd(""); }} aria-label="Registrar venda"><ShoppingCart className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditItem(p)} aria-label="Editar"><Pencil className="h-3 w-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteItem(p.id)} aria-label="Excluir"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                    {(() => {
                      const temFicha = nInsumos > 0 || !!p.ficha_descricao;
                      return (
                        <Button
                          size="sm" variant={temFicha ? "ghost" : "outline"}
                          className={`h-7 text-xs gap-1.5 w-full justify-start ${temFicha ? "text-muted-foreground" : "border-primary/40 text-primary"}`}
                          onClick={() => openRecipe(p)}
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                          {nInsumos > 0 ? `Ficha técnica · ${nInsumos} insumo${nInsumos > 1 ? "s" : ""}` : p.ficha_descricao ? "Ficha técnica · anotação" : "Montar ficha técnica"}
                        </Button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog item */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">{editingId ? "Editar" : "Novo"} {itemTipo === "insumo" ? "insumo" : "produto"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder={itemTipo === "insumo" ? "Ex: Farinha de trigo" : "Ex: Macarrão"} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Unidade</Label>
                <Select value={form.unidade} onValueChange={v => setForm(f => ({ ...f, unidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map(u => <SelectItem key={u.v} value={u.v}>{u.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Saldo atual</Label><Input type="number" min={0} value={form.saldo} onChange={e => setForm(f => ({ ...f, saldo: e.target.value }))} /></div>
            </div>
            {itemTipo === "insumo" ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Custo por unidade</Label><MoneyInput value={form.custo_unitario} onChange={v => setForm(f => ({ ...f, custo_unitario: v }))} /></div>
                  <div><Label className="text-xs">Estoque mínimo</Label><Input type="number" min={0} value={form.estoque_minimo} onChange={e => setForm(f => ({ ...f, estoque_minimo: e.target.value }))} /></div>
                </div>
                <div>
                  <Label className="text-xs">Categoria <span className="text-muted-foreground font-normal">(agrupa a lista de compras)</span></Label>
                  {addingCat ? (
                    <div className="flex gap-2">
                      <Input
                        autoFocus value={newCat}
                        onChange={e => setNewCat(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (newCat.trim()) { setForm(f => ({ ...f, categoria: newCat.trim() })); setAddingCat(false); } } }}
                        placeholder="Nome da nova categoria"
                      />
                      <Button type="button" size="sm" className="h-10 flex-shrink-0" disabled={!newCat.trim()} onClick={() => { setForm(f => ({ ...f, categoria: newCat.trim() })); setAddingCat(false); }}>OK</Button>
                      <Button type="button" variant="ghost" size="sm" className="h-10 flex-shrink-0 px-2" onClick={() => setAddingCat(false)}>Cancelar</Button>
                    </div>
                  ) : (
                    <Select
                      value={form.categoria || "none"}
                      onValueChange={v => { if (v === "__new__") { setNewCat(""); setAddingCat(true); } else setForm(f => ({ ...f, categoria: v === "none" ? "" : v })); }}
                    >
                      <SelectTrigger><SelectValue placeholder="Sem categoria" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem categoria</SelectItem>
                        {selectCategorias.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                        <SelectItem value="__new__" className="text-primary font-medium">+ Adicionar categoria</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </>
            ) : (
              <>
                <div><Label className="text-xs">Preço de venda</Label><MoneyInput value={form.preco_venda} onChange={v => setForm(f => ({ ...f, preco_venda: v }))} /></div>
                <div className="rounded-lg bg-muted/40 p-2.5 space-y-2">
                  <Label className="text-[10px] text-muted-foreground">Precificação rápida — custo do produto + margem desejada</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Custo (R$)</Label>
                      <MoneyInput value={form.custo_unitario} onChange={v => setForm(f => ({ ...f, custo_unitario: v }))} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Markup (% sobre o custo)</Label>
                      <Input type="number" min={0} value={markup} onChange={e => setMarkup(e.target.value)} placeholder="Ex: 50" />
                    </div>
                  </div>
                  {precoSugerido > 0 && (
                    <button type="button" className="text-[11px] text-primary font-medium hover:underline" onClick={() => setForm(f => ({ ...f, preco_venda: precoSugerido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }))}>
                      Preço sugerido: {fmt(precoSugerido)} — usar
                    </button>
                  )}
                </div>
              </>
            )}
            <Button onClick={saveItem} className="w-full rounded-xl">{editingId ? "Salvar" : "Adicionar"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog movimentação */}
      <Dialog open={!!movItem} onOpenChange={o => { if (!o) setMovItem(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="font-heading">{movTipo === "entrada" ? "Entrada" : "Saída"} — {movItem?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Quantidade ({movItem?.unidade})</Label><Input type="number" min={0} value={movQtd} onChange={e => setMovQtd(e.target.value)} autoFocus /></div>
            <Button onClick={saveMov} className="w-full rounded-xl">Confirmar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog ficha técnica */}
      <Dialog open={!!recProduto} onOpenChange={o => { if (!o) setRecProduto(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Ficha técnica — {recProduto?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {/* Modo: completa (estruturada) x simples (texto livre) */}
            <div className="flex gap-1 bg-muted/50 rounded-lg p-0.5 text-xs">
              {([["completa", "Completa (insumos)"], ["simples", "Simples (anotação)"]] as const).map(([k, label]) => (
                <button key={k} onClick={() => setRecModo(k)} className={`flex-1 px-3 py-1.5 rounded-md transition-colors ${recModo === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{label}</button>
              ))}
            </div>

            {recModo === "simples" ? (
              <>
                <p className="text-[11px] text-muted-foreground">Escreva a receita do seu jeito. Não calcula custo nem baixa estoque automaticamente.</p>
                <Textarea value={recDescricao} onChange={e => setRecDescricao(e.target.value)} rows={5} placeholder="Ex: 500g de farinha, 3 ovos, 1 colher de óleo. Misturar tudo, sovar por 10 min..." className="text-sm resize-y" />
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground flex-1">Preço de venda (opcional)</Label>
                  <div className="relative w-28">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                    <Input type="number" min={0} value={recPreco} onChange={e => setRecPreco(e.target.value)} placeholder="0,00" className="h-8 text-xs pl-7 text-right" />
                  </div>
                </div>
                <Button onClick={saveRecipe} className="w-full rounded-xl">Salvar ficha técnica</Button>
              </>
            ) : insumos.length === 0 ? (
              <p className="text-xs text-muted-foreground">Cadastre insumos primeiro (com o custo de cada um) — ou use o modo <button onClick={() => setRecModo("simples")} className="text-primary underline">Simples</button> pra só escrever a receita.</p>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground">Quanto de cada insumo 1 unidade deste produto usa. O custo vem do custo cadastrado em cada insumo.</p>
                <div className="flex items-center gap-2 px-0.5 text-[10px] font-medium text-muted-foreground">
                  <span className="flex-1">Insumo</span>
                  <span className="w-16 text-center">Qtd</span>
                  <span className="w-20 text-right">Custo</span>
                  <span className="w-7" />
                </div>
                {recLines.map((l, idx) => (
                  <div key={l._key} className="flex items-center gap-2">
                    <Select value={l.insumo_id} onValueChange={v => setRecLines(ls => ls.map((x, i) => i === idx ? { ...x, insumo_id: v } : x))}>
                      <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Insumo" /></SelectTrigger>
                      <SelectContent>{insumos.map(ins => <SelectItem key={ins.id} value={ins.id}>{ins.nome} ({ins.unidade}) · {fmt(Number(ins.custo_unitario))}/{ins.unidade}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" min={0} value={l.quantidade} onChange={e => setRecLines(ls => ls.map((x, i) => i === idx ? { ...x, quantidade: e.target.value } : x))} placeholder="Qtd" className="h-8 text-xs w-16 text-center" />
                    <span className="w-20 text-right text-xs font-medium">{fmt(custoLinha(l))}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive flex-shrink-0" onClick={() => setRecLines(ls => ls.filter((_, i) => i !== idx))}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => setRecLines(ls => [...ls, { _key: rid(), insumo_id: "", quantidade: "" }])}><Plus className="h-3.5 w-3.5 mr-1" />Adicionar insumo</Button>

                {/* Custo + preço + margem */}
                <div className="rounded-xl border border-border/60 p-3 space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Custo do produto</span>
                    <span className="font-heading font-bold">{fmt(recCustoTotal)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground flex-1">Preço de venda</Label>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">R$</span>
                      <Input type="number" min={0} value={recPreco} onChange={e => setRecPreco(e.target.value)} placeholder="0,00" className="h-8 text-xs pl-7 text-right" />
                    </div>
                  </div>
                  {recMargemAtual != null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Margem de lucro</span>
                      <span className={`font-semibold ${recMargemAtual >= 0 ? "text-emerald-600" : "text-destructive"}`}>{recMargemAtual.toFixed(0)}% · lucro {fmt(recPrecoNum - recCustoTotal)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1 border-t border-border/40">
                    <Label className="text-xs text-muted-foreground flex-1">Quero margem de</Label>
                    <div className="relative w-16">
                      <Input type="number" min={0} max={99} value={recMargem} onChange={e => setRecMargem(e.target.value)} placeholder="0" className="h-8 text-xs pr-5 text-right" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                    </div>
                    <Button size="sm" variant="outline" className="h-8 text-xs flex-shrink-0" disabled={!recPrecoSugerido} onClick={() => recPrecoSugerido && setRecPreco(recPrecoSugerido.toFixed(2))}>
                      {recPrecoSugerido ? `Usar ${fmt(recPrecoSugerido)}` : "Sugerir preço"}
                    </Button>
                  </div>
                </div>

                <Button onClick={saveRecipe} className="w-full rounded-xl">Salvar ficha técnica</Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog venda */}
      <Dialog open={!!saleProduto} onOpenChange={o => { if (!o) setSaleProduto(null); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader><DialogTitle className="font-heading">Registrar venda — {saleProduto?.nome}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">Quantidade vendida</Label><Input type="number" min={0} value={saleQtd} onChange={e => setSaleQtd(e.target.value)} autoFocus /></div>
            <p className="text-[10px] text-muted-foreground">Isso baixa os insumos da ficha técnica. Registre a receita da venda em Financeiro → Entrada.</p>
            <Button onClick={saveSale} className="w-full rounded-xl">Confirmar venda</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
