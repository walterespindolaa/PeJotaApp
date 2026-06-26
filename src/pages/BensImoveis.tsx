import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { gerarTabelaAmortizacao, taxaMensalDeAnual, type SistemaAmortizacao } from "@/lib/amortizacao";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import {
  Building2, Plus, Trash2, Car, Briefcase, Home, Pencil, Wallet,
  TrendingUp, BarChart3, Lightbulb, CheckCircle, StickyNote,
} from "lucide-react";

type BemImovel = {
  id: string; user_id: string; nome: string; tipo: string; valor: number;
  divida_vinculada: number; gera_renda: boolean; valor_renda: number | null;
  tipo_renda: string | null; observacao_renda: string | null;
  created_at: string; updated_at: string;
};

const TIPOS = ["Imóvel", "Veículo", "Empresa", "Outro"];
const TIPOS_RENDA = ["Aluguel", "Arrendamento", "Dividendos", "Outro"];
const ICONS: Record<string, any> = { "Imóvel": Home, "Veículo": Car, "Empresa": Briefcase, "Outro": Building2 };
// fmt is provided by usePrivacyFmt() hook inside the component

const calcYield = (rendaMensal: number, valor: number): number | null => {
  if (valor <= 0) return null;
  return Math.round(((rendaMensal * 12) / valor) * 10000) / 100;
};

const yieldColor = (y: number | null) => {
  if (y === null) return "text-muted-foreground";
  if (y > 8) return "text-success";
  if (y >= 5) return "text-warning";
  return "text-muted-foreground";
};

// ═══ BemCard component ═══
const BemCard = ({ b, BemIcon, liq, renda, yieldVal, obs, onEdit, onDelete }: {
  b: BemImovel; BemIcon: any; liq: number; renda: number; yieldVal: number | null; obs: string;
  onEdit: (b: BemImovel) => void; onDelete: (id: string) => void;
}) => {
  const { fmt } = usePrivacyFmt();
  const [expanded, setExpanded] = useState(false);
  const truncated = obs.length > 120;
  const displayObs = expanded ? obs : obs.slice(0, 120);

  return (
    <div className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors space-y-2.5">
      {/* Row 1: Icon + Name + Category + Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
            <BemIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <span className="font-semibold text-sm block truncate">{b.nome || b.tipo}</span>
            <span className="text-[11px] text-muted-foreground">{b.tipo}</span>
          </div>
        </div>
        <div className="flex gap-0.5 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Editar bem" onClick={() => onEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/60 hover:text-destructive" aria-label="Excluir bem" onClick={() => onDelete(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Row 2: Financial values */}
      <div className="flex items-center gap-4 text-xs flex-wrap pl-[52px]">
        <span className="text-muted-foreground">Valor: <span className="text-foreground font-medium">{fmt(Number(b.valor || 0))}</span></span>
        {Number(b.divida_vinculada) > 0 && (
          <span className="text-muted-foreground">Dívida: <span className="text-destructive font-medium">{fmt(Number(b.divida_vinculada))}</span></span>
        )}
        <span className="text-muted-foreground">Líquido: <span className="text-success font-medium">{fmt(liq)}</span></span>
      </div>

      {/* Row 3: Renda + Yield (conditional) */}
      {renda > 0 && (
        <div className="flex items-center gap-4 text-xs flex-wrap pl-[52px]">
          <span className="text-primary font-medium">
            {fmt(renda)}/mês{b.tipo_renda ? ` · ${b.tipo_renda}` : ""}
          </span>
          {yieldVal !== null && (
            <span className={`font-semibold ${yieldColor(yieldVal)}`}>Yield: {yieldVal.toFixed(2)}% a.a.</span>
          )}
        </div>
      )}

      {/* Row 4: Badges */}
      <div className="flex gap-1.5 flex-wrap pl-[52px]">
        {renda > 0 && <Badge variant="secondary" className="text-[10px] rounded-lg font-medium px-2 py-0.5">Gerador de renda</Badge>}
        {Number(b.divida_vinculada) > 0 && <Badge variant="outline" className="text-[10px] rounded-lg font-medium px-2 py-0.5 border-destructive/30 text-destructive">Com dívida</Badge>}
        {yieldVal !== null && yieldVal > 8 && <Badge className="text-[10px] rounded-lg font-medium px-2 py-0.5 bg-success/15 text-success border-0 hover:bg-success/20">Alto yield</Badge>}
      </div>

      {/* Row 5: Observation (conditional) */}
      {obs && (
        <div className="flex items-start gap-2 pl-[52px] pt-1 border-t border-border/30 mt-1">
          <StickyNote className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {displayObs}{truncated && !expanded && "… "}
            {truncated && (
              <button onClick={() => setExpanded(!expanded)} className="text-primary hover:underline ml-1 font-medium">
                {expanded ? "ver menos" : "ver mais"}
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

const BensImoveis = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt } = usePrivacyFmt();
  const [bens, setBens] = useState<BemImovel[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"todos" | "geradores">("todos");
  const [fin, setFin] = useState({ on: false, modo: "calc" as "manual" | "calc", sistema: "sac", taxa: "", parcela: "", total: "", atual: "", data: new Date().toISOString().split("T")[0] });
  const [pendingFin, setPendingFin] = useState<{ nome: string; parcela: number; saldo: number; total: number; atual: number; data: string } | null>(null);
  const [form, setForm] = useState({
    nome: "", tipo: "Imóvel", valor: 0, divida_vinculada: 0,
    gera_renda: false, valor_renda: 0, tipo_renda: "", observacao_renda: "",
  });

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from("investimentos_nao_financeiros").select("*").eq("user_id", user.id).limit(1000);
    setBens((data as BemImovel[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const validate = () => {
    if (!form.nome.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return false; }
    if (form.valor < 0 || form.divida_vinculada < 0 || form.valor_renda < 0) { toast({ title: "Valores não podem ser negativos", variant: "destructive" }); return false; }
    return true;
  };

  const resetForm = () => {
    setForm({ nome: "", tipo: "Imóvel", valor: 0, divida_vinculada: 0, gera_renda: false, valor_renda: 0, tipo_renda: "", observacao_renda: "" });
    setFin({ on: false, modo: "calc", sistema: "sac", taxa: "", parcela: "", total: "", atual: "", data: new Date().toISOString().split("T")[0] });
  };

  const handleSave = async () => {
    if (!user || !validate()) return;
    const payload = {
      user_id: user.id, nome: form.nome, tipo: form.tipo, valor: form.valor,
      divida_vinculada: form.divida_vinculada, gera_renda: form.gera_renda,
      valor_renda: form.valor_renda || 0,
      tipo_renda: form.tipo_renda || "",
      observacao_renda: form.observacao_renda || "",
    };
    if (editingId) {
      await supabase.from("investimentos_nao_financeiros").update(payload as any).eq("id", editingId);
      toast({ title: "Bem atualizado" });
    } else {
      await supabase.from("investimentos_nao_financeiros").insert(payload as any);
      toast({ title: "Bem adicionado" });
    }
    if (!editingId && fin.on && finParcela > 0) {
      setPendingFin({
        nome: form.nome, parcela: finParcela, saldo: Number(form.divida_vinculada) || 0,
        total: Number(fin.total) || 1, atual: Number(fin.atual) || 1, data: fin.data,
      });
    }
    resetForm();
    setEditingId(null);
    setOpen(false);
    fetchAll();
  };

  const handleEdit = (b: BemImovel) => {
    setForm({
      nome: b.nome, tipo: b.tipo, valor: Number(b.valor), divida_vinculada: Number(b.divida_vinculada || 0),
      gera_renda: b.gera_renda, valor_renda: Number(b.valor_renda || 0),
      tipo_renda: b.tipo_renda || "", observacao_renda: b.observacao_renda || "",
    });
    setEditingId(b.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("investimentos_nao_financeiros").delete().eq("id", id);
    fetchAll();
  };

  const handleDialogClose = (v: boolean) => {
    if (!v) { setEditingId(null); resetForm(); }
    setOpen(v);
  };

  // ═══ Financiamento (no formulário do bem) ═══
  const finRestantes = fin.total && fin.atual ? Math.max(Number(fin.total) - Number(fin.atual) + 1, 0) : 0;
  const finTaxaMensal = fin.taxa ? taxaMensalDeAnual(parseFloat(String(fin.taxa).replace(",", "."))) : 0;
  const finTabela = fin.on && fin.modo === "calc"
    ? gerarTabelaAmortizacao(fin.sistema as SistemaAmortizacao, Number(form.divida_vinculada) || 0, finTaxaMensal, finRestantes)
    : [];
  const finParcela = fin.modo === "manual" ? (Number(fin.parcela) || 0) : (finTabela.length ? finTabela[0].parcela : 0);

  const confirmLancarDivida = async () => {
    if (!user || !pendingFin) return;
    const p = pendingFin;
    const { error } = await supabase.from("despesas").insert({
      user_id: user.id,
      descricao: `Financiamento ${p.nome}`.trim(),
      valor: p.parcela, valor_total: p.saldo,
      total_parcelas: p.total, parcela_atual: p.atual,
      categoria: "Dívidas", tipo: "fixa", status: "a_pagar",
      is_parcelada: true, data: p.data, data_inicio_parcelas: p.data,
      tipo_parcelamento: "divida", responsavel: "Pessoa 1",
    } as any);
    if (error) toast({ title: "Erro ao lançar a parcela", description: error.message, variant: "destructive" });
    else toast({ title: "Parcela lançada nas suas despesas", description: "Aparece em Organiza → Dívidas e no total do mês." });
    setPendingFin(null);
  };

  // ═══ Computed values ═══
  const totalValor = bens.reduce((s, b) => s + Number(b.valor || 0), 0);
  const totalDivida = bens.reduce((s, b) => s + Number(b.divida_vinculada || 0), 0);
  const patrimonioLiquido = totalValor - totalDivida;
  const totalRendaMensal = bens.reduce((s, b) => s + (b.gera_renda ? Number(b.valor_renda || 0) : 0), 0);

  const yieldPonderado = useMemo(() => {
    const bensComRenda = bens.filter(b => b.gera_renda && Number(b.valor_renda || 0) > 0 && Number(b.valor || 0) > 0);
    if (bensComRenda.length === 0) return null;
    const somaValor = bensComRenda.reduce((s, b) => s + Number(b.valor), 0);
    if (somaValor <= 0) return null;
    const somaYieldPonderado = bensComRenda.reduce((s, b) => {
      const y = calcYield(Number(b.valor_renda || 0), Number(b.valor));
      return s + (y || 0) * Number(b.valor);
    }, 0);
    return Math.round((somaYieldPonderado / somaValor) * 100) / 100;
  }, [bens]);

  const bensFiltrados = useMemo(() => {
    if (filtro === "geradores") return bens.filter(b => b.gera_renda && Number(b.valor_renda || 0) > 0);
    return bens;
  }, [bens, filtro]);

  const bensComRendaZero = bens.filter(b => !b.gera_renda || Number(b.valor_renda || 0) === 0);
  const todosGeramRenda = bens.length > 0 && bensComRendaZero.length === 0;

  // Chart data for renda distribution
  const rendaChartData = useMemo(() => {
    return bens
      .filter(b => b.gera_renda && Number(b.valor_renda || 0) > 0)
      .map(b => ({
        name: b.nome || b.tipo,
        renda: Number(b.valor_renda || 0),
        yield: calcYield(Number(b.valor_renda || 0), Number(b.valor)) || 0,
      }))
      .sort((a, b) => b.renda - a.renda);
  }, [bens]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Bens e Imóveis</h1>
          <p className="text-muted-foreground text-sm mt-1">Patrimônio não financeiro valorizado.</p>
        </div>
        <Dialog open={open} onOpenChange={handleDialogClose}>
          <DialogTrigger asChild><Button className="rounded-xl gap-2"><Plus className="h-4 w-4" /> Novo Bem</Button></DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="font-heading">{editingId ? "Editar Bem" : "Adicionar Bem"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Apartamento Centro" className="rounded-xl" /></div>
              <div><Label>Categoria</Label><Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Valor de Mercado (R$)</Label><Input type="number" min={0} value={form.valor || ""} onChange={e => setForm({ ...form, valor: Math.max(0, +e.target.value) })} className="rounded-xl" /></div>
                <div><Label>Dívida Vinculada (R$)</Label><Input type="number" min={0} value={form.divida_vinculada || ""} onChange={e => setForm({ ...form, divida_vinculada: Math.max(0, +e.target.value) })} className="rounded-xl" /></div>
              </div>

              {form.divida_vinculada > 0 && (
                <div className="rounded-xl border border-border/60 p-3 space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={fin.on} onCheckedChange={v => setFin(s => ({ ...s, on: v }))} />
                    <Label className="text-sm">Acompanhar a parcela mensal deste financiamento</Label>
                  </div>
                  {fin.on && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 text-xs">
                        {([{ k: "manual" as const, label: "Já sei a parcela" }, { k: "calc" as const, label: "Calcular (SAC/Price)" }]).map(o => (
                          <button key={o.k} type="button" onClick={() => setFin(s => ({ ...s, modo: o.k }))}
                            className={`flex-1 px-3 py-1.5 rounded-md transition-colors ${fin.modo === o.k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>{o.label}</button>
                        ))}
                      </div>
                      {fin.modo === "manual" ? (
                        <div><Label className="text-xs">Valor da parcela (R$/mês)</Label><Input type="number" min={0} value={fin.parcela} onChange={e => setFin(s => ({ ...s, parcela: e.target.value }))} className="rounded-xl" placeholder="O valor do boleto" /></div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label className="text-xs">Sistema</Label><Select value={fin.sistema} onValueChange={v => setFin(s => ({ ...s, sistema: v }))}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="sac">SAC (cai com o tempo)</SelectItem><SelectItem value="price">Price (fixa)</SelectItem></SelectContent></Select></div>
                          <div><Label className="text-xs">Taxa de juros (% a.a.)</Label><Input type="text" inputMode="decimal" placeholder="Ex: 9,5" value={fin.taxa} onChange={e => setFin(s => ({ ...s, taxa: e.target.value }))} className="rounded-xl" /></div>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">Total parcelas</Label><Input type="number" min={1} value={fin.total} onChange={e => setFin(s => ({ ...s, total: e.target.value }))} className="rounded-xl" /></div>
                        <div><Label className="text-xs">Parcela atual</Label><Input type="number" min={1} value={fin.atual} onChange={e => setFin(s => ({ ...s, atual: e.target.value }))} className="rounded-xl" /></div>
                      </div>
                      <div><Label className="text-xs">Início</Label><Input type="date" value={fin.data} onChange={e => setFin(s => ({ ...s, data: e.target.value }))} className="rounded-xl w-full" /></div>
                      {finParcela > 0 && (
                        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                          Parcela: <span className="font-semibold text-foreground">{fmt(finParcela)}</span>/mês
                          {fin.modo === "calc" && fin.sistema === "sac" && finTabela.length > 1 && <> · cai até <span className="font-semibold text-foreground">{fmt(finTabela[finTabela.length - 1].parcela)}</span></>}
                          {finRestantes > 0 && <> · faltam {finRestantes}</>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="p-3 rounded-xl bg-muted/30">
                <p className="text-xs text-muted-foreground">Patrimônio Líquido</p>
                <p className="text-lg font-bold font-heading">{fmt(form.valor - form.divida_vinculada)}</p>
              </div>
              <div className="flex items-center gap-3 mt-2">
                <Switch checked={form.gera_renda} onCheckedChange={v => setForm({ ...form, gera_renda: v })} />
                <Label className="text-sm">Gera renda passiva (ex: aluguel)</Label>
              </div>
              {form.gera_renda && (
                <div className="space-y-3 pl-3 border-l-2 border-primary/20">
                  <div><Label>Renda passiva mensal (R$)</Label><Input type="number" min={0} value={form.valor_renda || ""} onChange={e => setForm({ ...form, valor_renda: Math.max(0, +e.target.value) })} className="rounded-xl" placeholder="Ex: 2.500" /></div>
                  {form.valor > 0 && form.valor_renda > 0 && (
                    <div className="p-2 rounded-lg bg-muted/30">
                      <p className="text-xs text-muted-foreground">Yield estimado</p>
                      <p className={`text-sm font-bold font-heading ${yieldColor(calcYield(form.valor_renda, form.valor))}`}>
                        {calcYield(form.valor_renda, form.valor)?.toFixed(2)}% a.a.
                      </p>
                    </div>
                  )}
                  <div><Label>Tipo de renda</Label><Select value={form.tipo_renda} onValueChange={v => setForm({ ...form, tipo_renda: v })}><SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione (opcional)" /></SelectTrigger><SelectContent>{TIPOS_RENDA.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Observação</Label><Textarea value={form.observacao_renda} onChange={e => setForm({ ...form, observacao_renda: e.target.value })} placeholder="Ex: Contrato até dez/2026" className="rounded-xl resize-none" rows={2} /></div>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <Button onClick={handleSave} className="rounded-xl flex-1">{editingId ? "Salvar Alterações" : "Adicionar"}</Button>
                {editingId && <Button variant="outline" className="rounded-xl" onClick={() => { setEditingId(null); resetForm(); }}>Cancelar</Button>}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <AlertDialog open={!!pendingFin} onOpenChange={(v) => { if (!v) setPendingFin(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Parcela do financiamento</AlertDialogTitle>
            <AlertDialogDescription>
              A parcela{pendingFin ? ` de ${fmt(pendingFin.parcela)}` : ""}/mês deste financiamento já está lançada nas suas despesas? Se ainda não, o Atlas pode lançar pra você como despesa recorrente — assim ela entra no seu orçamento mensal automaticamente (em Organiza → Dívidas).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingFin(null)}>Já lancei</AlertDialogCancel>
            <AlertDialogAction onClick={confirmLancarDivida}>Não, lançar pra mim</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══ CARDS PRINCIPAIS ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="shadow-soft rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Valor Total</p><p className="text-lg font-heading font-bold text-foreground">{fmt(totalValor)}</p></CardContent></Card>
        <Card className="shadow-soft rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Dívidas Vinculadas</p><p className="text-lg font-heading font-bold text-destructive">{fmt(totalDivida)}</p></CardContent></Card>
        <Card className="shadow-soft rounded-2xl"><CardContent className="p-4"><p className="text-xs text-muted-foreground">Patrimônio Líquido</p><p className="text-lg font-heading font-bold text-success">{fmt(patrimonioLiquido)}</p></CardContent></Card>
        <Card className="shadow-soft rounded-2xl"><CardContent className="p-4">
          <div className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5 text-primary" /><p className="text-xs text-muted-foreground">Renda Passiva (mês)</p></div>
          <p className="text-lg font-heading font-bold text-primary">{fmt(totalRendaMensal)}</p>
          <p className="text-[10px] text-muted-foreground">{fmt(totalRendaMensal * 12)}/ano</p>
        </CardContent></Card>
      </div>

      {/* ═══ INDICADORES DE RENDA PATRIMONIAL ═══ */}
      {totalRendaMensal > 0 && (
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-heading flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Indicadores de Renda Patrimonial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Renda Mensal Total</p>
                <p className="text-xl font-heading font-bold text-primary">{fmt(totalRendaMensal)}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Renda Anual Total</p>
                <p className="text-xl font-heading font-bold text-primary">{fmt(totalRendaMensal * 12)}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Yield Médio Ponderado</p>
                <p className={`text-xl font-heading font-bold ${yieldColor(yieldPonderado)}`}>
                  {yieldPonderado !== null ? `${yieldPonderado.toFixed(2)}% a.a.` : "—"}
                </p>
              </div>
            </div>

            {/* Renda Distribution Chart */}
            {rendaChartData.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Distribuição de Renda por Bem</p>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={rendaChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `R$ ${(v / 1000).toFixed(1)}k`} />
                    <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <Tooltip
                      formatter={(v: number) => fmt(v)}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                    />
                    <Bar dataKey="renda" name="Renda/mês" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ UX ESTRATÉGICA ═══ */}
      {bens.length > 0 && todosGeramRenda && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/20">
          <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
          <p className="text-sm text-success font-medium">Carteira geradora de renda ativa — todos os bens produzem renda passiva.</p>
        </div>
      )}
      {bens.length > 0 && !todosGeramRenda && bensComRendaZero.length > 0 && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
          <Lightbulb className="h-4 w-4 text-warning flex-shrink-0" />
          <p className="text-sm text-muted-foreground">
            Você possui {bensComRendaZero.length} {bensComRendaZero.length === 1 ? "bem que não gera" : "bens que não geram"} renda. Avalie estratégias de monetização.
          </p>
        </div>
      )}

      {/* ═══ LISTA DE BENS ═══ */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="font-heading text-base">Meus Bens</CardTitle>
            <Tabs value={filtro} onValueChange={(v) => setFiltro(v as "todos" | "geradores")}>
              <TabsList className="h-8">
                <TabsTrigger value="todos" className="text-xs px-3 h-6">Todos</TabsTrigger>
                <TabsTrigger value="geradores" className="text-xs px-3 h-6">Geradores de renda</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {bensFiltrados.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {filtro === "geradores" ? "Nenhum bem gera renda passiva." : "Nenhum bem cadastrado."}
            </p>
          ) : (
            <div className="space-y-3">
              {bensFiltrados.map(b => {
                const BemIcon = ICONS[b.tipo] || Building2;
                const liq = Number(b.valor || 0) - Number(b.divida_vinculada || 0);
                const renda = b.gera_renda ? Number(b.valor_renda || 0) : 0;
                const yieldVal = renda > 0 ? calcYield(renda, Number(b.valor)) : null;
                const obs = b.observacao_renda || "";
                return <BemCard key={b.id} b={b} BemIcon={BemIcon} liq={liq} renda={renda} yieldVal={yieldVal} obs={obs} onEdit={handleEdit} onDelete={handleDelete} />;
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default BensImoveis;
