import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Wallet, ArrowUpCircle, ArrowDownCircle, TrendingUp, Receipt, Filter, FileText, Building2, AlertTriangle, Sparkles, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { resumoMes, saldoCaixa, totaisReceberPagar, statusVencimento, type Tx, type Bill } from "@/lib/pejota/businessFinance";

const db = supabase as any;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
const today = () => format(new Date(), "yyyy-MM-dd");
const thisMonth = () => format(new Date(), "yyyy-MM");

export default function PejotaDashboard() {
  const { selected, loading: companiesLoading } = useCompanies();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [bills, setBills] = useState<(Bill & { description: string; due_date: string | null })[]>([]);
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<string>("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  const gerarInsights = useCallback(async () => {
    if (!selected) return;
    setLoadingInsights(true);
    const { data, error } = await supabase.functions.invoke("pejota-copilot", {
      body: { company_id: selected.id, messages: [{ role: "user", content: "Analise a saúde financeira da empresa com os dados que você tem e me dê de 2 a 4 insights curtos e acionáveis, cada um começando com '• '. Foque em caixa, contas a vencer/atrasadas, margem e tendência. Seja específico com números e não invente dados." }] },
    });
    setLoadingInsights(false);
    setInsights(error || data?.error ? "Não consegui gerar agora. Verifique se a IA está configurada." : (data.reply || ""));
  }, [selected]);

  const load = useCallback(async () => {
    if (!selected) { setTxs([]); setBills([]); return; }
    setLoading(true);
    const [txRes, billRes] = await Promise.all([
      db.from("business_transactions").select("date, amount, direction, category_id").eq("company_id", selected.id).order("date", { ascending: false }).limit(5000),
      db.from("business_bills").select("kind, amount, status, due_date, description").eq("company_id", selected.id).eq("status", "pendente"),
    ]);
    setTxs((txRes.data || []) as Tx[]);
    setBills((billRes.data || []) as any[]);
    setLoading(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const mes = thisMonth();
  const resumo = resumoMes(txs, mes);
  const caixa = saldoCaixa(txs);
  const { aReceber, aPagar } = totaisReceberPagar(bills);
  const proximos = [...bills].filter(b => b.due_date).sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)).slice(0, 6);

  if (companiesLoading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando…</div>;

  if (!selected) return (
    <div className="max-w-xl mx-auto p-6">
      <Card><CardContent className="py-12 text-center">
        <Building2 className="w-10 h-10 mx-auto mb-3 text-primary" />
        <h2 className="text-lg font-heading font-semibold mb-1">Bem-vindo ao PeJota</h2>
        <p className="text-sm text-muted-foreground mb-5">Crie sua empresa para começar a controlar o caixa, vendas e estoque do seu negócio.</p>
        <Link to="/dashboard/negocios"><Button>Criar minha empresa</Button></Link>
      </CardContent></Card>
    </div>
  );

  const kpis = [
    { label: "Saldo em caixa", value: brl(caixa), icon: Wallet, cls: "text-primary" },
    { label: "A receber", value: brl(aReceber), icon: ArrowUpCircle, cls: "text-emerald-600", to: "/dashboard/contas-receber" },
    { label: "A pagar", value: brl(aPagar), icon: ArrowDownCircle, cls: "text-destructive", to: "/dashboard/contas-pagar" },
    { label: "Resultado do mês", value: brl(resumo.resultado), icon: TrendingUp, cls: resumo.resultado >= 0 ? "text-emerald-600" : "text-destructive" },
  ];
  const atalhos = [
    { label: "Funil de vendas", icon: Filter, to: "/dashboard/negocios/funil" },
    { label: "Propostas", icon: FileText, to: "/dashboard/negocios/propostas" },
    { label: "Impostos", icon: Receipt, to: "/dashboard/impostos" },
    { label: "Lançar no caixa", icon: Wallet, to: "/dashboard/negocios" },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">
      <div>
        <h1 className="text-xl font-heading font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground capitalize">{selected.name} · {format(new Date(), "MMMM yyyy")}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map(k => {
          const inner = (
            <div className="bg-card border rounded-xl p-4 h-full">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <k.icon className={`w-4 h-4 ${k.cls}`} />
              </div>
              <p className={`text-2xl font-semibold mt-2 ${k.cls}`}>{loading ? "—" : k.value}</p>
            </div>
          );
          return k.to ? <Link key={k.label} to={k.to} className="block hover:opacity-90 transition-opacity">{inner}</Link> : <div key={k.label}>{inner}</div>;
        })}
      </div>

      {/* Insights da IA */}
      <Card><CardContent className="p-5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm font-medium flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Insights da IA</p>
          <Button size="sm" variant="outline" onClick={gerarInsights} disabled={loadingInsights} className="gap-2">
            {loadingInsights ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {insights ? "Atualizar" : "Gerar insights"}
          </Button>
        </div>
        {insights
          ? <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{insights}</p>
          : <p className="text-sm text-muted-foreground">Clique em “Gerar insights” para a IA analisar o caixa, contas e margem da empresa e sugerir os próximos passos.</p>}
      </CardContent></Card>

      {/* Receita x Despesa do mês */}
      <Card><CardContent className="p-5">
        <p className="text-sm font-medium mb-3">Mês atual</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xs text-muted-foreground">Receita</p><p className="text-lg font-semibold text-emerald-600">{brl(resumo.receita)}</p></div>
          <div><p className="text-xs text-muted-foreground">Despesa</p><p className="text-lg font-semibold text-destructive">{brl(resumo.despesa)}</p></div>
          <div><p className="text-xs text-muted-foreground">Margem</p><p className="text-lg font-semibold">{resumo.receita > 0 ? pct(resumo.margem) : "—"}</p></div>
        </div>
      </CardContent></Card>

      {/* Próximos vencimentos */}
      <Card><CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Próximos vencimentos</p>
          <Link to="/dashboard/contas-pagar" className="text-xs text-primary hover:underline">ver contas</Link>
        </div>
        {proximos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma conta pendente. 🎉</p>
        ) : (
          <div className="space-y-2">
            {proximos.map((b, i) => {
              const atrasado = statusVencimento(b.due_date, b.status, today()) === "atrasado";
              return (
                <div key={i} className="flex items-center justify-between text-sm border-b last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center gap-2">
                    {atrasado && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                    <span>{b.description}</span>
                    <Badge variant="secondary" className={b.kind === "receber" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}>{b.kind === "receber" ? "receber" : "pagar"}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{b.due_date ? format(new Date(b.due_date + "T00:00:00"), "dd/MM") : ""}</span>
                    <span className={`font-medium ${b.kind === "receber" ? "text-emerald-600" : "text-destructive"}`}>{brl(Number(b.amount || 0))}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent></Card>

      {/* Atalhos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {atalhos.map(a => (
          <Link key={a.label} to={a.to} className="flex flex-col items-center justify-center gap-2 rounded-xl border bg-card p-4 text-center hover:bg-muted/40 transition-colors">
            <a.icon className="w-5 h-5 text-primary" />
            <span className="text-xs font-medium">{a.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
