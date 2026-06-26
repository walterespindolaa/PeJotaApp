import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Tooltip as TooltipUI, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CalendarDays, Banknote, TrendingUp, Link2, Wallet, FileText,
  Plus, Pencil, Trash2, AlertTriangle, Info,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Line, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useInvestimentos } from "@/contexts/InvestimentosContext";
import {
  TIPOS_PROVENTO, PERIOD_OPTIONS,
  getStartDate, formatMesPT,
} from "@/lib/investimentos/constants";
import type { Provento } from "@/lib/investimentos/types";

type ProventoForm = {
  investimento_id: string;
  tipo_provento: string;
  valor: number;
  mes_referencia: string;
  observacao: string;
};

const EMPTY_PROVENTO_FORM: ProventoForm = {
  investimento_id: "",
  tipo_provento: "Dividendo",
  valor: 0,
  mes_referencia: "",
  observacao: "",
};

export default function Proventos() {
  const {
    user,
    investimentos, proventos, fiiReports, dividendForecast, expenseLinks,
    mediaDespesas, quotes,
    selectedProventoMes, setSelectedProventoMes,
    fmt, pct, fetchAll, fetchFiiReports,
  } = useInvestimentos();
  const { toast } = useToast();

  const [proventoOpen, setProventoOpen] = useState(false);
  const [proventoEditId, setProventoEditId] = useState<string | null>(null);
  const [proventoForm, setProventoForm] = useState<ProventoForm>(EMPTY_PROVENTO_FORM);
  const [proventoPeriodo, setProventoPeriodo] = useState("12m");
  const [proventoTipoFilter, setProventoTipoFilter] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (fiiReports.length === 0) fetchFiiReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mesAtualRef = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  const ativosProventos = useMemo(
    () => investimentos.filter(i => ["Ação", "FII", "ETF", "Fundo"].includes(i.tipo)),
    [investimentos]
  );

  const proventoStartDate = getStartDate(proventoPeriodo);

  const filteredProventos = useMemo(
    () => proventos.filter(p => p.mes_referencia >= proventoStartDate),
    [proventos, proventoStartDate]
  );

  const sorted = useMemo(
    () => filteredProventos.filter(p => proventoTipoFilter === "all" || p.tipo_provento === proventoTipoFilter),
    [filteredProventos, proventoTipoFilter]
  );
  const totalPages = Math.ceil(sorted.length / pageSize);
  const paginatedProventos = sorted.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  const totalProventosMes = useMemo(() => {
    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return proventos
      .filter(p => p.mes_referencia?.startsWith(curMonth))
      .reduce((s, p) => s + Number(p.valor), 0);
  }, [proventos]);

  const totalProventosAno = useMemo(() => {
    const yr = String(new Date().getFullYear());
    return proventos
      .filter(p => p.mes_referencia?.startsWith(yr))
      .reduce((s, p) => s + Number(p.valor), 0);
  }, [proventos]);

  const mediaProventos6m = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;
    const recent = proventos.filter(p => p.mes_referencia >= startStr);
    return recent.length > 0 ? recent.reduce((s, p) => s + Number(p.valor), 0) / 6 : 0;
  }, [proventos]);

  const proventosChartData = useMemo(() => {
    const startDate = getStartDate(proventoPeriodo);
    const byMonth: Record<string, number> = {};
    proventos.filter(p => p.mes_referencia >= startDate).forEach(p => {
      const key = p.mes_referencia?.substring(0, 7) || "";
      byMonth[key] = (byMonth[key] || 0) + Number(p.valor);
    });
    const entries = Object.entries(byMonth).sort(([a], [b]) => a.localeCompare(b));
    let acum = 0;
    return entries.map(([mes, valor]) => {
      acum += valor;
      return { mes, valor, acumulado: acum };
    });
  }, [proventos, proventoPeriodo]);

  const agendaProventos = useMemo(() => {
    const now = new Date();
    const items: { ativo: string; mes: string; freq: string }[] = [];
    investimentos
      .filter(i => i.recebe_proventos && i.frequencia_proventos !== "sem_proventos")
      .forEach(inv => {
        const meses = inv.meses_proventos
          ? inv.meses_proventos.split(",").map(Number).filter(Boolean)
          : [];
        const freq = inv.frequencia_proventos;
        if (freq === "mensal") {
          for (let offset = 0; offset < 3; offset++) {
            const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
            items.push({
              ativo: inv.nome,
              mes: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
              freq,
            });
          }
        } else if (meses.length > 0) {
          meses.forEach(m => {
            const d = new Date(now.getFullYear(), m - 1, 1);
            if (d >= new Date(now.getFullYear(), now.getMonth(), 1)) {
              items.push({
                ativo: inv.nome,
                mes: d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
                freq,
              });
            }
          });
        }
      });
    return items.slice(0, 8);
  }, [investimentos]);

  const handleSaveProvento = async () => {
    if (!user) return;
    if (!proventoForm.investimento_id) {
      toast({ title: "Selecione um ativo", variant: "destructive" }); return;
    }
    if (proventoForm.valor <= 0) {
      toast({ title: "Valor deve ser maior que zero", variant: "destructive" }); return;
    }
    if (!proventoForm.mes_referencia) {
      toast({ title: "Informe o mês de referência", variant: "destructive" }); return;
    }
    const payload = {
      user_id: user.id,
      investimento_id: proventoForm.investimento_id,
      tipo_provento: proventoForm.tipo_provento,
      valor: proventoForm.valor,
      mes_referencia: `${proventoForm.mes_referencia}-01`,
      observacao: proventoForm.observacao || "",
    };
    const { error } = proventoEditId
      ? await supabase.from("proventos_investimentos").update(payload as any).eq("id", proventoEditId)
      : await supabase.from("proventos_investimentos").insert(payload as any);
    if (error) {
      toast({ title: "Erro ao salvar provento", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: proventoEditId ? "Provento atualizado" : "Provento registrado" });
    setProventoForm(EMPTY_PROVENTO_FORM);
    setProventoEditId(null);
    setProventoOpen(false);
    fetchAll();
  };

  const handleEditProvento = (p: Provento) => {
    setProventoForm({
      investimento_id: p.investimento_id,
      tipo_provento: p.tipo_provento,
      valor: Number(p.valor),
      mes_referencia: p.mes_referencia?.substring(0, 7) || "",
      observacao: p.observacao || "",
    });
    setProventoEditId(p.id);
    setProventoOpen(true);
  };

  const handleDeleteProvento = async (id: string) => {
    const { error } = await supabase.from("proventos_investimentos").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro ao excluir provento", description: error.message, variant: "destructive" });
      return;
    }
    fetchAll();
  };

  return (
    <>
      {dividendForecast.length > 0 && (
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" />
              Previsão — Próximos 12 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={dividendForecast}
                style={{ cursor: "pointer" }}
                onClick={(data: any) => {
                  const mes = data?.activePayload?.[0]?.payload?.mes;
                  if (mes) setSelectedProventoMes(mes);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 10 }} tickFormatter={formatMesPT} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `R$${v}`} />
                <Tooltip
                  formatter={(v: any) => [`R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, "Previsto"]}
                  labelFormatter={(l) => formatMesPT(l)}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Projeção baseada em dividendos anunciados e histórico recente dos FIIs. Valores estimados podem variar.
            </p>
            {selectedProventoMes && (() => {
              const previsaoMes = dividendForecast.filter(d => d.mes === selectedProventoMes);
              const proventosMes = proventos.filter(p => p.mes_referencia?.startsWith(selectedProventoMes));
              const isFuturo = selectedProventoMes > mesAtualRef;
              const items = isFuturo ? previsaoMes : proventosMes;
              if (!items.length) return null;
              return (
                <div className="mt-3 p-3 rounded-xl bg-muted/20 border border-border/40">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold">
                      {formatMesPT(selectedProventoMes)} — {isFuturo ? "Previsão" : "Recebido"}
                    </p>
                    <button
                      onClick={() => setSelectedProventoMes(null)}
                      className="text-[10px] text-muted-foreground hover:text-foreground"
                    >✕</button>
                  </div>
                  <div className="space-y-1">
                    {isFuturo ? (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Total estimado</span>
                        <span className="font-semibold text-primary">
                          {fmt(previsaoMes.reduce((s, d) => s + d.total, 0))}
                        </span>
                      </div>
                    ) : (
                      items.map((p: any, i: number) => {
                        const inv = investimentos.find(invItem => invItem.id === p.investimento_id);
                        return (
                          <div key={i} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              {inv?.ticker || inv?.nome || "—"} · {p.tipo_provento}
                            </span>
                            <span className="font-semibold text-primary">{fmt(Number(p.valor))}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {proventosChartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="shadow-soft rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> Proventos mês a mês
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={proventosChartData}
                  style={{ cursor: "pointer" }}
                  onClick={(data: any) => setSelectedProventoMes(data?.activePayload?.[0]?.payload?.mes || null)}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={formatMesPT}
                  />
                  <YAxis
                    tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    formatter={(v: number) => fmt(v)}
                    labelFormatter={(l) => formatMesPT(l)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 12,
                    }}
                  />
                  <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Proventos" />
                  <Line type="monotone" dataKey="acumulado" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Acumulado" />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-2 p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Total acumulado no período</p>
                <p className="text-lg font-heading font-bold text-primary">
                  {fmt(proventosChartData[proventosChartData.length - 1]?.acumulado || 0)}
                </p>
              </div>
              {selectedProventoMes && (() => {
                const provsMes = filteredProventos.filter(p => p.mes_referencia?.startsWith(selectedProventoMes));
                if (!provsMes.length) return null;
                return (
                  <div className="mt-3 p-3 rounded-xl bg-muted/20 border border-border/40">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold">
                        {selectedProventoMes} — {provsMes.length} provento(s)
                      </p>
                      <button
                        onClick={() => setSelectedProventoMes(null)}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >✕ Fechar</button>
                    </div>
                    <div className="space-y-1.5">
                      {provsMes.map(p => {
                        const inv = investimentos.find(i => i.id === p.investimento_id);
                        return (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">
                              {inv?.ticker || inv?.nome || "—"} · {p.tipo_provento}
                            </span>
                            <span className="font-semibold text-primary">{fmt(Number(p.valor))}</span>
                          </div>
                        );
                      })}
                      <div className="border-t border-border/40 pt-1.5 flex justify-between text-xs font-bold">
                        <span>Total</span>
                        <span className="text-primary">
                          {fmt(provsMes.reduce((s, p) => s + Number(p.valor), 0))}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          <Card className="shadow-soft rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="font-heading text-base flex items-center gap-2">
                <Link2 className="h-4 w-4 text-primary" /> Proventos: Comprometido vs Livre
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(() => {
                const totalProvPeriodo = filteredProventos.reduce((s, p) => s + Number(p.valor), 0);
                const comprometido = expenseLinks.reduce((s, l) => s + Number(l.valor_vinculado || 0), 0);
                const livre = Math.max(0, totalProvPeriodo - comprometido);
                const pctComprometido = totalProvPeriodo > 0 ? (comprometido / totalProvPeriodo) * 100 : 0;
                const exceeded = comprometido > totalProvPeriodo && totalProvPeriodo > 0;
                const donutDataComp = [
                  { name: "Comprometido", value: comprometido, color: "hsl(var(--warning))" },
                  { name: "Livre", value: livre, color: "hsl(var(--success))" },
                ].filter(d => d.value > 0);
                return (
                  <div className="space-y-4">
                    {donutDataComp.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width={140} height={140}>
                          <PieChart>
                            <Pie data={donutDataComp} dataKey="value" innerRadius={35} outerRadius={60} paddingAngle={3}>
                              {donutDataComp.map((d, i) => <Cell key={i} fill={d.color} />)}
                            </Pie>
                            <Tooltip
                              formatter={(v: number) => fmt(v)}
                              contentStyle={{
                                backgroundColor: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 12,
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-warning" />
                            <div>
                              <p className="text-xs font-medium">Comprometido</p>
                              <p className="text-sm font-heading font-bold">
                                {fmt(comprometido)}{" "}
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({pctComprometido.toFixed(0)}%)
                                </span>
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-success" />
                            <div>
                              <p className="text-xs font-medium">Livre</p>
                              <p className="text-sm font-heading font-bold">
                                {fmt(livre)}{" "}
                                <span className="text-xs text-muted-foreground font-normal">
                                  ({totalProvPeriodo > 0 ? (100 - pctComprometido).toFixed(0) : 0}%)
                                </span>
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nenhum vínculo ou provento registrado no período.
                      </p>
                    )}
                    {exceeded && (
                      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span className="text-xs font-medium">
                          Você comprometeu mais do que recebeu em proventos neste período.
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-primary" />
              <CardTitle className="font-heading text-base">Proventos Recebidos</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
              <Tabs value={proventoPeriodo} onValueChange={(v) => { setProventoPeriodo(v); setCurrentPage(0); }}>
                <TabsList className="h-7">
                  {[
                    { v: "mes", l: "Mês" }, { v: "3m", l: "3m" }, { v: "6m", l: "6m" },
                    { v: "12m", l: "12m" }, { v: "24m", l: "24m" }, { v: "all", l: "Tudo" },
                  ].map(p => (
                    <TabsTrigger key={p.v} value={p.v} className="text-[10px] px-2 h-5">{p.l}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <select
                value={proventoTipoFilter}
                onChange={e => { setProventoTipoFilter(e.target.value); setCurrentPage(0); }}
                className="text-xs border border-border rounded-lg px-2 py-1 bg-background"
              >
                <option value="all">Todos</option>
                <option value="Dividendo">Dividendos</option>
                <option value="JCP">JCP</option>
                <option value="Rendimento">Rendimentos (FII)</option>
              </select>
              <Dialog
                open={proventoOpen}
                onOpenChange={(v) => {
                  if (!v) {
                    setProventoEditId(null);
                    setProventoForm(EMPTY_PROVENTO_FORM);
                  }
                  setProventoOpen(v);
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm" className="rounded-xl gap-1 h-7 text-xs">
                    <Plus className="h-3 w-3" /> Provento
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md rounded-2xl">
                  <DialogHeader>
                    <DialogTitle className="font-heading">
                      {proventoEditId ? "Editar Provento" : "Registrar Provento"}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-3">
                    <div>
                      <Label>Tipo</Label>
                      <Select
                        value={proventoForm.tipo_provento}
                        onValueChange={v => setProventoForm({ ...proventoForm, tipo_provento: v })}
                      >
                        <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TIPOS_PROVENTO.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Ativo</Label>
                      <Select
                        value={proventoForm.investimento_id}
                        onValueChange={v => setProventoForm({ ...proventoForm, investimento_id: v })}
                      >
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Selecione o ativo" />
                        </SelectTrigger>
                        <SelectContent>
                          {ativosProventos.map(a => (
                            <SelectItem key={a.id} value={a.id}>{a.nome} ({a.tipo})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Valor (R$)</Label>
                        <Input
                          type="number" min={0}
                          value={proventoForm.valor || ""}
                          onChange={e => setProventoForm({ ...proventoForm, valor: Math.max(0, +e.target.value) })}
                          className="rounded-xl"
                        />
                      </div>
                      <div>
                        <Label>Mês Ref. (AAAA-MM)</Label>
                        <Input
                          type="month"
                          value={proventoForm.mes_referencia}
                          onChange={e => setProventoForm({ ...proventoForm, mes_referencia: e.target.value })}
                          className="rounded-xl"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Observação</Label>
                      <Input
                        value={proventoForm.observacao}
                        onChange={e => setProventoForm({ ...proventoForm, observacao: e.target.value })}
                        placeholder="Opcional"
                        className="rounded-xl"
                      />
                    </div>
                    <Button onClick={handleSaveProvento} className="rounded-xl">
                      {proventoEditId ? "Salvar" : "Registrar"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          {(() => {
            const startDate = getStartDate(proventoPeriodo);
            const startLabel = startDate.substring(0, 7).replace("-", "/");
            const now = new Date();
            const endLabel = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}`;
            const periodLabel = PERIOD_OPTIONS.find(p => p.value === proventoPeriodo)?.label || proventoPeriodo;
            return (
              <TooltipProvider>
                <TooltipUI>
                  <TooltipTrigger asChild>
                    <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1 cursor-help">
                      <Info className="h-3 w-3" />
                      Exibindo: {periodLabel} ({startLabel} → {endLabel})
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs text-xs">
                    <p>O filtro determina o intervalo de datas para proventos recebidos, gráficos e análise de comprometimento.</p>
                  </TooltipContent>
                </TooltipUI>
              </TooltipProvider>
            );
          })()}
          <div className="mt-2 flex items-start gap-1.5 text-[10px] text-muted-foreground/80 leading-relaxed">
            <Info className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-600/70" />
            <span>
              Dividendos recém-anunciados podem demorar até 3 dias úteis para aparecer na BRAPI.
              Se um pagamento de hoje não apareceu, rode "Atualizar via BRAPI" novamente em 1-2 dias.
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-xl bg-muted/30 text-center">
              <p className="text-[10px] text-muted-foreground">No mês</p>
              <p className="text-base font-heading font-bold text-primary">{fmt(totalProventosMes)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 text-center">
              <p className="text-[10px] text-muted-foreground">No ano</p>
              <p className="text-base font-heading font-bold text-primary">{fmt(totalProventosAno)}</p>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 text-center">
              <p className="text-[10px] text-muted-foreground">Média 6m</p>
              <p className="text-base font-heading font-bold text-primary">{fmt(mediaProventos6m)}</p>
            </div>
          </div>

          {filteredProventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum provento registrado no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mês Ref.</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Data EX</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProventos.map(p => {
                    const inv = investimentos.find(i => i.id === p.investimento_id);
                    return (
                      <TableRow key={p.id}>
                        <TableCell className="text-xs">{p.mes_referencia?.substring(0, 7)}</TableCell>
                        <TableCell className="text-xs font-medium">{inv?.nome || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px]">{p.tipo_provento}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.ex_date
                            ? new Date(p.ex_date + "T12:00:00").toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold text-primary">
                          {fmt(Number(p.valor))}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6"
                              onClick={() => handleEditProvento(p)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost" size="icon"
                              className="h-6 w-6 text-destructive/60 hover:text-destructive"
                              onClick={() => handleDeleteProvento(p.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Exibir</span>
                  <Select value={String(pageSize)} onValueChange={v => { setPageSize(Number(v)); setCurrentPage(0); }}>
                    <SelectTrigger className="w-[70px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-xs text-muted-foreground">por página</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {currentPage * pageSize + 1}–{Math.min((currentPage + 1) * pageSize, sorted.length)} de {sorted.length}
                  </span>
                  <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage === 0} onClick={() => setCurrentPage(p => p - 1)}>
                    ←
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2" disabled={currentPage >= totalPages - 1} onClick={() => setCurrentPage(p => p + 1)}>
                    →
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {filteredProventos.length > 0 && (
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" /> Cobertura com Renda Passiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const totalDespMensal = mediaDespesas;
              const cobertura = totalDespMensal > 0 ? (mediaProventos6m / totalDespMensal) * 100 : 0;
              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-xl bg-muted/30 text-center">
                      <p className="text-[10px] text-muted-foreground">Média Proventos/mês</p>
                      <p className="text-base font-heading font-bold text-primary">{fmt(mediaProventos6m)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-muted/30 text-center">
                      <p className="text-[10px] text-muted-foreground">Média Despesas/mês</p>
                      <p className="text-base font-heading font-bold">{fmt(totalDespMensal)}</p>
                    </div>
                  </div>
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-center">
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Cobertura de despesas com renda passiva
                    </p>
                    <p className="text-2xl font-heading font-bold text-primary">{pct(cobertura)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {cobertura >= 100
                        ? "Sua renda passiva cobre 100% das despesas!"
                        : `Renda passiva cobre ${cobertura.toFixed(0)}% das suas despesas mensais.`}
                    </p>
                  </div>
                  {cobertura < 100 && (
                    <div className="flex items-center gap-2 text-warning">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-xs">
                        Faltam {fmt(Math.max(0, totalDespMensal - mediaProventos6m))}/mês para cobertura total.
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {agendaProventos.length > 0 && (
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle className="font-heading text-base">Agenda de Proventos</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {agendaProventos.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 text-xs">
                  <CalendarDays className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                  <span>
                    Em <strong>{item.mes}</strong>, o ativo <strong>{item.ativo}</strong> tende a pagar proventos ({item.freq}).
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground mt-1">
                Previsão baseada na frequência configurada. Não é garantia de pagamento.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {fiiReports.length > 0 && (
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Informe Mensal CVM dos FIIs
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-1">
              Dados regulatórios mais recentes publicados na CVM. Indicadores oficiais — não é o relatório gerencial do gestor.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {fiiReports.map((r: any) => {
              const inf = r.informe || {};
              const refDate = inf.referenceDate
                ? new Date(inf.referenceDate).toLocaleDateString("pt-BR", { month: "short", year: "numeric" })
                : "—";
              const comp = inf.composition || {};
              const compEntries = [
                { label: "CRI", value: comp.cri },
                { label: "Imóveis", value: comp.realEstateAssets },
                { label: "LCI", value: comp.lci },
                { label: "Tít. públicos", value: comp.governmentBonds },
                { label: "Caixa", value: comp.cash },
                { label: "Outros", value: comp.other },
              ].filter(c => c.value != null && Number(c.value) > 0);

              return (
                <div key={r.ticker} className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-sm">{r.ticker}</span>
                      <span className="text-[10px] text-muted-foreground">Ref: {refDate}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="bg-background/60 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">DY do mês</p>
                      <p className={`text-xs sm:text-sm font-bold font-heading ${
                        inf.monthlyDividendYield != null && inf.monthlyDividendYield > 0 ? "text-primary" : ""
                      }`}>
                        {inf.monthlyDividendYield != null ? `${Number(inf.monthlyDividendYield).toFixed(2)}%` : "—"}
                      </p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Retorno mês</p>
                      <p className={`text-xs sm:text-sm font-bold font-heading ${
                        inf.monthlyReturn != null && inf.monthlyReturn >= 0 ? "text-emerald-600" : "text-destructive"
                      }`}>
                        {inf.monthlyReturn != null ? `${Number(inf.monthlyReturn).toFixed(2)}%` : "—"}
                      </p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">VP/cota</p>
                      <p className="text-xs sm:text-sm font-bold font-heading">
                        {inf.navPerShare != null ? `R$ ${Number(inf.navPerShare).toFixed(2)}` : "—"}
                      </p>
                    </div>
                    <div className="bg-background/60 rounded-lg p-2">
                      <p className="text-[10px] text-muted-foreground">Cotistas</p>
                      <p className="text-xs sm:text-sm font-bold font-heading">
                        {inf.totalInvestors != null ? Number(inf.totalInvestors).toLocaleString("pt-BR") : "—"}
                      </p>
                    </div>
                  </div>

                  {compEntries.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">Composição da carteira</p>
                      <div className="flex flex-wrap gap-1.5">
                        {compEntries.map(c => (
                          <span
                            key={c.label}
                            className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap"
                          >
                            {c.label}: {Number(c.value).toFixed(1)}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-[10px] text-muted-foreground italic">
              Fonte: CVM via BRAPI. Para o relatório gerencial em PDF, consulte o site oficial do gestor de cada FII.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
