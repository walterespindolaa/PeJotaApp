import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Target, Plus, Trash2, Pencil, CheckCircle2, Calendar, TrendingUp, Upload, Loader2, PlusCircle, History, AlertTriangle, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { usePremissas } from "@/hooks/usePremissas";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { usePrivacyFmt } from "@/components/PrivacyValue";

type Objetivo = {
  id: string; nome: string; detalhes: string | null; valor_objetivo: number;
  valor_acumulado: number | null; aporte_mensal: number | null;
  data_objetivo: string | null; imagem_url: string | null; responsavel: string;
  frequencia: string | null;
};

type Aporte = {
  id: string; objetivo_id: string; valor: number; data: string;
  responsavel: string; observacao: string | null; created_at: string;
};

/* ─── Frequency helpers ─── */

const FREQUENCIA_OPTIONS = [
  { value: "unico", label: "Objetivo único" },
  { value: "1x_ano", label: "1× por ano" },
  { value: "2x_ano", label: "2× por ano" },
  { value: "3x_ano", label: "3× por ano" },
  { value: "4x_ano", label: "4× por ano" },
  { value: "5x_ano", label: "5× por ano" },
  { value: "1x_2anos", label: "1× a cada 2 anos" },
  { value: "1x_3anos", label: "1× a cada 3 anos" },
  { value: "1x_4anos", label: "1× a cada 4 anos" },
  { value: "1x_5anos", label: "1× a cada 5 anos" },
  { value: "1x_6anos", label: "1× a cada 6 anos" },
  { value: "1x_7anos", label: "1× a cada 7 anos" },
];

/** Returns true if the objective is recurring (annual or multi-year cycle) */
function isRecorrente(freq: string | null): boolean {
  return !!freq && freq !== "unico";
}

/** For recurring annual objectives: returns annual multiplier */
function getAnnualMultiplier(freq: string): number {
  const map: Record<string, number> = {
    "1x_ano": 1, "2x_ano": 2, "3x_ano": 3, "4x_ano": 4, "5x_ano": 5,
  };
  return map[freq] || 0;
}

/** For multi-year objectives: returns months until next cycle */
function getMultiYearMonths(freq: string): number {
  const map: Record<string, number> = {
    "1x_2anos": 24, "1x_3anos": 36, "1x_4anos": 48,
    "1x_5anos": 60, "1x_6anos": 72, "1x_7anos": 84,
  };
  return map[freq] || 0;
}

/**
 * Calculates required monthly savings.
 * TYPE A (unique / multi-year): compound interest PMT = FV × r / ((1+r)^n − 1)
 * TYPE B (annual recurring): valor × freq_per_year / 12
 */
function calcPoupancaMensal(
  valorObjetivo: number,
  freq: string | null,
  dataObjetivo: string | null,
  taxaRealMensal: number,
): number {
  const f = freq || "unico";

  // TYPE B — annual recurring
  const annualMult = getAnnualMultiplier(f);
  if (annualMult > 0) {
    return (valorObjetivo * annualMult) / 12;
  }

  // TYPE A — unique or multi-year cycle
  let n: number;
  const multiYearMonths = getMultiYearMonths(f);
  if (multiYearMonths > 0) {
    n = multiYearMonths;
  } else if (dataObjetivo) {
    const target = new Date(dataObjetivo + "T12:00:00");
    const now = new Date();
    n = Math.max(1, Math.round((target.getTime() - now.getTime()) / (30.4375 * 24 * 60 * 60 * 1000)));
  } else {
    return 0; // no deadline
  }

  const r = taxaRealMensal;
  if (r <= 0 || n <= 0) return valorObjetivo / Math.max(n, 1);

  // PMT = FV × r / ((1+r)^n − 1)
  const factor = Math.pow(1 + r, n);
  return (valorObjetivo * r) / (factor - 1);
}

/* ─── Component ─── */

const Objetivos = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt, pct } = usePrivacyFmt();
  const premissas = usePremissas();

  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nomePessoa1, setNomePessoa1] = useState("Pessoa 1");
  const [nomePessoa2, setNomePessoa2] = useState("Pessoa 2");
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    nome: "", detalhes: "", valor_objetivo: "", valor_acumulado: "",
    aporte_mensal: "", data_objetivo: "", imagem_url: "", responsavel: "Pessoa 1",
    frequencia: "unico",
  });

  // Aportes
  const [aporteDialogId, setAporteDialogId] = useState<string | null>(null);
  const [aporteForm, setAporteForm] = useState({ valor: "", data: new Date().toISOString().split("T")[0], responsavel: "Pessoa 1", observacao: "" });
  const [aportes, setAportes] = useState<Record<string, Aporte[]>>({});
  const [historyId, setHistoryId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const [objRes, profRes, aportesRes] = await Promise.all([
      supabase.from("objetivos").select("*").eq("user_id", user.id).order("created_at"),
      supabase.from("profiles").select("nome_pessoa1,nome_pessoa2").eq("user_id", user.id).maybeSingle(),
      supabase.from("aportes_objetivos").select("*").eq("user_id", user.id).order("data", { ascending: true }),
    ]);
    setObjetivos((objRes.data as Objetivo[]) || []);
    if (profRes.data) {
      setNomePessoa1((profRes.data as any).nome_pessoa1 || "Pessoa 1");
      setNomePessoa2((profRes.data as any).nome_pessoa2 || "Pessoa 2");
    }
    const grouped: Record<string, Aporte[]> = {};
    ((aportesRes.data as Aporte[]) || []).forEach(a => {
      if (!grouped[a.objetivo_id]) grouped[a.objetivo_id] = [];
      grouped[a.objetivo_id].push(a);
    });
    setAportes(grouped);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => {
    setForm({ nome: "", detalhes: "", valor_objetivo: "", valor_acumulado: "", aporte_mensal: "", data_objetivo: "", imagem_url: "", responsavel: "Pessoa 1", frequencia: "unico" });
    setEditingId(null);
  };

  const handleUploadImage = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/objetivo_${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(filePath);
      setForm(f => ({ ...f, imagem_url: urlData.publicUrl }));
      toast({ title: "Imagem carregada ✓" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!user || !form.nome || !form.valor_objetivo) return;
    const payload = {
      nome: form.nome, detalhes: form.detalhes || null,
      valor_objetivo: Number(form.valor_objetivo),
      valor_acumulado: form.valor_acumulado ? Number(form.valor_acumulado) : 0,
      aporte_mensal: form.aporte_mensal ? Number(form.aporte_mensal) : null,
      data_objetivo: form.data_objetivo || null,
      imagem_url: form.imagem_url || null,
      responsavel: form.responsavel,
      frequencia: form.frequencia || "unico",
    };

    if (editingId) {
      const { error } = await supabase.from("objetivos").update(payload as any).eq("id", editingId);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      const { error } = await supabase.from("objetivos").insert({ ...payload, user_id: user.id } as any);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
    resetForm();
    setOpen(false);
    fetchAll();
  };

  const handleEdit = (o: Objetivo) => {
    setEditingId(o.id);
    setForm({
      nome: o.nome, detalhes: o.detalhes || "", valor_objetivo: String(o.valor_objetivo),
      valor_acumulado: String(o.valor_acumulado || 0), aporte_mensal: String(o.aporte_mensal || ""),
      data_objetivo: o.data_objetivo || "", imagem_url: o.imagem_url || "", responsavel: o.responsavel,
      frequencia: o.frequencia || "unico",
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("objetivos").delete().eq("id", id);
    fetchAll();
  };

  const handleAporte = async () => {
    if (!user || !aporteDialogId || !aporteForm.valor) return;
    const valor = Number(aporteForm.valor);
    const { error } = await supabase.from("aportes_objetivos").insert({
      user_id: user.id, objetivo_id: aporteDialogId, valor,
      data: aporteForm.data, responsavel: aporteForm.responsavel,
      observacao: aporteForm.observacao || null,
    } as any);
    if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }

    const obj = objetivos.find(o => o.id === aporteDialogId);
    if (obj) {
      await supabase.from("objetivos").update({ valor_acumulado: (obj.valor_acumulado || 0) + valor } as any).eq("id", aporteDialogId);
    }
    setAporteDialogId(null);
    setAporteForm({ valor: "", data: new Date().toISOString().split("T")[0], responsavel: "Pessoa 1", observacao: "" });
    toast({ title: "Aporte registrado ✓" });
    fetchAll();
  };

  // ── Computed values using compound interest ──
  const objetivosComCalculo = useMemo(() => {
    return objetivos.map(o => {
      const poupanca = calcPoupancaMensal(
        o.valor_objetivo,
        o.frequencia,
        o.data_objetivo,
        premissas.taxaRealMensal,
      );
      const tipo = isRecorrente(o.frequencia) && getAnnualMultiplier(o.frequencia || "") > 0
        ? "recorrente_anual"
        : isRecorrente(o.frequencia)
          ? "unico_ciclo"
          : "unico";
      return { ...o, poupancaCalculada: poupanca, tipo };
    });
  }, [objetivos, premissas.taxaRealMensal]);

  const totalMensalNecessario = useMemo(() =>
    objetivosComCalculo.reduce((s, o) => s + o.poupancaCalculada, 0),
    [objetivosComCalculo]);

  const totalMeta = objetivos.reduce((s, o) => s + Number(o.valor_objetivo), 0);
  const totalAcumulado = objetivos.reduce((s, o) => s + Number(o.valor_acumulado || 0), 0);

  if (loading || premissas.loading) {
    return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" /> Metas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Defina metas financeiras com cálculo de juros compostos.</p>
        </div>
        <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 rounded-xl"><Plus className="h-4 w-4" /> Novo Objetivo</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editingId ? "Editar Objetivo" : "Novo Objetivo"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Nome do objetivo" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} className="rounded-xl" />
              <Input placeholder="Detalhes (opcional)" value={form.detalhes} onChange={e => setForm(f => ({ ...f, detalhes: e.target.value }))} className="rounded-xl" />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Valor da meta (R$)</label>
                  <Input type="number" value={form.valor_objetivo} onChange={e => setForm(f => ({ ...f, valor_objetivo: e.target.value }))} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Já acumulado (R$)</label>
                  <Input type="number" value={form.valor_acumulado} onChange={e => setForm(f => ({ ...f, valor_acumulado: e.target.value }))} className="rounded-xl" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Frequência</label>
                <Select value={form.frequencia} onValueChange={v => setForm(f => ({ ...f, frequencia: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIA_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {(form.frequencia === "unico" || getMultiYearMonths(form.frequencia) > 0) && (
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    {form.frequencia === "unico" ? "Data alvo" : "Data alvo (opcional, senão usa ciclo)"}
                  </label>
                  <Input type="date" value={form.data_objetivo} onChange={e => setForm(f => ({ ...f, data_objetivo: e.target.value }))} className="rounded-xl" />
                </div>
              )}
              {/* Image upload */}
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Imagem do objetivo</label>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => fileRef.current?.click()} disabled={uploading}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {form.imagem_url ? "Trocar imagem" : "Upload de imagem"}
                  </Button>
                  {form.imagem_url && <img src={form.imagem_url} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadImage(f); e.target.value = ""; }} />
              </div>
              <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={handleSubmit} className="w-full rounded-xl">{editingId ? "Atualizar" : "Criar Objetivo"}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ══════ PREMISSAS ECONÔMICAS ══════ */}
      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <h3 className="font-heading font-bold text-sm">Premissas Econômicas</h3>
          <p className="text-xs text-muted-foreground">
            As premissas são compartilhadas com o módulo de Aposentadoria. Para alterar, acesse o módulo de Aposentadoria.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Taxa nominal a.a.</p>
              <p className="text-sm font-heading font-bold">{pct(premissas.taxaNominal)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Inflação a.a.</p>
              <p className="text-sm font-heading font-bold">{pct(premissas.inflacao)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Taxa real anual</p>
              <p className="text-sm font-heading font-bold">{pct(premissas.taxaRealAnual * 100)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-xs text-muted-foreground">Taxa real mensal</p>
              <p className="text-sm font-heading font-bold">{pct(premissas.taxaRealMensal * 100)}</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-muted/20 border border-border">
            <AlertTriangle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Objetivos únicos e multi-anuais usam juros compostos (PMT = FV × r / ((1+r)^n − 1)). Objetivos recorrentes anuais dividem o valor anual por 12.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ══════ RESUMO MENSAL ══════ */}
      <Card className="shadow-soft rounded-2xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <DollarSign className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Seus objetivos de vida exigem</p>
              <p className="text-2xl font-heading font-bold">{fmt(totalMensalNecessario)} <span className="text-sm font-normal text-muted-foreground">/ mês</span></p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="shadow-soft rounded-2xl border-border/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Objetivos ativos</p>
            <p className="text-2xl font-heading font-bold">{objetivos.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl border-border/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total acumulado</p>
            <p className="text-lg font-heading font-bold text-success">{fmt(totalAcumulado)}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft rounded-2xl border-border/40">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total das metas</p>
            <p className="text-lg font-heading font-bold text-info">{fmt(totalMeta)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Objectives grid */}
      {objetivosComCalculo.length === 0 ? (
        <Card className="shadow-soft rounded-2xl border-border/40">
          <CardContent className="p-8 text-center">
            <Target className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum objetivo criado ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">Clique em "Novo Objetivo" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {objetivosComCalculo.map(o => {
            const pctVal = o.valor_objetivo > 0 ? Math.min(((o.valor_acumulado || 0) / o.valor_objetivo) * 100, 100) : 0;
            const concluido = pctVal >= 100;
            const objAportes = aportes[o.id] || [];
            const freqLabel = FREQUENCIA_OPTIONS.find(f => f.value === (o.frequencia || "unico"))?.label || "Único";

            const chartData = objAportes.reduce((acc: { date: string; acumulado: number }[], a) => {
              const prev = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
              acc.push({ date: new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric" }), acumulado: prev + Number(a.valor) });
              return acc;
            }, []);

            return (
              <Card key={o.id} className={`shadow-soft overflow-hidden rounded-2xl border-border/40 ${concluido ? "ring-2 ring-success/20" : ""}`}>
                {o.imagem_url && (
                  <div className="h-32 w-full overflow-hidden">
                    <img src={o.imagem_url} alt={o.nome} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-heading font-bold text-base">{o.nome}</h3>
                      {o.detalhes && <p className="text-xs text-muted-foreground mt-0.5">{o.detalhes}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`rounded-lg ${concluido ? "bg-success/10 text-success border-success/20" : "bg-info/10 text-info border-info/20"}`}>
                        {concluido ? <><CheckCircle2 className="h-3 w-3 mr-1" /> Concluído</> : `${pctVal.toFixed(0)}%`}
                      </Badge>
                      <Badge variant="outline" className="rounded-lg text-[10px]">
                        {o.tipo === "recorrente_anual" ? "Recorrente" : "Único"}
                      </Badge>
                    </div>
                  </div>

                  <Progress value={pctVal} className="h-2.5 rounded-full" />

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Acumulado</span>
                      <p className="font-heading font-bold text-success">{fmt(o.valor_acumulado || 0)}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Meta</span>
                      <p className="font-heading font-bold">{fmt(o.valor_objetivo)}</p>
                    </div>
                  </div>

                  {/* Calculated monthly savings */}
                  <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/10">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Poupança mensal necessária</span>
                      <span className="text-sm font-heading font-bold text-primary">{fmt(o.poupancaCalculada)}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {o.tipo === "recorrente_anual"
                        ? `Cálculo: ${fmt(o.valor_objetivo)} × ${getAnnualMultiplier(o.frequencia || "")}/ano ÷ 12`
                        : `Juros compostos · Taxa real mensal: ${(premissas.taxaRealMensal * 100).toFixed(2)}%`
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> {freqLabel}</span>
                    {o.data_objetivo && (
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {new Date(o.data_objetivo + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                    )}
                    <span>{getLabel(o.responsavel)}</span>
                  </div>

                  {/* Mini chart */}
                  {chartData.length > 1 && historyId === o.id && (
                    <div className="h-24 mt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                          <YAxis hide />
                          <Tooltip formatter={(v: number) => fmt(v)} />
                          <Line type="monotone" dataKey="acumulado" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1 flex-wrap">
                    {!concluido && (
                      <Button size="sm" variant="default" className="gap-1 rounded-xl flex-1" onClick={() => { setAporteDialogId(o.id); setAporteForm(f => ({ ...f, responsavel: o.responsavel })); }}>
                        <PlusCircle className="h-3 w-3" /> Aportar
                      </Button>
                    )}
                    {objAportes.length > 0 && (
                      <Button size="sm" variant="outline" className="gap-1 rounded-xl" onClick={() => setHistoryId(historyId === o.id ? null : o.id)}>
                        <History className="h-3 w-3" /> {historyId === o.id ? "Ocultar" : "Histórico"}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 rounded-xl" onClick={() => handleEdit(o)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive gap-1 rounded-xl" onClick={() => handleDelete(o.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>

                  {/* History list */}
                  {historyId === o.id && objAportes.length > 0 && (
                    <div className="space-y-1 pt-1 border-t border-border/40">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Histórico de aportes</p>
                      {objAportes.map(a => (
                        <div key={a.id} className="flex justify-between text-xs py-1">
                          <span className="text-muted-foreground">{new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          <span className="font-medium text-success">+{fmt(a.valor)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Aporte Dialog */}
      <Dialog open={!!aporteDialogId} onOpenChange={v => { if (!v) setAporteDialogId(null); }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader><DialogTitle>Registrar Aporte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Valor (R$)</label>
              <Input type="number" value={aporteForm.valor} onChange={e => setAporteForm(f => ({ ...f, valor: e.target.value }))} className="rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Data</label>
              <Input type="date" value={aporteForm.data} onChange={e => setAporteForm(f => ({ ...f, data: e.target.value }))} className="rounded-xl" />
            </div>
            <Select value={aporteForm.responsavel} onValueChange={v => setAporteForm(f => ({ ...f, responsavel: v }))}>
              <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Observação (opcional)" value={aporteForm.observacao} onChange={e => setAporteForm(f => ({ ...f, observacao: e.target.value }))} className="rounded-xl" />
            <Button onClick={handleAporte} className="w-full rounded-xl">Confirmar Aporte</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Objetivos;
