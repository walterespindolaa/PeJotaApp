import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { TrendingUp, Landmark, ArrowUpRight, Building2, BarChart3 } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";

const EvolucaoPatrimonial = () => {
  const { user } = useAuth();
  const { fmt, pct } = usePrivacyFmt();
  const [loading, setLoading] = useState(true);
  const [investimentos, setInvestimentos] = useState<any[]>([]);
  const [bens, setBens] = useState<any[]>([]);
  const [snapshots, setSnapshots] = useState<{ month_ref: string; total_value: number; total_contributions: number }[]>([]);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [invRes, bensRes, snapRes] = await Promise.all([
      supabase.from("investimentos_financeiros").select("*").eq("user_id", user.id).limit(1000),
      supabase.from("investimentos_nao_financeiros").select("*").eq("user_id", user.id).limit(1000),
      supabase.from("portfolio_snapshots").select("month_ref,total_value,total_contributions").eq("user_id", user.id).order("month_ref", { ascending: true }),
    ]);
    setInvestimentos(invRes.data || []);
    setBens(bensRes.data || []);
    setSnapshots((snapRes.data || []).map((s: any) => ({
      month_ref: s.month_ref,
      total_value: Number(s.total_value || 0),
      total_contributions: Number(s.total_contributions || 0),
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const totalFinanceiro = investimentos.reduce((s, i) => s + Number(i.valor_atual || i.valor || 0), 0);
  const totalAportado = investimentos.reduce((s, i) => s + Number(i.total_aportado || 0), 0);
  const totalBens = bens.reduce((s, b) => s + Number(b.valor || 0), 0);
  const totalDividas = bens.reduce((s, b) => s + Number(b.divida_vinculada || 0), 0);
  const bensLiquido = totalBens - totalDividas;
  const patrimonioTotal = totalFinanceiro + bensLiquido;
  const rendimento = totalFinanceiro - totalAportado;

  // Chart from real snapshots
  const chartData = useMemo(() => {
    if (snapshots.length === 0) return [];
    return snapshots.map(s => {
      const d = new Date(s.month_ref + "-15");
      return {
        mes: d.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        "Patrimônio Financeiro": Math.round(s.total_value),
      };
    });
  }, [snapshots]);

  const chartConfig = {
    "Patrimônio Financeiro": { label: "Patrimônio Financeiro", color: "hsl(var(--primary))" },
  };

  const hasSnapshots = chartData.length >= 2;

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-heading font-bold">Evolução Patrimonial</h1>
        <p className="text-muted-foreground text-sm mt-1">Consolidação histórica do seu patrimônio financeiro e não financeiro.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Patrimônio Total", value: fmt(patrimonioTotal), icon: Landmark, color: "text-primary" },
          { label: "Financeiro", value: fmt(totalFinanceiro), icon: TrendingUp, color: "text-success" },
          { label: "Bens e Imóveis", value: fmt(bensLiquido), icon: Building2, color: "text-foreground" },
          { label: "Rendimento Acum.", value: fmt(rendimento), icon: ArrowUpRight, color: rendimento >= 0 ? "text-success" : "text-destructive" },
        ].map((kpi, i) => (
          <Card key={i} className="shadow-soft rounded-2xl">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1"><kpi.icon className={`h-4 w-4 ${kpi.color}`} /><span className="text-xs text-muted-foreground">{kpi.label}</span></div>
              <p className={`text-lg font-heading font-bold ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base">Evolução ao Longo do Tempo</CardTitle></CardHeader>
        <CardContent>
          {hasSnapshots ? (
            <div className="h-[300px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <AreaChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Area type="monotone" dataKey="Patrimônio Financeiro" stroke="hsl(var(--primary))" fill="hsl(var(--primary)/0.15)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-heading font-semibold text-muted-foreground">Aguardando histórico</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                O gráfico de evolução será exibido quando houver pelo menos 2 meses de dados registrados em Investimentos.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EvolucaoPatrimonial;
