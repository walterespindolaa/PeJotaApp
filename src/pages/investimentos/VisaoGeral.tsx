import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  TrendingUp, Plus, Trash2, Trash, PiggyBank, AlertTriangle, ArrowUpRight,
  DollarSign, Landmark, BarChart3, Wallet, Pencil, ArrowUpDown,
  RefreshCw, ShoppingCart, TrendingDown, Percent,
} from "lucide-react";
import {
  PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useInvestimentos } from "@/contexts/InvestimentosContext";
import {
  TIPOS, TIPOS_MANUAIS, ALOCACAO_COLORS, INST_COLORS,
  REFRESH_LIMIT_KEY, getStartDate, getAlocacaoKey,
} from "@/lib/investimentos/constants";
import type { Investimento } from "@/lib/investimentos/types";

function getDivRefreshState(): { count: number; date: string } {
  try {
    const s = localStorage.getItem(REFRESH_LIMIT_KEY);
    if (!s) return { count: 0, date: "" };
    return JSON.parse(s);
  } catch { return { count: 0, date: "" }; }
}

type RendForm = {
  mes_ano: string;
  percentual: string;
  delta: string;
  valor_novo: string;
  observacao: string;
};

type TxForm = {
  investimento_id: string;
  tipo: string;
  data: string;
  quantidade: number;
  preco_unitario: number;
  observacao: string;
};

const EMPTY_REND_FORM: RendForm = {
  mes_ano: new Date().toISOString().slice(0, 7),
  percentual: "",
  delta: "",
  valor_novo: "",
  observacao: "",
};

const EMPTY_TX_FORM: TxForm = {
  investimento_id: "",
  tipo: "compra",
  data: new Date().toISOString().split("T")[0],
  quantidade: 0,
  preco_unitario: 0,
  observacao: "",
};

export default function VisaoGeral() {
  const ctx = useInvestimentos();
  const { toast } = useToast();
  const {
    user,
    investimentos, indicadores, snapshots, aportes,
    quotes, quotesLoading,
    macroData, macroLoading,
    mediaDespesas, periodo,
    fmt, pct, fetchAll, fetchQuotes, fetchMacroData,
    handleEdit, handleDelete,
    totalAtual, totalAportado, divRefreshRemaining,
    dividendForecast, nextExDates,
  } = ctx;

  const [sortCol, setSortCol] = useState<string>("nome");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterTipo, setFilterTipo] = useState<string>("all");

  const [zerarOpen, setZerarOpen] = useState(false);
  const [zerarConfirmText, setZerarConfirmText] = useState("");
  const [zerarDeleting, setZerarDeleting] = useState(false);

  const ZERAR_PHRASE = "EXCLUIR CARTEIRA";
  const zerarMatchesPhrase = zerarConfirmText === ZERAR_PHRASE;

  const handleZerarCarteira = async () => {
    if (!user || !zerarMatchesPhrase) return;
    setZerarDeleting(true);

    const totalAtivos = investimentos.length;

    const tasks = [
      supabase.from("investimentos_financeiros").delete().eq("user_id", user.id),
      supabase.from("proventos_investimentos").delete().eq("user_id", user.id),
      supabase.from("aportes_investimentos").delete().eq("user_id", user.id),
      supabase.from("portfolio_transactions").delete().eq("user_id", user.id),
      supabase.from("rendimentos_mensais").delete().eq("user_id", user.id),
      supabase.from("portfolio_snapshots").delete().eq("user_id", user.id),
    ];

    const results = await Promise.all(tasks);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      console.error("Zerar carteira errors:", errors.map(e => e.error));
      toast({
        title: "Erro parcial ao excluir carteira",
        description: `${errors.length} de 6 operações falhou. Tente novamente.`,
        variant: "destructive",
      });
      setZerarDeleting(false);
      return;
    }

    toast({
      title: "Carteira excluída",
      description: `${totalAtivos} ativo(s) e todos os dados relacionados foram apagados.`,
    });

    setZerarOpen(false);
    setZerarConfirmText("");
    setZerarDeleting(false);
    fetchAll();
  };

  const [txOpen, setTxOpen] = useState(false);
  const [txForm, setTxForm] = useState<TxForm>(EMPTY_TX_FORM);

  const [rendOpen, setRendOpen] = useState(false);
  const [rendInv, setRendInv] = useState<Investimento | null>(null);
  const [rendMode, setRendMode] = useState<"percent" | "delta" | "total">("percent");
  const [rendForm, setRendForm] = useState<RendForm>(EMPTY_REND_FORM);

  useEffect(() => {
    if (macroData.selic.length === 0) fetchMacroData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rendimento = totalAtual - totalAportado;
  const rentabilidade = totalAportado > 0 ? (rendimento / totalAportado) * 100 : 0;

  const selic = indicadores.find(i => i.indicador === "selic")?.valor || 0;
  const cdi = indicadores.find(i => i.indicador === "cdi")?.valor || 0;
  const ipca = indicadores.find(i => i.indicador === "ipca")?.valor || 0;

  const indicadorUpdatedAt = useMemo(() => {
    const dates = indicadores.map(i => i.updated_at).filter(Boolean);
    return dates.length > 0 ? dates.sort().reverse()[0] : null;
  }, [indicadores]);

  const filteredSnapshots = useMemo(() => {
    const startMonth = getStartDate(periodo).substring(0, 7);
    return snapshots.filter(s => s.month_ref >= startMonth);
  }, [snapshots, periodo]);

  const monthsInPeriod = Math.max(filteredSnapshots.length, 1);
  const cdiMensal = cdi > 0 ? Math.pow(1 + cdi / 100, 1 / 12) - 1 : 0;
  const cdiAcumuladoPeriodo = cdiMensal > 0 ? (Math.pow(1 + cdiMensal, monthsInPeriod) - 1) * 100 : 0;

  const periodoReturn = useMemo(() => {
    if (filteredSnapshots.length < 2) return rentabilidade;
    const first = filteredSnapshots[0];
    const last = filteredSnapshots[filteredSnapshots.length - 1];
    const contrib = last.total_contributions - first.total_contributions;
    const adjustedBase = first.total_value + contrib;
    return adjustedBase > 0 ? ((last.total_value - adjustedBase) / adjustedBase) * 100 : 0;
  }, [filteredSnapshots, rentabilidade]);

  const pctDoCDI = cdiAcumuladoPeriodo > 0 ? (periodoReturn / cdiAcumuladoPeriodo) * 100 : 0;

  const rentMesAtual = useMemo(() => {
    const hoje = new Date();
    const anoMesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const anoMesAnterior = (() => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();

    const snapAnterior = snapshots.find(s => s.month_ref === anoMesAnterior);
    if (!snapAnterior) return { pct: null as number | null, valor: null as number | null };

    const aportesMes = aportes
      .filter(a => a.data && a.data.startsWith(anoMesAtual))
      .reduce((s, a) => s + Number(a.valor), 0);

    const baseAjustada = Number(snapAnterior.total_value) + aportesMes;
    if (baseAjustada <= 0) return { pct: null, valor: null };

    const valorMes = totalAtual - baseAjustada;
    const pctMes = (valorMes / baseAjustada) * 100;
    return { pct: pctMes, valor: valorMes };
  }, [snapshots, aportes, totalAtual]);

  const labelPeriodo = useMemo(() => {
    switch (periodo) {
      case "mes": return "no mês";
      case "3m": return "em 3 meses";
      case "6m": return "em 6 meses";
      case "12m": return "em 12 meses";
      case "24m": return "em 24 meses";
      case "ano": return "no ano";
      case "all": return "em todo o período";
      default: return "no período";
    }
  }, [periodo]);

  const proximosProventos = useMemo(() => {
    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
    const proxMes = (() => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    })();
    const relevantes = (dividendForecast || []).filter(p => p.mes === mesAtual || p.mes === proxMes);
    const total = relevantes.reduce((s, p) => s + Number(p.total || 0), 0);
    const ativosCount = Object.keys(nextExDates || {}).length;
    return { total, ativosCount };
  }, [dividendForecast, nextExDates]);

  const maiorPosicao = useMemo(() => {
    if (investimentos.length === 0 || totalAtual <= 0) return null;
    const ordenado = [...investimentos].sort(
      (a, b) => Number(b.valor_atual || 0) - Number(a.valor_atual || 0)
    );
    const top = ordenado[0];
    const pctTop = (Number(top.valor_atual || 0) / totalAtual) * 100;
    return {
      nome: top.ticker || top.nome || "—",
      pct: pctTop,
      alerta: pctTop > 25,
    };
  }, [investimentos, totalAtual]);

  const filteredAportes = useMemo(() => {
    const startDate = getStartDate(periodo);
    return aportes.filter(a => a.data >= startDate);
  }, [aportes, periodo]);

  const totalAportesPerido = filteredAportes.reduce((s, a) => s + Number(a.valor), 0);
  const numAportes = filteredAportes.length;

  const chartData = useMemo(() => {
    if (filteredSnapshots.length === 0) return [];
    let cdiAccum = 1;
    const firstValue = filteredSnapshots[0]?.total_contributions || filteredSnapshots[0]?.total_value || 0;
    return filteredSnapshots.map((s, i) => {
      if (i > 0) cdiAccum *= (1 + cdiMensal);
      return { mes: s.month_ref, patrimonio: s.total_value, cdi: firstValue * cdiAccum };
    });
  }, [filteredSnapshots, cdiMensal]);

  const pieData = useMemo(() => {
    const byKey: Record<string, number> = {};
    investimentos.forEach(i => {
      const key = getAlocacaoKey(i);
      byKey[key] = (byKey[key] || 0) + Number(i.valor_atual || 0);
    });
    return Object.entries(byKey)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [investimentos]);

  const institutionPieData = useMemo(() => {
    const byInst: Record<string, number> = {};
    investimentos.forEach(i => {
      const inst = i.instituicao || "Outros";
      byInst[inst] = (byInst[inst] || 0) + Number(i.valor_atual || 0);
    });
    return Object.entries(byInst)
      .map(([name, value]) => ({ name, value }))
      .filter(d => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [investimentos]);

  const reservaIdeal = mediaDespesas * 8;
  const reservaInvestimentos = investimentos.filter(i => i.is_reserva_emergencia);
  const reservaAtual = reservaInvestimentos.reduce((s, i) => s + Number(i.valor_atual || 0), 0);
  const reservaPct = reservaIdeal > 0 ? Math.min((reservaAtual / reservaIdeal) * 100, 100) : 0;

  const sortedInvestimentos = useMemo(() => {
    let list = [...investimentos];
    if (filterTipo !== "all") list = list.filter(i => i.tipo === filterTipo);
    list.sort((a, b) => {
      let va: any, vb: any;
      switch (sortCol) {
        case "nome": va = a.nome; vb = b.nome; break;
        case "tipo": va = a.tipo; vb = b.tipo; break;
        case "instituicao": va = a.instituicao; vb = b.instituicao; break;
        case "total_aportado": va = Number(a.total_aportado); vb = Number(b.total_aportado); break;
        case "valor_atual": va = Number(a.valor_atual); vb = Number(b.valor_atual); break;
        case "rentab":
          va = Number(a.valor_atual) - Number(a.total_aportado);
          vb = Number(b.valor_atual) - Number(b.total_aportado);
          break;
        default: va = a.nome; vb = b.nome;
      }
      if (typeof va === "string") return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === "asc" ? va - vb : vb - va;
    });
    return list;
  }, [investimentos, sortCol, sortDir, filterTipo]);

  const toggleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  };

  const SortHeader = ({ col, children }: { col: string; children: React.ReactNode }) => (
    <TableHead className="cursor-pointer select-none whitespace-nowrap" onClick={() => toggleSort(col)}>
      <div className="flex items-center gap-1">{children}<ArrowUpDown className="h-3 w-3 text-muted-foreground/50" /></div>
    </TableHead>
  );

  const CustomPieTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0];
    const pctVal = totalAtual > 0 ? (d.value / totalAtual * 100).toFixed(2) : "0";
    return (
      <div className="rounded-xl border bg-card p-3 shadow-elevated text-xs space-y-1">
        <p className="font-heading font-bold">{d.name}</p>
        <p>{pctVal}% da carteira</p>
        <p className="font-medium">{fmt(d.value)}</p>
      </div>
    );
  };

  const openRendDialog = (inv: Investimento) => {
    setRendInv(inv);
    setRendMode("percent");
    setRendForm(EMPTY_REND_FORM);
    setRendOpen(true);
  };

  const previewValorNovo = (() => {
    if (!rendInv) return null;
    const valorAtual = Number(rendInv.valor_atual || 0);
    if (rendMode === "percent") {
      const p = parseFloat(rendForm.percentual.replace(",", "."));
      if (!Number.isFinite(p)) return null;
      return valorAtual * (1 + p / 100);
    } else if (rendMode === "delta") {
      const delta = parseFloat(rendForm.delta.replace(",", "."));
      if (!Number.isFinite(delta)) return null;
      return valorAtual + delta;
    } else {
      const v = parseFloat(rendForm.valor_novo.replace(",", "."));
      if (!Number.isFinite(v)) return null;
      return v;
    }
  })();

  const previewPctReal = (() => {
    if (!rendInv || previewValorNovo == null) return null;
    const valorAtual = Number(rendInv.valor_atual || 0);
    if (valorAtual <= 0) return null;
    return (previewValorNovo / valorAtual - 1) * 100;
  })();

  const handleSubmitRendimento = async () => {
    if (!rendInv) return;
    if (previewValorNovo == null) {
      toast({ title: "Preencha o rendimento ou valor", variant: "destructive" }); return;
    }
    if (!rendForm.mes_ano.match(/^\d{4}-\d{2}$/)) {
      toast({ title: "Mês de referência inválido", variant: "destructive" }); return;
    }
    const valorAntes = Number(rendInv.valor_atual || 0);
    const valorApos = previewValorNovo;
    const p = previewPctReal ?? 0;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      toast({ title: "Sessão expirada", variant: "destructive" }); return;
    }

    const { error: histErr } = await supabase
      .from("rendimentos_mensais")
      .upsert({
        user_id: authUser.id,
        investimento_id: rendInv.id,
        mes_ano: rendForm.mes_ano,
        percentual: p,
        valor_antes: valorAntes,
        valor_apos: valorApos,
        observacao: rendForm.observacao || null,
      }, { onConflict: "user_id,investimento_id,mes_ano" });

    if (histErr) {
      toast({ title: "Erro ao salvar histórico", description: histErr.message, variant: "destructive" });
      return;
    }

    const { error: invErr } = await supabase
      .from("investimentos_financeiros")
      .update({ valor_atual: valorApos })
      .eq("id", rendInv.id);

    if (invErr) {
      toast({ title: "Erro ao atualizar ativo", description: invErr.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Rendimento registrado",
      description: `${rendInv.nome}: ${p >= 0 ? "+" : ""}${p.toFixed(2)}% no mês ${rendForm.mes_ano}`,
    });
    setRendOpen(false);
    setRendInv(null);
    fetchAll();
  };

  const handleSubmitTx = async () => {
    if (!user || !txForm.investimento_id || txForm.quantidade <= 0) return;
    const inv = investimentos.find(i => i.id === txForm.investimento_id);
    await supabase.from("portfolio_transactions").insert({
      user_id: user.id,
      investimento_id: txForm.investimento_id,
      ticker: inv?.ticker || "",
      nome: inv?.nome || "",
      tipo: txForm.tipo,
      data: txForm.data,
      quantidade: txForm.quantidade,
      preco_unitario: txForm.preco_unitario,
      valor_total: txForm.quantidade * txForm.preco_unitario,
      observacao: txForm.observacao || null,
    } as any);
    toast({ title: txForm.tipo === "compra" ? "Compra registrada ✓" : "Venda registrada ✓" });
    setTxOpen(false);
    fetchAll();
  };

  const handleRefreshQuotes = () => {
    const state = getDivRefreshState();
    const todayStr = new Date().toISOString().split("T")[0];
    const count = state.date === todayStr ? state.count : 0;
    if (count >= 2) {
      toast({ title: "Limite de 2 atualizações/dia via BRAPI atingido.", variant: "destructive" });
      return;
    }
    const newCount = count + 1;
    localStorage.setItem(REFRESH_LIMIT_KEY, JSON.stringify({ count: newCount, date: todayStr }));
    fetchQuotes(investimentos, true);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Patrimônio Investido", value: fmt(totalAtual), icon: Landmark, color: "text-primary" },
          { label: "Total Aportado", value: fmt(totalAportado), icon: DollarSign, color: "text-muted-foreground" },
          { label: "Rendimento", value: fmt(rendimento), icon: TrendingUp, color: rendimento >= 0 ? "text-success" : "text-destructive" },
          { label: "Rentabilidade", value: pct(rentabilidade), icon: ArrowUpRight, color: "text-primary" },
        ].map((kpi, i) => (
          <Card key={i} className="shadow-soft rounded-2xl">
            <CardContent className="p-3 sm:p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <kpi.icon className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${kpi.color}`} />
                <span className="text-[10px] sm:text-xs text-muted-foreground">{kpi.label}</span>
              </div>
              <p className={`text-sm sm:text-lg font-heading font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Rent. no Mês Atual</p>
            {rentMesAtual.pct == null ? (
              <>
                <p className="text-sm sm:text-lg font-heading font-bold text-muted-foreground">—</p>
                <p className="text-[10px] text-muted-foreground">aguardando snapshot</p>
              </>
            ) : (
              <>
                <p className={`text-sm sm:text-lg font-heading font-bold ${
                  rentMesAtual.pct >= 0 ? "text-success" : "text-destructive"
                }`}>
                  {pct(rentMesAtual.pct)}
                </p>
                <p className="text-[10px] text-muted-foreground">{fmt(rentMesAtual.valor!)}</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft rounded-2xl border-primary/20">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">
              Rent. {labelPeriodo}
            </p>
            <p className={`text-sm sm:text-lg font-heading font-bold ${
              periodoReturn >= 0 ? "text-primary" : "text-destructive"
            }`}>
              {pct(periodoReturn)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              CDI: {pct(cdiAcumuladoPeriodo)}
              {pctDoCDI > 0 && ` · ${pctDoCDI.toFixed(0)}% do CDI`}
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Próximos Proventos</p>
            {proximosProventos.total > 0 ? (
              <>
                <p className="text-sm sm:text-lg font-heading font-bold text-primary">
                  {fmt(proximosProventos.total)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  próximos 30 dias
                  {proximosProventos.ativosCount > 0 && ` · ${proximosProventos.ativosCount} ativo${proximosProventos.ativosCount > 1 ? "s" : ""}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm sm:text-lg font-heading font-bold text-muted-foreground">—</p>
                <p className="text-[10px] text-muted-foreground">nenhum previsto</p>
              </>
            )}
          </CardContent>
        </Card>

        <Card className={`shadow-soft rounded-2xl ${maiorPosicao?.alerta ? "border-amber-300" : ""}`}>
          <CardContent className="p-3 sm:p-4">
            <p className="text-[10px] sm:text-xs text-muted-foreground mb-1">Maior Posição</p>
            {maiorPosicao ? (
              <>
                <p className={`text-sm sm:text-lg font-heading font-bold ${
                  maiorPosicao.alerta ? "text-amber-700" : "text-primary"
                }`}>
                  {maiorPosicao.pct.toFixed(1).replace(".", ",")}%
                </p>
                <p className="text-[10px] text-muted-foreground truncate" title={maiorPosicao.nome}>
                  {maiorPosicao.nome}{maiorPosicao.alerta && " · concentrado"}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm sm:text-lg font-heading font-bold text-muted-foreground">—</p>
                <p className="text-[10px] text-muted-foreground">sem ativos</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {numAportes > 0 && (
        <Card className="shadow-soft rounded-2xl">
          <CardContent className="p-4 flex items-center gap-4">
            <Wallet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-medium">
                Aportes realizados: <span className="font-bold">{numAportes}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Total aportado no período: {fmt(totalAportesPerido)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {chartData.length > 1 && (
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">Evolução do Patrimônio</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(value: number, name: string) => [fmt(value), name === "patrimonio" ? "Patrimônio" : "CDI Acumulado"]}
                  labelFormatter={l => `Mês: ${l}`}
                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                />
                <Legend formatter={v => v === "patrimonio" ? "Patrimônio" : "CDI Acumulado"} />
                <Line type="monotone" dataKey="patrimonio" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="cdi" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4">
        <Card className="shadow-soft rounded-2xl bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base">Alocação da Carteira</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <>
                {pieData.length === 1 && (
                  <div className="p-3 rounded-xl bg-warning/10 border border-warning/20 mb-3">
                    <p className="text-xs text-warning font-medium">Carteira concentrada em uma única estratégia.</p>
                  </div>
                )}
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}>
                        {pieData.map((d, i) => <Cell key={i} fill={ALOCACAO_COLORS[d.name] || ALOCACAO_COLORS["Outro"]} />)}
                      </Pie>
                      <Tooltip content={<CustomPieTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="mt-6 space-y-1.5">
                  <div className="grid grid-cols-3 text-[10px] text-muted-foreground font-medium uppercase px-2 pb-1 border-b border-border/40">
                    <span>Estratégia</span>
                    <span className="text-right">% Carteira</span>
                    <span className="text-right">Saldo Bruto</span>
                  </div>
                  {pieData.map(d => (
                    <div key={d.name} className="grid grid-cols-3 items-center px-2 py-1.5 text-xs hover:bg-muted/30 rounded-lg transition-colors">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                          style={{ backgroundColor: ALOCACAO_COLORS[d.name] || ALOCACAO_COLORS["Outro"] }}
                        />
                        <span className="font-medium">{d.name}</span>
                      </div>
                      <span className="text-right font-heading font-bold">
                        {totalAtual > 0 ? (d.value / totalAtual * 100).toFixed(2) : "0.00"}%
                      </span>
                      <span className="text-right text-muted-foreground">{fmt(d.value)}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {institutionPieData.length > 0 && (
                    <Card className="shadow-soft rounded-2xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="font-heading text-base flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-primary" />
                          Distribuição por Instituição
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                          <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie data={institutionPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2}>
                                  {institutionPieData.map((_, i) => <Cell key={i} fill={INST_COLORS[i % INST_COLORS.length]} />)}
                                </Pie>
                                <Tooltip
                                  formatter={(v: number) => fmt(v)}
                                  contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }}
                                />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="space-y-1.5">
                            {institutionPieData.map((d, i) => (
                              <div key={d.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/30 transition-colors">
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-sm"
                                    style={{ backgroundColor: INST_COLORS[i % INST_COLORS.length] }}
                                  />
                                  <span className="text-sm font-medium">{d.name}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-sm font-heading font-bold">{fmt(d.value)}</span>
                                  <span className="text-xs text-muted-foreground ml-2">
                                    ({totalAtual > 0 ? (d.value / totalAtual * 100).toFixed(1) : 0}%)
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="shadow-soft rounded-2xl">
                    <CardHeader className="pb-2">
                      <CardTitle className="font-heading text-base">Indicadores Econômicos</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { label: "SELIC", valor: selic },
                        { label: "CDI", valor: cdi },
                        { label: "IPCA 12m", valor: ipca },
                      ].map(ind => (
                        <div key={ind.label} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                          <span className="text-sm font-medium">{ind.label}</span>
                          <Badge variant="secondary" className="rounded-lg">{ind.valor ? pct(ind.valor) : "—"}</Badge>
                        </div>
                      ))}
                      <div className="pt-2 space-y-1.5">
                        <p className="text-[10px] text-muted-foreground">Fonte: Banco Central do Brasil (SGS)</p>
                        {indicadorUpdatedAt && (
                          <p className="text-[10px] text-muted-foreground">
                            Última atualização: {new Date(indicadorUpdatedAt).toLocaleString("pt-BR", {
                              day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
                            })}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Adicione investimentos para ver a composição.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Selic & IPCA Histórico
            </CardTitle>
            {macroLoading && <span className="text-xs text-muted-foreground">Carregando...</span>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {macroData.selic.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">Taxa Selic Meta (% a.a.) — últimos 36 meses</p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={macroData.selic.slice(-36)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 9 }}
                    tickFormatter={d => {
                      if (!d) return "";
                      const parts = String(d).split(/[-/]/);
                      if (parts.length >= 2) return parts.length === 3 && parts[0].length === 4
                        ? `${parts[1]}/${parts[0].slice(2)}`
                        : `${parts[0]}/${parts[1].slice(2)}`;
                      return d;
                    }}
                  />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${Number(v).toFixed(2)}%`} domain={['auto', 'auto']} />
                  <Tooltip
                    formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "Selic a.a."]}
                    labelFormatter={l => `Data: ${l}`}
                  />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {macroData.selic.length === 0 && !macroLoading && (
            <div className="h-20 flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Dados da Selic não disponíveis</p>
            </div>
          )}
          {macroData.ipca.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-2 text-muted-foreground">IPCA — Variação acumulada 12 meses (% a.a.) — últimos 36 meses</p>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={macroData.ipca.slice(-36)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={d => d?.substring(0, 7) || d} />
                  <YAxis tick={{ fontSize: 9 }} tickFormatter={v => `${Number(v).toFixed(2)}%`} domain={['auto', 'auto']} />
                  <Tooltip formatter={(v: any) => [`${Number(v).toFixed(2)}%`, "IPCA acum. 12m"]} labelFormatter={l => `Data: ${l}`} />
                  <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground italic">Fonte: Banco Central do Brasil via BRAPI. Dados desde 2020.</p>
        </CardContent>
      </Card>

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-warning" />
            <CardTitle className="font-heading text-base">Reserva de Emergência</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <div>
              <p className="text-xs text-muted-foreground">Meta Ideal (8 meses)</p>
              <p className="text-base sm:text-lg font-bold font-heading">{fmt(reservaIdeal)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Acumulado</p>
              <p className="text-base sm:text-lg font-bold font-heading">{fmt(reservaAtual)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">% Atingido</p>
              <p className="text-base sm:text-lg font-bold font-heading">{pct(reservaPct)}</p>
            </div>
          </div>
          <Progress value={reservaPct} className="h-2 rounded-full" />
          {reservaInvestimentos.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Ativos que compõem a reserva:</p>
              {reservaInvestimentos.map(inv => (
                <div key={inv.id} className="flex items-center gap-2 text-xs">
                  <span className="text-base">🐷</span>
                  <span className="font-medium">{inv.nome}</span>
                  <span className="text-muted-foreground">— {fmt(Number(inv.valor_atual))}</span>
                  <Badge variant="outline" className="text-[9px]">{inv.liquidez}</Badge>
                </div>
              ))}
            </div>
          )}
          {reservaPct < 100 && (
            <div className="flex items-center gap-2 mt-2 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-medium">Sua reserva ainda está abaixo do ideal.</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="font-heading text-base">Meus Investimentos</CardTitle>
            <div className="flex items-center gap-2">
              <Select value={filterTipo} onValueChange={setFilterTipo}>
                <SelectTrigger className="w-[160px] rounded-xl h-8 text-xs">
                  <SelectValue placeholder="Filtrar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  {TIPOS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
              {divRefreshRemaining < 2 && (
                <span className="text-[10px] text-muted-foreground px-2 py-1 rounded-lg bg-muted/30 border border-border/40">
                  {divRefreshRemaining > 0
                    ? `${divRefreshRemaining} atualização restante hoje`
                    : "Limite diário atingido"}
                </span>
              )}
              <button
                onClick={handleRefreshQuotes}
                disabled={quotesLoading || divRefreshRemaining === 0}
                className="p-1.5 rounded-lg border hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title={divRefreshRemaining === 0
                  ? "Limite de 2 atualizações/dia atingido"
                  : `Atualizar cotações (${divRefreshRemaining} restante${divRefreshRemaining !== 1 ? "s" : ""} hoje)`}
              >
                <RefreshCw className={`h-4 w-4 text-muted-foreground ${quotesLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sortedInvestimentos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Nenhum investimento cadastrado{filterTipo !== "all" ? " para este filtro" : ""}.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4 p-3 rounded-xl bg-muted/30">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Total Aplicado</p>
                  <p className="text-sm font-bold">
                    {fmt(sortedInvestimentos.reduce((s, i) => s + Number(i.total_aportado || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Total Atual</p>
                  <p className="text-sm font-bold">
                    {fmt(sortedInvestimentos.reduce((s, i) => s + Number(i.valor_atual || 0), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Rentab. R$</p>
                  <p className="text-sm font-bold">
                    {fmt(sortedInvestimentos.reduce((s, i) => s + (Number(i.valor_atual || 0) - Number(i.total_aportado || 0)), 0))}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase">Rentab. %</p>
                  <p className="text-sm font-bold">
                    {(() => {
                      const a = sortedInvestimentos.reduce((s, i) => s + Number(i.total_aportado || 0), 0);
                      return a > 0
                        ? pct((sortedInvestimentos.reduce((s, i) => s + Number(i.valor_atual || 0), 0) - a) / a * 100)
                        : "—";
                    })()}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortHeader col="nome">Ativo</SortHeader>
                      <SortHeader col="tipo">Tipo</SortHeader>
                      <SortHeader col="instituicao">Corretora</SortHeader>
                      <SortHeader col="total_aportado">Aplicado</SortHeader>
                      <SortHeader col="valor_atual">Atual</SortHeader>
                      <SortHeader col="rentab">Rentab. R$</SortHeader>
                      <TableHead>Rentab. %</TableHead>
                      <TableHead>Liquidez</TableHead>
                      <TableHead>Cotação</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedInvestimentos.map(inv => {
                      const rentR = Number(inv.valor_atual || 0) - Number(inv.total_aportado || 0);
                      const rentP = Number(inv.total_aportado) > 0
                        ? (rentR / Number(inv.total_aportado)) * 100
                        : 0;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {inv.is_reserva_emergencia && (
                                <span title="Reserva de Emergência" className="text-base">🐷</span>
                              )}
                              <div className="min-w-0">
                                {inv.ticker ? (
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono font-bold text-sm">{inv.ticker}</span>
                                      <Badge variant="outline" className="text-[9px] rounded-md">{inv.classe}</Badge>
                                      {inv.recebe_proventos && (
                                        <Badge variant="secondary" className="text-[9px] rounded-md">Proventos</Badge>
                                      )}
                                    </div>
                                    {inv.nome && inv.nome !== inv.ticker && (
                                      <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 truncate max-w-[200px]">
                                        {inv.nome}
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-medium text-sm">{inv.nome || "—"}</span>
                                      <Badge variant="outline" className="text-[9px] rounded-md">{inv.classe}</Badge>
                                      {inv.recebe_proventos && (
                                        <Badge variant="secondary" className="text-[9px] rounded-md">Proventos</Badge>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{inv.tipo}</TableCell>
                          <TableCell className="text-xs">{inv.instituicao || "—"}</TableCell>
                          <TableCell className="text-xs">{fmt(Number(inv.total_aportado || 0))}</TableCell>
                          <TableCell className="text-xs font-medium">
                            {(() => {
                              const tickerUp = inv.ticker?.toUpperCase();
                              const q = tickerUp ? quotes[tickerUp] : null;
                              if (inv.tipo === "Exterior" && q?.preco_atual && Number(inv.quantidade) > 0) {
                                const posUSD = q.preco_atual * Number(inv.quantidade);
                                return <span>US$ {posUSD.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>;
                              }
                              return <span>{fmt(Number(inv.valor_atual || 0))}</span>;
                            })()}
                          </TableCell>
                          <TableCell className={`text-xs font-medium ${rentR >= 0 ? "text-success" : "text-destructive"}`}>
                            {fmt(rentR)}
                          </TableCell>
                          <TableCell className={`text-xs font-medium ${rentP >= 0 ? "text-success" : "text-destructive"}`}>
                            {pct(rentP)}
                          </TableCell>
                          <TableCell className="text-xs">{inv.liquidez || "—"}</TableCell>
                          <TableCell>
                            {inv.ticker ? (() => {
                              const q = quotes[inv.ticker.toUpperCase()];
                              if (quotesLoading && !q) return <span className="text-xs text-muted-foreground">...</span>;
                              if (!q) return <span className="text-xs text-muted-foreground">—</span>;
                              return (
                                <div className="flex flex-col">
                                  <span className="text-xs font-bold">
                                    {q.preco_atual != null
                                      ? `${inv.tipo === "Exterior" ? "US$" : "R$"} ${Number(q.preco_atual).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                      : "—"}
                                  </span>
                                  {q.variacao_pct != null && (
                                    <span className={`text-[10px] font-medium ${q.variacao_pct >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                                      {q.variacao_pct >= 0 ? "+" : ""}{Number(q.variacao_pct).toFixed(2)}%
                                    </span>
                                  )}
                                </div>
                              );
                            })() : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-1 justify-end">
                              <button
                                onClick={() => {
                                  setTxForm({
                                    investimento_id: inv.id,
                                    tipo: "compra",
                                    data: new Date().toISOString().split("T")[0],
                                    quantidade: 0,
                                    preco_unitario: quotes[inv.ticker?.toUpperCase() || ""]?.preco_atual || 0,
                                    observacao: "",
                                  });
                                  setTxOpen(true);
                                }}
                                className="p-1.5 sm:p-1 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
                                title="Registrar compra"
                                aria-label="Registrar compra"
                              >
                                <ShoppingCart className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-emerald-600" />
                              </button>
                              <button
                                onClick={() => {
                                  setTxForm({
                                    investimento_id: inv.id,
                                    tipo: "venda",
                                    data: new Date().toISOString().split("T")[0],
                                    quantidade: 0,
                                    preco_unitario: quotes[inv.ticker?.toUpperCase() || ""]?.preco_atual || 0,
                                    observacao: "",
                                  });
                                  setTxOpen(true);
                                }}
                                className="p-1.5 sm:p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                                title="Registrar venda"
                                aria-label="Registrar venda"
                              >
                                <TrendingDown className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-destructive" />
                              </button>
                              {TIPOS_MANUAIS.includes(inv.tipo) && (
                                <button
                                  onClick={() => openRendDialog(inv)}
                                  className="p-1.5 sm:p-1 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                                  title="Atualizar rendimento do mês"
                                  aria-label="Atualizar rendimento do mês"
                                >
                                  <Percent className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-amber-600" />
                                </button>
                              )}
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 sm:h-7 sm:w-7"
                                aria-label="Editar investimento"
                                onClick={() => handleEdit(inv)}
                              >
                                <Pencil className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon"
                                className="h-8 w-8 sm:h-7 sm:w-7 text-destructive/60 hover:text-destructive"
                                aria-label="Excluir investimento"
                                onClick={() => handleDelete(inv.id)}
                              >
                                <Trash2 className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {investimentos.length > 0 && (
                <div className="flex justify-end pt-3 mt-3 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setZerarOpen(true)}
                    className="text-destructive hover:bg-destructive/10 gap-2"
                  >
                    <Trash className="h-4 w-4" />
                    Excluir Carteira
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={txOpen} onOpenChange={setTxOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {txForm.tipo === "compra" ? "Registrar Compra" : "Registrar Venda"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Ativo</Label>
              <Select value={txForm.investimento_id} onValueChange={v => setTxForm({ ...txForm, investimento_id: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione o ativo" /></SelectTrigger>
                <SelectContent>
                  {investimentos.map(i => (
                    <SelectItem key={i.id} value={i.id}>{i.nome}{i.ticker ? ` (${i.ticker})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={txForm.tipo} onValueChange={v => setTxForm({ ...txForm, tipo: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compra">Compra</SelectItem>
                  <SelectItem value="venda">Venda</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data</Label>
                <Input type="date" value={txForm.data}
                  onChange={e => setTxForm({ ...txForm, data: e.target.value })}
                  className="rounded-xl" />
              </div>
              <div>
                <Label>Quantidade</Label>
                <Input type="number" min={0} value={txForm.quantidade || ""}
                  onChange={e => setTxForm({ ...txForm, quantidade: Math.max(0, +e.target.value) })}
                  className="rounded-xl" />
              </div>
            </div>
            <div>
              <Label>Preço unitário (R$)</Label>
              <Input type="number" min={0} step="0.01" value={txForm.preco_unitario || ""}
                onChange={e => setTxForm({ ...txForm, preco_unitario: Math.max(0, +e.target.value) })}
                className="rounded-xl" />
              {txForm.quantidade > 0 && txForm.preco_unitario > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total: R$ {(txForm.quantidade * txForm.preco_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>
            {txForm.tipo === "venda" && txForm.quantidade > 0 && txForm.preco_unitario > 0 && (() => {
              const inv = investimentos.find(i => i.id === txForm.investimento_id);
              if (!inv || !Number(inv.preco_medio)) return null;
              const precoMedio = Number(inv.preco_medio);
              const lucroUnit = txForm.preco_unitario - precoMedio;
              const lucroTotal = lucroUnit * txForm.quantidade;
              const ir = lucroTotal > 0 ? lucroTotal * 0.15 : 0;
              return (
                <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                  lucroTotal >= 0
                    ? "bg-emerald-50/30 border-emerald-200/40 dark:bg-emerald-950/20"
                    : "bg-destructive/5 border-destructive/20"
                }`}>
                  <p className="font-medium">Resultado estimado da operação</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-muted-foreground">
                    <span>Preço médio de compra:</span>
                    <span className="font-medium text-foreground">R$ {precoMedio.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    <span>Preço de venda:</span>
                    <span className="font-medium text-foreground">R$ {txForm.preco_unitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    <span>Lucro/Prejuízo total:</span>
                    <span className={`font-semibold ${lucroTotal >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                      {lucroTotal >= 0 ? "+" : ""}R$ {lucroTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    {ir > 0 && (
                      <>
                        <span>IR estimado (15%):</span>
                        <span className="font-semibold text-amber-600">R$ {ir.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                      </>
                    )}
                  </div>
                  {ir > 0 && (
                    <p className="text-[10px] text-muted-foreground italic">
                      Estimativa educacional. Não considera isenção até R$20k/mês nem compensação de prejuízos.
                    </p>
                  )}
                </div>
              );
            })()}
            <div>
              <Label>Observação</Label>
              <Input value={txForm.observacao}
                onChange={e => setTxForm({ ...txForm, observacao: e.target.value })}
                placeholder="Opcional" className="rounded-xl" />
            </div>
            <Button onClick={handleSubmitTx} className="rounded-xl">
              Confirmar {txForm.tipo === "compra" ? "Compra" : "Venda"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rendOpen} onOpenChange={(v) => { setRendOpen(v); if (!v) setRendInv(null); }}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <Percent className="h-4 w-4 text-amber-600" />
              Atualizar rendimento
            </DialogTitle>
          </DialogHeader>
          {rendInv && (
            <div className="space-y-3">
              <div className="rounded-xl bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Ativo</p>
                <p className="font-semibold text-sm">{rendInv.nome}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor atual:{" "}
                  <span className="font-semibold text-foreground">
                    R$ {Number(rendInv.valor_atual || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </p>
              </div>

              <div>
                <Label className="text-xs">Mês de referência</Label>
                <Input type="month" value={rendForm.mes_ano}
                  onChange={(e) => setRendForm({ ...rendForm, mes_ano: e.target.value })} />
              </div>

              <Tabs value={rendMode} onValueChange={(v) => setRendMode(v as "percent" | "delta" | "total")}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="percent" className="text-[11px] sm:text-xs px-1 sm:px-3">
                    <span className="sm:hidden">%</span>
                    <span className="hidden sm:inline">% do mês</span>
                  </TabsTrigger>
                  <TabsTrigger value="delta" className="text-[11px] sm:text-xs px-1 sm:px-3">
                    <span className="sm:hidden">R$ rendeu</span>
                    <span className="hidden sm:inline">R$ rendeu</span>
                  </TabsTrigger>
                  <TabsTrigger value="total" className="text-[11px] sm:text-xs px-1 sm:px-3">
                    <span className="sm:hidden">Saldo</span>
                    <span className="hidden sm:inline">Saldo atual</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="percent" className="space-y-2 mt-3">
                  <Label className="text-xs">Quanto rendeu no mês (%)</Label>
                  <Input type="text" inputMode="decimal" placeholder="Ex: 1.12"
                    value={rendForm.percentual}
                    onChange={(e) => setRendForm({ ...rendForm, percentual: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">
                    Use vírgula ou ponto. Negativo se houve perda (ex: -0.5)
                  </p>
                </TabsContent>

                <TabsContent value="delta" className="space-y-2 mt-3">
                  <Label className="text-xs">Quanto rendeu no mês (R$)</Label>
                  <Input type="text" inputMode="decimal" placeholder="Ex: 340.00"
                    value={rendForm.delta}
                    onChange={(e) => setRendForm({ ...rendForm, delta: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">
                    Apenas o ganho/perda do mês. Negativo se houve perda (ex: -50)
                  </p>
                </TabsContent>

                <TabsContent value="total" className="space-y-2 mt-3">
                  <Label className="text-xs">Saldo total atual (R$)</Label>
                  <Input type="text" inputMode="decimal" placeholder="Ex: 30340.00"
                    value={rendForm.valor_novo}
                    onChange={(e) => setRendForm({ ...rendForm, valor_novo: e.target.value })} />
                  <p className="text-[11px] text-muted-foreground">
                    Valor TOTAL que aparece hoje no extrato da corretora
                  </p>
                </TabsContent>
              </Tabs>

              <div>
                <Label className="text-xs">Observação (opcional)</Label>
                <Input placeholder="Ex: Ajuste pelo CDI"
                  value={rendForm.observacao}
                  onChange={(e) => setRendForm({ ...rendForm, observacao: e.target.value })} />
              </div>

              {previewValorNovo != null && previewPctReal != null && (
                <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-1">
                  <p className="text-[11px] text-muted-foreground uppercase">Preview</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      R$ {Number(rendInv.valor_atual || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-bold">
                      R$ {previewValorNovo.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className={`text-xs font-semibold ${previewPctReal >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {previewPctReal >= 0 ? "+" : ""}{previewPctReal.toFixed(2)}% no mês{" "}
                    ({previewPctReal >= 0 ? "+" : ""}R$ {(previewValorNovo - Number(rendInv.valor_atual || 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })})
                  </p>
                </div>
              )}

              <Button onClick={handleSubmitRendimento} className="w-full rounded-xl"
                disabled={previewValorNovo == null}>
                Salvar rendimento
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={zerarOpen} onOpenChange={(v) => {
        if (!zerarDeleting) {
          setZerarOpen(v);
          if (!v) setZerarConfirmText("");
        }
      }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir Carteira Completa
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-2">
              <p className="text-sm font-medium text-destructive">
                Esta ação é irreversível.
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Serão apagados permanentemente:
              </p>
              <ul className="text-xs text-muted-foreground space-y-0.5 ml-4 list-disc">
                <li><strong>{investimentos.length}</strong> ativo{investimentos.length !== 1 ? "s" : ""} cadastrado{investimentos.length !== 1 ? "s" : ""}</li>
                <li>Todos os proventos recebidos (dividendos, JCP, rendimentos)</li>
                <li>Todos os aportes registrados</li>
                <li>Todas as transações de compra/venda</li>
                <li>Todo o histórico de patrimônio mensal</li>
                <li>Todas as atualizações manuais de rendimento</li>
              </ul>
              <p className="text-[11px] text-muted-foreground italic pt-1">
                O histórico de importações fica registrado para auditoria.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">
                Para confirmar, digite <strong className="text-destructive font-mono">{ZERAR_PHRASE}</strong> abaixo:
              </Label>
              <Input
                value={zerarConfirmText}
                onChange={(e) => setZerarConfirmText(e.target.value)}
                placeholder={ZERAR_PHRASE}
                disabled={zerarDeleting}
                autoComplete="off"
                spellCheck={false}
                className="rounded-xl font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl"
                onClick={() => { setZerarOpen(false); setZerarConfirmText(""); }}
                disabled={zerarDeleting}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-xl"
                onClick={handleZerarCarteira}
                disabled={!zerarMatchesPhrase || zerarDeleting}
              >
                {zerarDeleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash className="h-4 w-4 mr-2" />
                    Excluir Carteira
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
