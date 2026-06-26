import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DollarSign, Users, TrendingUp, Building2 } from "lucide-react";

type SettlementRow = {
  partnerId: string;
  partnerName: string;
  partnerType: string;
  totalClients: number;
  activeClients: number;
  freeForClientCount: number;
  discountCount: number;
  commissionCount: number;
  hybridCount: number;
  estimatedCommission: number;
  estimatedPartnerCost: number;
  estimatedSubsidy: number;
};

const AdminSettlement = () => {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [y, m] = period.split("-").map(Number);
    const start = new Date(y, m - 1, 1).toISOString();
    const end = new Date(y, m, 1).toISOString();

    const [{ data: partners }, { data: attributions }] = await Promise.all([
      supabase.from("partners").select("*").order("name") as any,
      supabase.from("user_partner_attributions").select("*").gte("created_at", start).lt("created_at", end) as any,
    ]);

    const map = new Map<string, SettlementRow>();
    (partners || []).forEach((p: any) => {
      map.set(p.id, {
        partnerId: p.id, partnerName: p.name, partnerType: p.type,
        totalClients: 0, activeClients: 0,
        freeForClientCount: 0, discountCount: 0, commissionCount: 0, hybridCount: 0,
        estimatedCommission: 0, estimatedPartnerCost: 0, estimatedSubsidy: 0,
      });
    });

    (attributions || []).forEach((a: any) => {
      const row = map.get(a.partner_id);
      if (!row) return;
      row.totalClients++;
      if (a.status === "active") row.activeClients++;
      const model = a.pricing_model_snapshot || "";
      if (model === "free_for_client_partner_pays") row.freeForClientCount++;
      else if (model === "client_discount") row.discountCount++;
      else if (model === "partner_commission_per_client") row.commissionCount++;
      else if (model === "hybrid") row.hybridCount++;

      // Estimate commission from snapshot
      const comm = a.partner_commission_snapshot || {};
      if (comm.type === "fixed") row.estimatedCommission += (comm.value || 0);
      // For partner_pays_full, add a cost marker
      if (a.partner_pays_full) row.estimatedPartnerCost++;
      if (a.client_cost_zero && a.partner_pays_full) row.estimatedSubsidy++;
    });

    setRows(Array.from(map.values()).filter(r => r.totalClients > 0 || true));
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const totals = rows.reduce((acc, r) => ({
    clients: acc.clients + r.totalClients,
    active: acc.active + r.activeClients,
    commission: acc.commission + r.estimatedCommission,
    subsidized: acc.subsidized + r.estimatedSubsidy,
  }), { clients: 0, active: 0, commission: 0, subsidized: 0 });

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-heading font-bold">Fechamento Mensal</h2>
        <input
          type="month"
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-background"
        />
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Building2, label: "Parceiros ativos", value: rows.filter(r => r.totalClients > 0).length },
          { icon: Users, label: "Clientes no período", value: totals.clients },
          { icon: DollarSign, label: "Comissão estimada", value: `R$ ${Number(totals.commission).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` },
          { icon: TrendingUp, label: "Clientes subsidiados", value: totals.subsidized },
        ].map((kpi, i) => (
          <Card key={i} className="shadow-soft rounded-2xl">
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
                <p className="text-lg font-bold font-heading">{kpi.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Parceiro</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Ativos</TableHead>
                <TableHead>Grátis</TableHead>
                <TableHead>Desconto</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Híbrido</TableHead>
                <TableHead>Est. Comissão</TableHead>
                <TableHead>Subsidiados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground">Nenhum dado no período.</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.partnerId}>
                  <TableCell className="font-medium">{r.partnerName}</TableCell>
                  <TableCell><Badge variant="outline" className="capitalize text-xs">{r.partnerType}</Badge></TableCell>
                  <TableCell>{r.totalClients}</TableCell>
                  <TableCell>{r.activeClients}</TableCell>
                  <TableCell>{r.freeForClientCount}</TableCell>
                  <TableCell>{r.discountCount}</TableCell>
                  <TableCell>{r.commissionCount}</TableCell>
                  <TableCell>{r.hybridCount}</TableCell>
                  <TableCell className="font-mono text-sm">R$ {Number(r.estimatedCommission).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                  <TableCell>{r.estimatedSubsidy}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminSettlement;
