import { useState, useEffect, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Heart, Plus, Trash2, Pencil, CheckCircle2, Calendar, TrendingUp,
  PlusCircle, History, DollarSign, Clock, Sparkles, Info,
  Plane, Globe, Car, Home, GraduationCap, Baby, Shield, Palmtree,
  Stethoscope, CarFront, RefreshCw, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useHouseholdLabels } from "@/hooks/useHouseholdLabels";
import { usePremissas } from "@/hooks/usePremissas";
import { LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer } from "recharts";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { LucideIcon } from "lucide-react";

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

/* ── Objective Types with fixed icon mapping ── */
const OBJECTIVE_TYPES = [
  { value: "viagem_nacional", icon: Plane, label: "Viagem nacional" },
  { value: "viagem_internacional", icon: Globe, label: "Viagem internacional" },
  { value: "troca_carro", icon: CarFront, label: "Troca de carro" },
  { value: "compra_carro", icon: Car, label: "Compra de carro" },
  { value: "compra_imovel", icon: Home, label: "Compra de imóvel" },
  { value: "casamento", icon: Heart, label: "Festa de casamento" },
  { value: "ter_filho", icon: Baby, label: "Ter um filho" },
  { value: "faculdade", icon: GraduationCap, label: "Faculdade" },
  { value: "intercambio", icon: Globe, label: "Intercâmbio" },
  { value: "residencia_medica", icon: Stethoscope, label: "Residência médica" },
  { value: "sabatico", icon: Palmtree, label: "Período sabático" },
  { value: "outro", icon: Sparkles, label: "Outros" },
] as const;

type ObjectiveTypeValue = typeof OBJECTIVE_TYPES[number]["value"];

function getTypeConfig(typeVal: string) {
  return OBJECTIVE_TYPES.find(t => t.value === typeVal) || OBJECTIVE_TYPES[OBJECTIVE_TYPES.length - 1];
}

/** Guess type from legacy free-text nome */
function guessTypeFromNome(nome: string): ObjectiveTypeValue {
  const n = nome.toLowerCase();
  if (n.includes("viagem") || n.includes("trip")) return n.includes("inter") ? "viagem_internacional" : "viagem_nacional";
  if (n.includes("troca") && n.includes("carro")) return "troca_carro";
  if (n.includes("carro") || n.includes("veículo") || n.includes("moto")) return "compra_carro";
  if (n.includes("imóvel") || n.includes("casa") || n.includes("apart")) return "compra_imovel";
  if (n.includes("casamento") || n.includes("noivado")) return "casamento";
  if (n.includes("filho") || n.includes("bebê") || n.includes("bebe") || n.includes("nascimento")) return "ter_filho";
  if (n.includes("faculdade") || n.includes("curso") || n.includes("mba")) return "faculdade";
  if (n.includes("intercâmbio") || n.includes("intercambio")) return "intercambio";
  if (n.includes("residência") || n.includes("residencia")) return "residencia_medica";
  if (n.includes("sabático") || n.includes("sabatico")) return "sabatico";
  return "outro";
}

function ObjectiveIcon({ typeValue, size = 36 }: { typeValue: string; size?: number }) {
  const cfg = getTypeConfig(typeValue);
  const Icon = cfg.icon;
  return (
    <div className="flex items-center justify-center rounded-full bg-primary/10 shrink-0" style={{ width: size + 24, height: size + 24 }}>
      <Icon className="text-primary" style={{ width: size, height: size }} strokeWidth={1.5} />
    </div>
  );
}

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

function getAnnualMultiplier(freq: string): number {
  const map: Record<string, number> = { "1x_ano": 1, "2x_ano": 2, "3x_ano": 3, "4x_ano": 4, "5x_ano": 5 };
  return map[freq] || 0;
}

function getMultiYearMonths(freq: string): number {
  const map: Record<string, number> = { "1x_2anos": 24, "1x_3anos": 36, "1x_4anos": 48, "1x_5anos": 60, "1x_6anos": 72, "1x_7anos": 84 };
  return map[freq] || 0;
}

function getMonthsFromNow(dataObjetivo: string | null): number {
  if (!dataObjetivo) return 0;
  const target = new Date(dataObjetivo + "T12:00:00");
  return Math.max(1, Math.round((target.getTime() - Date.now()) / (30.4375 * 24 * 60 * 60 * 1000)));
}

function calcPMT(fv: number, r: number, n: number): number {
  if (n <= 0) return 0;
  if (r <= 0) return fv / Math.max(n, 1);
  const factor = Math.pow(1 + r, n);
  return (fv * r) / (factor - 1);
}

function calcPoupancaMensal(valor: number, freq: string | null, dataObjetivo: string | null, taxaRealMensal: number): number {
  const f = freq || "unico";
  const annualMult = getAnnualMultiplier(f);
  if (annualMult > 0) return (valor * annualMult) / 12;
  const multiMonths = getMultiYearMonths(f);
  const n = multiMonths > 0 ? multiMonths : getMonthsFromNow(dataObjetivo);
  return calcPMT(valor, taxaRealMensal, n);
}

function calcPoupancaDelayed(valor: number, freq: string | null, dataObjetivo: string | null, taxaRealMensal: number, delayMonths: number): number {
  const f = freq || "unico";
  const annualMult = getAnnualMultiplier(f);
  if (annualMult > 0) return (valor * annualMult) / 12;
  const multiMonths = getMultiYearMonths(f);
  const nOriginal = multiMonths > 0 ? multiMonths : getMonthsFromNow(dataObjetivo);
  const n = Math.max(1, nOriginal - delayMonths);
  return calcPMT(valor, taxaRealMensal, n);
}

/** Derive a display name for the objective */
function getDisplayName(nome: string, typeValue: string): string {
  const cfg = getTypeConfig(typeValue);
  if (typeValue === "outro") return nome || cfg.label;
  return cfg.label;
}

const ObjetivosDeVida = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt } = usePrivacyFmt();
  const premissas = usePremissas();

  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [viewFilter, setViewFilter] = useState<"all" | "Pessoa 1" | "Pessoa 2">(() => {
    const saved = localStorage.getItem("objetivos_view_filter");
    if (saved === "Pessoa 1" || saved === "Pessoa 2" || saved === "all") return saved;
    return "all";
  });
  useEffect(() => {
    localStorage.setItem("objetivos_view_filter", viewFilter);
  }, [viewFilter]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [nomePessoa1, setNomePessoa1] = useState("Pessoa 1");
  const [nomePessoa2, setNomePessoa2] = useState("Pessoa 2");
  const { responsavelOptions, getLabel } = useHouseholdLabels(nomePessoa1, nomePessoa2);
  const hasPessoa2 = !!(nomePessoa2 && nomePessoa2.trim() && nomePessoa2.trim() !== "Pessoa 2");

  const [form, setForm] = useState({
    tipo: "viagem_nacional" as ObjectiveTypeValue,
    nome_custom: "",
    descricao: "",
    valor_objetivo: "",
    valor_acumulado: "",
    data_objetivo: "",
    data_inicio: new Date().toISOString().split("T")[0],
    responsavel: "Pessoa 1",
    frequencia: "unico",
    aporte_automatico: false,
    aporte_custom: false,
    valor_aporte_auto: "",
  });

  // Calculated suggestion for auto-aporte based on form inputs
  const sugestaoAporte = useMemo(() => {
    if (!form.valor_objetivo) return 0;
    return calcPoupancaMensal(
      Number(form.valor_objetivo),
      form.frequencia,
      form.data_objetivo || null,
      premissas.taxaRealMensal,
    );
  }, [form.valor_objetivo, form.frequencia, form.data_objetivo, premissas.taxaRealMensal]);

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
    setForm({
      tipo: "viagem_nacional", nome_custom: "", descricao: "", valor_objetivo: "",
      valor_acumulado: "", data_objetivo: "", data_inicio: new Date().toISOString().split("T")[0],
      responsavel: "Pessoa 1", frequencia: "unico", aporte_automatico: false, aporte_custom: false, valor_aporte_auto: "",
    });
    setEditingId(null);
  };

  const handleSubmit = async () => {
    if (!user || !form.valor_objetivo) return;
    const typeCfg = getTypeConfig(form.tipo);
    const nome = form.tipo === "outro" ? (form.nome_custom || "Objetivo personalizado") : typeCfg.label;

    const aporteValue = form.aporte_automatico
      ? (form.aporte_custom && form.valor_aporte_auto ? Number(form.valor_aporte_auto) : sugestaoAporte)
      : null;

    const payload = {
      nome,
      detalhes: form.descricao || null,
      valor_objetivo: Number(form.valor_objetivo),
      valor_acumulado: form.valor_acumulado ? Number(form.valor_acumulado) : 0,
      aporte_mensal: aporteValue && aporteValue > 0 ? aporteValue : null,
      data_objetivo: form.data_objetivo || null,
      imagem_url: form.data_inicio || null,
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
    const typeGuess = guessTypeFromNome(o.nome);
    setEditingId(o.id);
    setForm({
      tipo: typeGuess,
      nome_custom: typeGuess === "outro" ? o.nome : "",
      descricao: o.detalhes || "",
      valor_objetivo: String(o.valor_objetivo),
      valor_acumulado: String(o.valor_acumulado || 0),
      data_objetivo: o.data_objetivo || "",
      data_inicio: o.imagem_url && !o.imagem_url.startsWith("http") ? o.imagem_url : new Date().toISOString().split("T")[0],
      responsavel: o.responsavel,
      frequencia: o.frequencia || "unico",
      aporte_automatico: !!o.aporte_mensal && o.aporte_mensal > 0,
      aporte_custom: !!o.aporte_mensal && o.aporte_mensal > 0,
      valor_aporte_auto: o.aporte_mensal ? String(o.aporte_mensal) : "",
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

  const objetivosFiltrados = useMemo(() => {
    if (viewFilter === "all" || !hasPessoa2) return objetivos;
    return objetivos.filter(o =>
      o.responsavel === viewFilter || o.responsavel === "Compartilhado"
    );
  }, [objetivos, viewFilter, hasPessoa2]);

  const objetivosComCalculo = useMemo(() => {
    return objetivosFiltrados.map(o => {
      const typeValue = guessTypeFromNome(o.nome);
      const poupanca = calcPoupancaMensal(o.valor_objetivo, o.frequencia, o.data_objetivo, premissas.taxaRealMensal);
      const poupancaDelayed = calcPoupancaDelayed(o.valor_objetivo, o.frequencia, o.data_objetivo, premissas.taxaRealMensal, 12);
      const isRec = getAnnualMultiplier(o.frequencia || "") > 0;
      const dataInicio = o.imagem_url && !o.imagem_url.startsWith("http") ? o.imagem_url : null;
      return { ...o, typeValue, poupancaCalculada: poupanca, poupancaDelayed, isRecorrente: isRec, dataInicio };
    });
  }, [objetivosFiltrados, premissas.taxaRealMensal]);

  const totalMensalNecessario = useMemo(() =>
    objetivosComCalculo.reduce((s, o) => s + o.poupancaCalculada, 0),
    [objetivosComCalculo]);

  if (loading || premissas.loading) {
    return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-10 animate-fade-in">
      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <h1 className="text-3xl font-heading font-bold flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10">
              <Heart className="h-7 w-7 text-primary" strokeWidth={1.5} />
            </div>
            Objetivos de Vida
          </h1>
          <p className="text-muted-foreground text-[15px] leading-relaxed">
            Neste espaço você pode registrar seus sonhos e planos para o futuro.
            Liste seus objetivos financeiros de curto, médio e longo prazo — como viagens, carro, imóvel, faculdade e outros projetos importantes.
            O PeJota calcula automaticamente quanto você precisa guardar por mês para transformar esses planos em realidade.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {hasPessoa2 && (
          <div className="inline-flex rounded-xl border border-border bg-card p-1 text-xs">
            {[
              { key: "Pessoa 1" as const, label: nomePessoa1 },
              { key: "Pessoa 2" as const, label: nomePessoa2 },
              { key: "all" as const, label: "Ambos" },
            ].map(opt => (
              <button
                key={opt.key}
                onClick={() => setViewFilter(opt.key)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  viewFilter === opt.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          )}
          <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="lg" className="gap-2.5 rounded-xl shrink-0 shadow-sm px-6">
                <Plus className="h-5 w-5" /> Adicionar objetivo
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 text-lg">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Sparkles className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                {editingId ? "Editar Objetivo" : "Novo Objetivo de Vida"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5 pt-2">
              {/* Type selector */}
              <div>
                <label className="text-xs font-semibold text-foreground mb-2.5 block">O que você quer conquistar?</label>
                <div className="grid grid-cols-2 gap-2">
                  {OBJECTIVE_TYPES.map(t => {
                    const Icon = t.icon;
                    const selected = form.tipo === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, tipo: t.value }))}
                        className={`flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all text-sm ${
                          selected
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                            : "border-border hover:border-primary/30 hover:bg-muted/30 text-muted-foreground"
                        }`}
                      >
                        <div className={`flex items-center justify-center rounded-full shrink-0 ${selected ? "bg-primary/15" : "bg-muted/50"}`} style={{ width: 36, height: 36 }}>
                          <Icon className={selected ? "text-primary" : "text-muted-foreground"} style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                        </div>
                        <span className={selected ? "font-medium" : ""}>{t.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom name for "Outros" */}
              {form.tipo === "outro" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nome do objetivo</label>
                  <Input placeholder="Ex: Abrir clínica, Ano sabático na Europa..." value={form.nome_custom} onChange={e => setForm(f => ({ ...f, nome_custom: e.target.value }))} className="rounded-xl" />
                </div>
              )}

              {/* Description */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Descrição (opcional)</label>
                <Textarea placeholder="Detalhe seu sonho... Ex: Viagem para Europa com a família em 2028" value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} className="rounded-xl min-h-[70px]" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quanto custa? (R$)</label>
                  <Input type="number" value={form.valor_objetivo} onChange={e => setForm(f => ({ ...f, valor_objetivo: e.target.value }))} className="rounded-xl" />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Já guardou? (R$)</label>
                  <Input type="number" value={form.valor_acumulado} onChange={e => setForm(f => ({ ...f, valor_acumulado: e.target.value }))} className="rounded-xl" placeholder="0" />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Frequência</label>
                <Select value={form.frequencia} onValueChange={v => setForm(f => ({ ...f, frequencia: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIA_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(form.frequencia === "unico" || getMultiYearMonths(form.frequencia) > 0) && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Quando quer realizar?</label>
                  <Input type="date" value={form.data_objetivo} onChange={e => setForm(f => ({ ...f, data_objetivo: e.target.value }))} className="rounded-xl" />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Data de início / registro</label>
                <Input type="date" value={form.data_inicio} onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} className="rounded-xl" />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Referente a</label>
                <Select value={form.responsavel} onValueChange={v => setForm(f => ({ ...f, responsavel: v }))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{responsavelOptions.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* Auto-aporte toggle */}
              <div className="rounded-xl border border-border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <RefreshCw className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                    <span className="text-sm font-medium">Aporte automático mensal</span>
                  </div>
                  <Switch checked={form.aporte_automatico} onCheckedChange={v => setForm(f => ({ ...f, aporte_automatico: v, aporte_custom: false }))} />
                </div>
                {form.aporte_automatico && (
                  <div className="space-y-3">
                    {/* PeJota suggestion */}
                    <div className="rounded-lg bg-primary/5 border border-primary/15 p-3.5 flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Sparkles className="h-4 w-4 text-primary" strokeWidth={1.5} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground">Sugestão do PeJota</p>
                        <p className="text-lg font-heading font-bold text-primary">
                          {fmt(sugestaoAporte)}<span className="text-xs font-normal text-muted-foreground ml-1">/ mês</span>
                        </p>
                      </div>
                    </div>

                    {/* Toggle: use suggested or custom */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, aporte_custom: false }))}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left text-sm transition-all ${
                          !form.aporte_custom
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                            : "border-border hover:border-primary/20 text-muted-foreground"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!form.aporte_custom ? "border-primary" : "border-muted-foreground/40"}`}>
                          {!form.aporte_custom && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        Usar valor sugerido pelo PeJota
                      </button>
                      <button
                        type="button"
                        onClick={() => setForm(f => ({ ...f, aporte_custom: true }))}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border text-left text-sm transition-all ${
                          form.aporte_custom
                            ? "border-primary bg-primary/5 text-foreground ring-1 ring-primary/30"
                            : "border-border hover:border-primary/20 text-muted-foreground"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${form.aporte_custom ? "border-primary" : "border-muted-foreground/40"}`}>
                          {form.aporte_custom && <div className="w-2 h-2 rounded-full bg-primary" />}
                        </div>
                        Definir meu próprio aporte mensal
                      </button>
                    </div>

                    {form.aporte_custom && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Valor personalizado (R$)</label>
                        <Input type="number" value={form.valor_aporte_auto} onChange={e => setForm(f => ({ ...f, valor_aporte_auto: e.target.value }))} className="rounded-xl" placeholder="500" />
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
                <Info className="h-3 w-3 flex-shrink-0" />
                <span>Cálculo baseado nas premissas econômicas do seu planejamento.</span>
              </div>

              <Button onClick={handleSubmit} size="lg" className="w-full rounded-xl">
                {editingId ? "Atualizar" : "Criar Objetivo"}
              </Button>
            </div>
          </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── Premissas Econômicas ── */}
      <Card className="shadow-card rounded-2xl">
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="p-2 rounded-xl bg-muted/50">
              <BarChart3 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </div>
            <h3 className="text-sm font-heading font-semibold text-foreground/80">Premissas Econômicas</h3>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[240px] text-xs">
                  Valores herdados do módulo de Aposentadoria. Para alterar, acesse Metas → Premissas Econômicas.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-[11px] text-muted-foreground">Taxa nominal anual</p>
              <p className="text-sm font-heading font-bold">{(premissas.taxaNominal).toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-[11px] text-muted-foreground">Inflação esperada</p>
              <p className="text-sm font-heading font-bold">{(premissas.inflacao).toFixed(1)}%</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-[11px] text-muted-foreground">Taxa real anual</p>
              <p className="text-sm font-heading font-bold">{(premissas.taxaRealAnual * 100).toFixed(2)}%</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30">
              <p className="text-[11px] text-muted-foreground">Taxa real mensal</p>
              <p className="text-sm font-heading font-bold">{(premissas.taxaRealMensal * 100).toFixed(4)}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Summary card ── */}
      {objetivosComCalculo.length > 0 && (
        <Card className="shadow-card rounded-2xl border-primary/15 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center gap-6 p-7">
              <div className="p-4 rounded-2xl bg-primary/10">
                <TrendingUp className="h-7 w-7 text-primary" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Seus objetivos de vida exigem</p>
                <p className="text-4xl font-heading font-bold tracking-tight">
                  {fmt(totalMensalNecessario)}
                  <span className="text-lg font-normal text-muted-foreground ml-2">/ mês</span>
                </p>
              </div>
              <div className="ml-auto hidden sm:flex items-center gap-2.5 text-sm text-muted-foreground">
                <Sparkles className="h-4 w-4" strokeWidth={1.5} />
                {objetivosComCalculo.length} {objetivosComCalculo.length === 1 ? "objetivo" : "objetivos"}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Empty state ── */}
      {objetivosComCalculo.length === 0 ? (
        <Card className="shadow-soft rounded-2xl border-dashed border-2 border-border/40">
          <CardContent className="py-24 text-center">
            <div className="p-6 rounded-full bg-primary/5 w-fit mx-auto mb-6">
              <Heart className="h-14 w-14 text-primary/25" strokeWidth={1.5} />
            </div>
            <h3 className="font-heading font-semibold text-xl text-foreground/70 mb-2">Comece a sonhar</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Adicione seu primeiro objetivo e descubra quanto precisa guardar por mês para realizá-lo.
            </p>
          </CardContent>
        </Card>
      ) : (
        /* ── Grid ── */
        <div className="grid md:grid-cols-2 gap-7">
          {objetivosComCalculo.map(o => {
            const pctVal = o.valor_objetivo > 0 ? Math.min(((o.valor_acumulado || 0) / o.valor_objetivo) * 100, 100) : 0;
            const concluido = pctVal >= 100;
            const objAportes = aportes[o.id] || [];
            const freqLabel = FREQUENCIA_OPTIONS.find(f => f.value === (o.frequencia || "unico"))?.label || "Único";
            const custoAtraso = o.poupancaDelayed - o.poupancaCalculada;
            const displayName = getDisplayName(o.nome, o.typeValue);

            const chartData = objAportes.reduce((acc: { date: string; acumulado: number }[], a) => {
              const prev = acc.length > 0 ? acc[acc.length - 1].acumulado : 0;
              acc.push({ date: new Date(a.data + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", day: "numeric" }), acumulado: prev + Number(a.valor) });
              return acc;
            }, []);

            return (
              <Card key={o.id} className={`group shadow-card overflow-hidden rounded-2xl transition-all hover:shadow-elevated ${concluido ? "ring-2 ring-success/30" : ""}`}>
                <CardContent className="p-7 space-y-6">
                  {/* ── Header ── */}
                  <div className="flex items-start gap-5">
                    <ObjectiveIcon typeValue={o.typeValue} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-medium text-primary/70 uppercase tracking-wider mb-0.5">{getTypeConfig(o.typeValue).label}</p>
                          <h3 className="font-heading font-bold text-lg leading-tight">{o.detalhes || displayName}</h3>
                        </div>
                        {concluido && (
                          <Badge className="bg-success/10 text-success border-success/20 rounded-lg shrink-0 text-[11px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Concluído
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" strokeWidth={1.5} />
                          {o.data_objetivo
                            ? new Date(o.data_objetivo + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
                            : freqLabel}
                        </span>
                        <span className="text-border">•</span>
                        <span>{getLabel(o.responsavel)}</span>
                        {o.dataInicio && (
                          <>
                            <span className="text-border">•</span>
                            <span>Início: {new Date(o.dataInicio + "T12:00:00").toLocaleDateString("pt-BR")}</span>
                          </>
                        )}
                        {o.aporte_mensal && o.aporte_mensal > 0 && (
                          <>
                            <span className="text-border">•</span>
                            <span className="flex items-center gap-1 text-primary/70">
                              <RefreshCw className="h-3 w-3" /> Auto: {fmt(o.aporte_mensal)}/mês
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Progress ── */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{fmt(o.valor_acumulado || 0)} guardados</span>
                      <span className="font-semibold">{fmt(o.valor_objetivo)}</span>
                    </div>
                    <Progress value={pctVal} className="h-3 rounded-full" />
                    <p className="text-right text-xs text-muted-foreground">{pctVal.toFixed(0)}% do objetivo</p>
                  </div>

                  {/* ── Time comparison ── */}
                  <div className="rounded-xl bg-muted/30 border border-border/30 divide-y divide-border/30">
                    <div className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <TrendingUp className="h-4 w-4 text-primary" strokeWidth={1.5} />
                        </div>
                        <span className="text-sm text-foreground/80">Começando hoje</span>
                      </div>
                      <span className="text-xl font-heading font-bold text-primary">
                        {fmt(o.poupancaCalculada)}
                        <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                      </span>
                    </div>
                    {!o.isRecorrente && custoAtraso > 0 && (
                      <>
                        <div className="flex items-center justify-between px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-destructive/10">
                              <Clock className="h-4 w-4 text-destructive/70" strokeWidth={1.5} />
                            </div>
                            <span className="text-sm text-muted-foreground">Começando em 12 meses</span>
                          </div>
                          <span className="text-xl font-heading font-bold text-destructive/80">
                            {fmt(o.poupancaDelayed)}
                            <span className="text-xs font-normal text-muted-foreground ml-1">/mês</span>
                          </span>
                        </div>
                        <div className="px-5 py-3 bg-destructive/5">
                          <p className="text-xs text-destructive/70 flex items-center gap-1.5">
                            <DollarSign className="h-3 w-3" />
                            Custo do atraso: <span className="font-semibold">+{fmt(custoAtraso)}/mês</span>
                          </p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* ── Mini chart ── */}
                  {chartData.length > 1 && historyId === o.id && (
                    <div className="h-28 pt-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                          <YAxis hide />
                          <ReTooltip formatter={(v: number) => fmt(v)} />
                          <Line type="monotone" dataKey="acumulado" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* ── Actions ── */}
                  <div className="flex gap-2 pt-2 flex-wrap">
                    {!concluido && (
                      <Button size="sm" className="gap-1.5 rounded-xl flex-1" onClick={() => { setAporteDialogId(o.id); setAporteForm(f => ({ ...f, responsavel: o.responsavel })); }}>
                        <PlusCircle className="h-3.5 w-3.5" /> Aportar
                      </Button>
                    )}
                    {objAportes.length > 0 && (
                      <Button size="sm" variant="outline" className="gap-1.5 rounded-xl" onClick={() => setHistoryId(historyId === o.id ? null : o.id)}>
                        <History className="h-3.5 w-3.5" /> Histórico
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 rounded-xl" onClick={() => handleEdit(o)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive gap-1 rounded-xl" onClick={() => handleDelete(o.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {/* ── History inline ── */}
                  {historyId === o.id && objAportes.length > 0 && (
                    <div className="space-y-2 pt-4 border-t border-border/30">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Histórico de aportes</p>
                      {objAportes.map(a => (
                        <div key={a.id} className="flex justify-between text-xs py-1.5">
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

      {/* ── Aporte Dialog ── */}
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

export default ObjetivosDeVida;
