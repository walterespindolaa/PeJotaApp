import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Legend, BarChart, Bar } from "recharts";
import { DollarSign, Users, TrendingUp, Percent } from "lucide-react";
import { useI18n } from "@/contexts/I18nContext";


type Sub = { status: string; source: string; created_at: string; end_at: string };

const AdminRevenue = () => {
  const { fmt, fmtShort } = useI18n();
  const { toast } = useToast();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable parameters
  const [ticketMedio, setTicketMedio] = useState(297);
  const [churnPct, setChurnPct] = useState(5);
  const [crescimentoMensal, setCrescimentoMensal] = useState(10);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "revenue_data" },
      });
      if (error) {
        toast({ title: "Erro ao carregar dados de faturamento", variant: "destructive" });
      } else {
        setSubs(data?.subs || []);
      }
      setLoading(false);
    })();
  }, [toast]);

  const ativos = subs.filter(s => s.status === "active").length;
  const receitaMensal = ativos * ticketMedio;
  const receitaAnual = receitaMensal * 12;

  // Monthly new users (last 12 months)
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { mes: string; novos: number; receita: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      const novos = subs.filter(s => s.created_at?.startsWith(mesKey)).length;
      const ativosNoMes = subs.filter(s => {
        const createdAt = new Date(s.created_at);
        return createdAt <= new Date(d.getFullYear(), d.getMonth() + 1, 0) && s.status === "active";
      }).length;
      months.push({ mes: label, novos, receita: ativosNoMes * ticketMedio });
    }
    return months;
  }, [subs, ticketMedio]);

  // Future projection (12 months)
  const projectionData = useMemo(() => {
    const now = new Date();
    let currentAtivos = ativos;
    const data: { mes: string; receita: number; usuarios: number }[] = [];
    for (let i = 1; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const label = d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
      // Apply churn and growth
      const churnLoss = Math.round(currentAtivos * (churnPct / 100));
      const growth = Math.round(currentAtivos * (crescimentoMensal / 100));
      // Expiring subs
      const expiring = subs.filter(s => {
        const endAt = new Date(s.end_at);
        return endAt.getFullYear() === d.getFullYear() && endAt.getMonth() === d.getMonth() && s.status === "active";
      }).length;
      currentAtivos = Math.max(0, currentAtivos - churnLoss - expiring + growth);
      data.push({ mes: label, receita: currentAtivos * ticketMedio, usuarios: currentAtivos });
    }
    return data;
  }, [ativos, churnPct, crescimentoMensal, subs, ticketMedio]);

  const chartConfig = { novos: { label: "Novos", color: "hsl(var(--primary))" }, receita: { label: "Receita", color: "hsl(var(--success))" }, usuarios: { label: "Usuários", color: "hsl(var(--info))" } };

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Users, label: "Usuários Ativos", value: String(ativos), color: "bg-primary/10 text-primary" },
          { icon: DollarSign, label: "Receita Mensal", value: fmt(receitaMensal), color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
          { icon: TrendingUp, label: "Receita Anual", value: fmt(receitaAnual), color: "bg-accent text-accent-foreground" },
          { icon: Percent, label: "Churn Estimado", value: `${churnPct}%`, color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
        ].map((kpi, i) => (
          <Card key={i} className="shadow-soft rounded-2xl">
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-lg font-heading font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Editable params */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base">Parâmetros Editáveis</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs">Ticket Médio (R$/mês)</Label>
              <Input type="number" min={0} value={ticketMedio} onChange={e => setTicketMedio(Math.max(0, +e.target.value))} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-xs">Churn Mensal (%)</Label>
              <Input type="number" min={0} max={100} value={churnPct} onChange={e => setChurnPct(Math.max(0, Math.min(100, +e.target.value)))} className="rounded-xl mt-1" />
            </div>
            <div>
              <Label className="text-xs">Crescimento Mensal (%)</Label>
              <Input type="number" min={0} value={crescimentoMensal} onChange={e => setCrescimentoMensal(Math.max(0, +e.target.value))} className="rounded-xl mt-1" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* New users line chart */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base">Fluxo de Novos Usuários (12 meses)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="novos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Revenue line chart */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base">Receita Mensal Histórica</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <LineChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value) => fmt(Number(value))} />} />
                <Line type="monotone" dataKey="receita" stroke="hsl(var(--success))" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>

      {/* Future projection */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base">Projeção Futura (12 meses)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <LineChart data={projectionData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={v => fmtShort(v)} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent formatter={(value, name) => name === "receita" ? fmt(Number(value)) : String(value)} />} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="receita" stroke="hsl(var(--success))" strokeWidth={2} dot={false} name="Receita" />
                <Line yAxisId="right" type="monotone" dataKey="usuarios" stroke="hsl(var(--info))" strokeWidth={2} dot={false} name="Usuários" />
              </LineChart>
            </ChartContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminRevenue;
