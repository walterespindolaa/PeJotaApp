import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Wallet, ExternalLink } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { type PeriodFilter } from "@/lib/dateRange";
import { useNavigate } from "react-router-dom";
import { useOrganizaCashflow } from "@/lib/useOrganizaCashflow";
import { usePrivacyFmt } from "@/components/PrivacyValue";

const COLORS = [
  "hsl(0 70% 55%)", "hsl(25 80% 55%)", "hsl(45 90% 50%)", "hsl(120 45% 45%)",
  "hsl(200 70% 50%)", "hsl(260 60% 55%)", "hsl(320 60% 50%)",
];

interface Props {
  period: PeriodFilter;
  onDataChange?: (data: { receita: number; despesa: number; economia: number; taxaPoupanca: number }) => void;
}

export default function FluxoCaixa({ period, onDataChange }: Props) {
  const navigate = useNavigate();
  const { fmt } = usePrivacyFmt();
  const { entries, loading, metrics, categoryData, monthlyAvg } = useOrganizaCashflow(period);

  useEffect(() => { onDataChange?.(metrics); }, [metrics, onDataChange]);

  if (loading) return <div className="flex items-center justify-center h-20"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-success/10 border border-success/20">
          <div className="flex items-center gap-1.5 mb-1"><TrendingUp className="h-3.5 w-3.5 text-success" /><p className="text-xs text-muted-foreground">Receita</p></div>
          <p className="text-lg font-heading font-bold text-success">{fmt(metrics.receita)}</p>
        </div>
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-1.5 mb-1"><TrendingDown className="h-3.5 w-3.5 text-destructive" /><p className="text-xs text-muted-foreground">Despesas</p></div>
          <p className="text-lg font-heading font-bold text-destructive">{fmt(metrics.despesa)}</p>
        </div>
        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-1.5 mb-1"><Wallet className="h-3.5 w-3.5 text-primary" /><p className="text-xs text-muted-foreground">Economia</p></div>
          <p className="text-lg font-heading font-bold text-primary">{fmt(metrics.economia)}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/30">
          <p className="text-xs text-muted-foreground">Taxa de Poupança</p>
          <p className="text-lg font-heading font-bold">{metrics.receita > 0 ? `${metrics.taxaPoupanca.toFixed(1)}%` : "—"}</p>
        </div>
      </div>

      {/* Averages */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-2 rounded-xl bg-muted/30"><p className="text-[10px] text-muted-foreground">Média receitas/mês</p><p className="text-xs font-bold">{fmt(monthlyAvg.receita)}</p></div>
        <div className="p-2 rounded-xl bg-muted/30"><p className="text-[10px] text-muted-foreground">Média despesas/mês</p><p className="text-xs font-bold">{fmt(monthlyAvg.despesa)}</p></div>
        <div className="p-2 rounded-xl bg-muted/30"><p className="text-[10px] text-muted-foreground">Economia média/mês</p><p className="text-xs font-bold">{fmt(monthlyAvg.economia)}</p></div>
      </div>

      {/* Pie chart */}
      {categoryData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Despesas por Categoria</p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={9}>
                    {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Top Categorias</p>
            {categoryData.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-xs">{c.name}</span>
                </div>
                <span className="text-xs font-bold">{fmt(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Last entries (read-only) */}
      {entries.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wider">Últimos Lançamentos</p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead><TableHead>Tipo</TableHead>
                  <TableHead>Categoria</TableHead><TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.slice(0, 10).map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell><Badge variant={e.type === "income" ? "default" : "destructive"} className="text-[10px]">{e.type === "income" ? "Receita" : "Despesa"}</Badge></TableCell>
                    <TableCell className="text-xs">{e.category}</TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{e.description}</TableCell>
                    <TableCell className={`text-right text-xs font-bold ${e.type === "income" ? "text-success" : "text-destructive"}`}>{fmt(e.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          Sem lançamentos no período. Adicione receitas e despesas no <strong>Planejamento e Controle</strong>.
        </p>
      )}

      {/* Link to Organiza */}
      <div className="text-center">
        <Button variant="outline" size="sm" className="rounded-xl gap-1.5 text-xs" onClick={() => navigate("/dashboard/renda-despesas")}>
          <ExternalLink className="h-3.5 w-3.5" /> Ver detalhes no Planejamento e Controle
        </Button>
      </div>
    </div>
  );
}
