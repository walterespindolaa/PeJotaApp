import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserCheck, Clock, ShieldOff, UserPlus, TrendingUp } from "lucide-react";

type Metrics = {
  totalUsers: number; active: number; expired: number; grace: number;
  blocked: number; newLast7: number; newLast30: number;
  bySource: Record<string, number>;
};

const MetricCard = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
  <Card className="shadow-soft rounded-2xl">
    <CardContent className="p-5 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-heading font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </CardContent>
  </Card>
);

const AdminMetrics = () => {
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke("admin-users", {
        body: { action: "metrics" },
      });
      if (error) toast({ title: "Erro ao carregar métricas", variant: "destructive" });
      else setMetrics(data);
      setLoading(false);
    })();
  }, [toast]);

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!metrics) return <p className="text-muted-foreground">Erro ao carregar métricas.</p>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <MetricCard icon={Users} label="Total Usuários" value={metrics.totalUsers} color="bg-primary/10 text-primary" />
        <MetricCard icon={UserCheck} label="Ativos" value={metrics.active} color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" />
        <MetricCard icon={Clock} label="Expirados" value={metrics.expired} color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" />
        <MetricCard icon={Clock} label="Em Grace" value={metrics.grace} color="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300" />
        <MetricCard icon={ShieldOff} label="Bloqueados/Cancelados" value={metrics.blocked} color="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" />
        <MetricCard icon={UserPlus} label="Novos (7 dias)" value={metrics.newLast7} color="bg-primary/15 text-primary" />
        <MetricCard icon={UserPlus} label="Novos (30 dias)" value={metrics.newLast30} color="bg-accent text-accent-foreground" />
      </div>

      {Object.keys(metrics.bySource).length > 0 && (
        <Card className="shadow-soft rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="font-heading text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Conversões por Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(metrics.bySource).map(([source, count]) => (
                <div key={source} className="flex items-center gap-2 px-4 py-2 bg-muted/40 rounded-xl">
                  <span className="text-sm font-medium capitalize">{source}</span>
                  <span className="text-lg font-bold font-heading">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminMetrics;
