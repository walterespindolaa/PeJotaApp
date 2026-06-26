import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, TrendingUp, TrendingDown, Wallet, PiggyBank, CalendarCheck, Target, AlertTriangle, CreditCard, ShoppingCart, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import ExtratosBancariosCard from "./ExtratosBancariosCard";
import ChecklistMensal from "./ChecklistMensal";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useState, useMemo } from "react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import type { Despesa, Receita } from "@/hooks/useOrganiza";
import { useExpenseSkips } from "@/hooks/useExpenseSkips";

interface Props {
  totalGanhos: number;
  ganhosRecebidos: number;
  totalFixas: number;
  totalVariaveis: number;
  totalParcelas: number;
  totalDespesas: number;
  totalEconomias: number;
  economiasPlanejadas: number;
  totalDividas: number;
  totalDividasRestante: number;
  saldoDisponivel: number;
  saldoReal: number;
  saldoPrevisto: number;
  despesasPagas: number;
  despesaCorrente: number;
  despesaCorrentePaga: number;
  taxaPoupanca: number;
  taxaPoupancaReal: number;
  grauCompromisso: number;
  grauCompromissoReal: number;
  grauCompromissoPrev: number;
  mesAno: string;
  historico: { mes: string; receitas: number; despesas: number; parcelas: number; economias: number; saldo: number }[];
  despesas: Despesa[];
  receitas: Receita[];
  anuais: { totalReceitas: number; totalDespesas: number; totalEconomias: number; saldo: number; mediaReceitas: number; mediaDespesas: number; mediaEconomias: number; mediaSaldo: number };
  orcamentoPorCategoria: { categoria: string; gasto: number; limite: number; percentual: number }[];
  projecaoParcelas: { mes: string; valor: number }[];
  mesesAteZerarParcelas: number;
  planejadoTotal: number;
  dentroDoPlanejado: boolean;
  periodo: string;
  onUpsertOrcamento: (categoria: string, valor: number) => Promise<void>;
  onNavigateTab: (tab: string) => void;
}

const TabGerais = ({
  totalGanhos, ganhosRecebidos, totalFixas, totalVariaveis, totalParcelas,
  totalDespesas, totalEconomias, economiasPlanejadas, totalDividas, totalDividasRestante,
  saldoDisponivel, saldoReal, saldoPrevisto, despesasPagas,
  despesaCorrente, despesaCorrentePaga,
  taxaPoupanca, taxaPoupancaReal,
  grauCompromisso, grauCompromissoReal, grauCompromissoPrev,
  mesAno,
  historico, despesas, receitas, anuais,
  orcamentoPorCategoria, projecaoParcelas, mesesAteZerarParcelas,
  planejadoTotal, dentroDoPlanejado, periodo,
  onUpsertOrcamento, onNavigateTab,
}: Props) => {
  const navigate = useNavigate();
  const { fmt, pct, isPrivate } = usePrivacyFmt();
  const { skips } = useExpenseSkips();
  const skipsThisMonth = skips.filter(s => s.month_ref === mesAno);
  const skipCount = skipsThisMonth.length;
  const [visao, setVisao] = useState<"mensal" | "anual">("mensal");
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetValue, setBudgetValue] = useState("");

  const [year, month] = mesAno.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const mesDestinoStr = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
  const mesLabel = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const summaryCards = [
    { label: "Ganhos", value: visao === "mensal" ? totalGanhos : anuais.totalReceitas, icon: TrendingUp, color: "text-success", tab: "ganhos", subtitleValue: ganhosRecebidos < totalGanhos ? ganhosRecebidos : null, subtitleLabel: "Recebido" },
    { label: "Despesas", value: visao === "mensal" ? despesaCorrente : anuais.totalDespesas, icon: TrendingDown, color: "text-destructive", tab: "fixas", subtitleValue: despesaCorrentePaga < despesaCorrente ? despesaCorrentePaga : null, subtitleLabel: "Pago", extraNote: skipCount > 0 ? `${skipCount} pulado${skipCount > 1 ? "s" : ""} este mês` : null },
    { label: "Parcelamentos", value: totalParcelas, icon: ShoppingCart, color: "text-info", tab: "parcelas", subtitleValue: null, subtitleLabel: "", extraNote: skipCount > 0 ? `${skipCount} pulado${skipCount > 1 ? "s" : ""} este mês` : null },
    { label: "Dívidas", value: totalDividas, icon: CreditCard, color: "text-warning", tab: "dividas", subtitleValue: totalDividasRestante > 0 ? totalDividasRestante : null, subtitleLabel: "Total restante" },
    { label: "Economias", value: visao === "mensal" ? totalEconomias : anuais.totalEconomias, icon: PiggyBank, color: "text-info", tab: "economias", subtitleValue: economiasPlanejadas > 0 && economiasPlanejadas !== totalEconomias ? economiasPlanejadas : null, subtitleLabel: "Planejado" },
    { label: "Saldo Disponível", value: visao === "mensal" ? saldoPrevisto : anuais.saldo, icon: Wallet, color: saldoPrevisto >= 0 ? "text-success" : "text-destructive", highlight: true, tab: "gerais", subtitleValue: ganhosRecebidos > 0 && saldoReal !== saldoPrevisto ? saldoReal : null, subtitleLabel: "Real" },
  ];

  const categoryVsReceita = useMemo(() => {
    if (totalGanhos <= 0) return [];
    const map: Record<string, number> = {};
    despesas.forEach(d => { const cat = d.categoria || "Outros"; map[cat] = (map[cat] || 0) + Number(d.valor); });
    return Object.entries(map)
      .map(([name, valor]) => ({ name, valor, pct: (valor / totalGanhos) * 100 }))
      .sort((a, b) => b.pct - a.pct).slice(0, 8);
  }, [despesas, totalGanhos]);

  const categoryRanking = useMemo(() => {
    const map: Record<string, number> = {};
    despesas.forEach(d => { const cat = d.categoria || "Outros"; map[cat] = (map[cat] || 0) + Number(d.valor); });
    return Object.entries(map).map(([name, valor]) => ({ name, valor })).sort((a, b) => b.valor - a.valor).slice(0, 8);
  }, [despesas]);

  const handleSaveBudget = async (cat: string) => {
    const val = parseFloat(budgetValue);
    if (!isNaN(val) && val > 0) await onUpsertOrcamento(cat, val);
    setEditingBudget(null);
    setBudgetValue("");
  };

  const getBudgetTextColor = (pctVal: number) => {
    if (pctVal <= 80) return "text-success";
    if (pctVal <= 100) return "text-warning";
    return "text-destructive";
  };

  const parcelasAtivas = useMemo(() => {
    return despesas
      .filter(d => d.is_parcelada && (d.total_parcelas || 0) > 1)
      .map(d => ({
        descricao: d.descricao || d.categoria || "Parcela",
        valorTotal: Number(d.valor_total || 0),
        parcelaAtual: Number(d.parcela_atual || 1),
        totalParcelas: Number(d.total_parcelas || 1),
        valorParcela: Number(d.valor),
        restantes: Math.max(0, (Number(d.total_parcelas) || 1) - (Number(d.parcela_atual) || 1)),
      }));
  }, [despesas]);

  // Privacy-aware tooltip formatter for charts
  const tooltipFmt = (v: number) => fmt(v);

  return (
    <div className="space-y-8">
      {/* Month status banner + toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-muted/50 border border-border/50">
        <div className="flex items-center gap-2">
          <CalendarCheck className="h-4 w-4 text-primary" />
          <span className="text-sm font-heading font-medium capitalize">{mesLabel}</span>
          {periodo !== "mes" && <Badge variant="outline" className="text-[10px] border-info text-info">Período: {periodo === "3m" ? "3 meses" : periodo === "6m" ? "6 meses" : periodo === "12m" ? "12 meses" : periodo === "24m" ? "24 meses" : "Desde início"}</Badge>}
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-0.5">
          <button onClick={() => setVisao("mensal")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${visao === "mensal" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Mensal</button>
          <button onClick={() => setVisao("anual")} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${visao === "anual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Anual</button>
        </div>
      </div>

      {/* Reality indicator */}
      {planejadoTotal > 0 && (
        <div className={`flex items-center gap-2 p-3 rounded-xl border ${dentroDoPlanejado ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
          {dentroDoPlanejado ? (
            <><CheckCircle2 className="h-5 w-5 text-success" /><span className="text-sm font-medium text-success">Você está dentro do planejado este mês!</span></>
          ) : (
            <><AlertTriangle className="h-5 w-5 text-destructive" /><span className="text-sm font-medium text-destructive">Gastos acima do planejado! ({fmt(totalDespesas)} de {fmt(planejadoTotal)})</span></>
          )}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {summaryCards.map(c => (
          <Card
            key={c.label}
            className={`shadow-soft cursor-pointer transition-all hover:shadow-card ${"highlight" in c && c.highlight ? "ring-2 ring-primary/20" : ""}`}
            onClick={() => c.tab && onNavigateTab(c.tab)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <c.icon className={`h-4 w-4 ${c.color}`} />
                <span className="text-[11px] text-muted-foreground font-medium">{c.label}</span>
              </div>
              <p className={`text-lg font-heading font-bold ${c.color}`}>{fmt(c.value)}</p>
              {c.subtitleValue !== null && c.subtitleValue !== undefined && (
                <p className="text-[10px] text-muted-foreground mt-1">{c.subtitleLabel}: {fmt(c.subtitleValue)}</p>
              )}
              {(c as any).extraNote && (
                <p className="text-[10px] text-muted-foreground mt-0.5 italic">{(c as any).extraNote}</p>
              )}
              {visao === "anual" && !["Dívidas", "Saldo Disponível", "Parcelamentos"].includes(c.label) && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Média: {fmt(c.label === "Ganhos" ? anuais.mediaReceitas : c.label === "Despesas" ? anuais.mediaDespesas : anuais.mediaEconomias)}/mês
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ═══ LINHA 1: Gastos sobre Receita + Checklist ═══ */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Gastos sobre Receita */}
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle
              className="text-base font-heading flex items-center gap-2 cursor-pointer group hover:text-primary transition-colors"
              onClick={() => navigate("/dashboard/analises")}
            >
              <Target className="h-4 w-4 text-primary" />
              <span className="group-hover:underline underline-offset-2">Gastos sobre Receita</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary ml-auto transition-colors" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-3 mb-4 rounded-lg bg-muted/50 border border-border/50 text-center">
              <p className="text-xs text-muted-foreground">Receita Total do Mês</p>
              <p className="text-xl font-heading font-bold text-success">{fmt(totalGanhos)}</p>
            </div>
            {categoryVsReceita.length > 0 ? (
              <div className="space-y-3">
                {categoryVsReceita.map(cat => (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{cat.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-heading font-bold">{pct(cat.pct, 1)}</span>
                        <span className="text-[10px] text-muted-foreground">{fmt(cat.valor)}</span>
                      </div>
                    </div>
                    <div className="h-2.5 w-full bg-secondary rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(cat.pct, 100)}%`,
                          backgroundColor: cat.pct > 30 ? "hsl(var(--destructive))" : cat.pct > 20 ? "hsl(var(--warning))" : "hsl(var(--primary))",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Target className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Registre receitas e despesas para visualizar.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Checklist customizável */}
        <ChecklistMensal mesAno={mesAno} />
      </div>

      {/* ═══ LINHA 2: Grau de Compromisso + Projeção de Parcelas ═══ */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Grau de Compromisso */}
        <Card className="shadow-soft">
          <CardContent className="p-5 space-y-5">
            <div>
              <p className="text-sm font-heading font-semibold mb-1">Grau de Compromisso</p>
              <p className="text-xs text-muted-foreground mb-3">
                O Grau de Compromisso representa o percentual da sua renda já comprometido com despesas fixas, parcelamentos e obrigações recorrentes. Quanto menor, maior sua margem de segurança.
              </p>
              <div className="flex items-baseline gap-3 mb-2">
                <p className={`text-3xl font-heading font-bold ${grauCompromissoPrev <= 70 ? "text-success" : grauCompromissoPrev <= 90 ? "text-warning" : "text-destructive"}`}>
                  {pct(grauCompromissoPrev, 1)}
                </p>
                <span className="text-xs text-muted-foreground">previsto</span>
                {grauCompromissoReal > 0 && grauCompromissoReal !== grauCompromissoPrev && (
                  <span className="text-xs text-muted-foreground/70">| Real: {pct(grauCompromissoReal, 1)}</span>
                )}
              </div>
              <div className="h-3 w-full bg-secondary rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${grauCompromissoPrev <= 70 ? "bg-success" : grauCompromissoPrev <= 90 ? "bg-warning" : "bg-destructive"}`}
                  style={{ width: `${Math.min(grauCompromissoPrev, 100)}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                {grauCompromissoPrev <= 70 ? "Saudável — sobra margem para investir" : grauCompromissoPrev <= 90 ? "Atenção — pouca margem livre" : "Comprometido — gastos acima de 90% da receita"}
              </p>
            </div>
            <div className="border-t border-border pt-4">
              <p className="text-sm font-heading font-semibold">Taxa de Poupança</p>
              <div className="flex items-baseline gap-3 mt-1">
                <p className={`text-2xl font-heading font-bold ${taxaPoupancaReal >= 20 ? "text-success" : taxaPoupancaReal >= 0 ? "text-warning" : "text-destructive"}`}>
                  {pct(taxaPoupancaReal, 1)}
                </p>
                <span className="text-sm text-muted-foreground">{fmt(totalEconomias)}</span>
              </div>
              {taxaPoupanca > 0 && taxaPoupanca !== taxaPoupancaReal && (
                <p className="text-xs text-muted-foreground mt-0.5">Previsto: {pct(taxaPoupanca, 1)} — {fmt(economiasPlanejadas)}</p>
              )}
              <p className="text-[10px] text-muted-foreground mt-1">Meta ideal: poupar pelo menos 20% da receita líquida.</p>
            </div>
          </CardContent>
        </Card>

        {/* Extratos Bancários */}
        <ExtratosBancariosCard />
      </div>

      {/* ═══ LINHA 3: Ranking de Categorias + % Gastos/Receita ═══ */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Ranking de Categorias</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryRanking.length > 0 ? (
              <div className="space-y-3">
                {categoryRanking.map((cat, i) => {
                  const maxVal = categoryRanking[0]?.valor || 1;
                  const pctVal = (cat.valor / maxVal) * 100;
                  return (
                    <div key={cat.name} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">{cat.name}</span>
                        <span className="text-xs font-heading font-bold group-hover:text-primary transition-colors">{fmt(cat.valor)}</span>
                      </div>
                      <div className="h-4 w-full bg-secondary rounded-full overflow-hidden">
                        <div className="h-full bg-primary/70 rounded-full transition-all" style={{ width: `${pctVal}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Nenhuma despesa registrada.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">% Gastos / Receita</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryVsReceita.length > 0 ? (
              <div className="space-y-3">
                {categoryVsReceita.map(cat => (
                  <div key={cat.name} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{cat.name}</span>
                      <span className="text-xs font-heading font-bold group-hover:text-accent transition-colors">{pct(cat.pct, 1)}</span>
                    </div>
                    <div className="h-4 w-full bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-accent/70 rounded-full transition-all" style={{ width: `${Math.min(cat.pct, 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{fmt(cat.valor)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Registre receitas e despesas para ver este gráfico.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Resumo do Mês (barras) */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Resumo do Mês — <span className="capitalize">{mesLabel}</span></CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={[{
              name: "Mês Atual",
              Receita: totalGanhos,
              Despesas: totalFixas + totalVariaveis,
              Parcelamentos: totalParcelas,
              Economias: totalEconomias,
              Saldo: saldoPrevisto,
            }]} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => isPrivate ? "••••" : `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => tooltipFmt(v)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Parcelamentos" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Economias" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saldo" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ═══ Controle de Parcelamentos ═══ */}
      <Card className="shadow-soft">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle
              className="text-base font-heading flex items-center gap-2 cursor-pointer group hover:text-primary transition-colors"
              onClick={() => onNavigateTab("parcelas")}
            >
              <ShoppingCart className="h-4 w-4 text-warning" />
              <span className="group-hover:underline underline-offset-2">Controle de Parcelamentos</span>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
            </CardTitle>
            {projecaoParcelas.length > 0 && (
              <Badge variant="outline" className="text-[10px]">{mesesAteZerarParcelas} {mesesAteZerarParcelas === 1 ? "mês" : "meses"}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {projecaoParcelas.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={projecaoParcelas}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => isPrivate ? "••••" : `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => tooltipFmt(v)} />
                  <Bar dataKey="valor" name="Comprometido" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-muted-foreground text-center">Total comprometido: {fmt(projecaoParcelas.reduce((s, p) => s + p.valor, 0))}</p>

              {parcelasAtivas.length > 0 && (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-heading font-semibold text-muted-foreground">Parcelamentos ativos</p>
                  {parcelasAtivas.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.descricao}</p>
                        <p className="text-muted-foreground">{p.parcelaAtual}/{p.totalParcelas} — {p.restantes} restantes</p>
                      </div>
                      <p className="font-heading font-bold ml-2">{fmt(p.valorParcela)}/mês</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-6">
              <ShoppingCart className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma parcela ativa.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Annual summary cards */}
      {visao === "anual" && (
        <Card className="shadow-soft">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Resumo Anual {year}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div><p className="text-xs text-muted-foreground">Média Receitas/mês</p><p className="text-lg font-heading font-bold text-success">{fmt(anuais.mediaReceitas)}</p></div>
              <div><p className="text-xs text-muted-foreground">Média Despesas/mês</p><p className="text-lg font-heading font-bold text-destructive">{fmt(anuais.mediaDespesas)}</p></div>
              <div><p className="text-xs text-muted-foreground">Média Economias/mês</p><p className="text-lg font-heading font-bold text-info">{fmt(anuais.mediaEconomias)}</p></div>
              <div><p className="text-xs text-muted-foreground">Média Saldo/mês</p><p className={`text-lg font-heading font-bold ${anuais.mediaSaldo >= 0 ? "text-success" : "text-destructive"}`}>{fmt(anuais.mediaSaldo)}</p></div>
            </div>
          </CardContent>
        </Card>
      )}

    </div>
  );
};

export default TabGerais;
