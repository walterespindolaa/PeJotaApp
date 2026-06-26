import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Attribution = {
  id: string; user_id: string; partner_id: string; coupon_id: string | null;
  coupon_code: string | null; attribution_source: string; assigned_plan_slug: string | null;
  pricing_model_snapshot: string | null; client_cost_zero: boolean; partner_pays_full: boolean;
  status: string; created_at: string;
  partners?: { name: string }; profiles?: { full_name: string; email?: string } | null;
};

type Partner = { id: string; name: string };

const AdminAttributions = () => {
  const [attributions, setAttributions] = useState<Attribution[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterPartner, setFilterPartner] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: a }, { data: p }] = await Promise.all([
      supabase.from("user_partner_attributions").select("*, partners(name)").order("created_at", { ascending: false }) as any,
      supabase.from("partners").select("id, name").order("name") as any,
    ]);

    // Get profile info for each user
    const userIds = (a || []).map((x: any) => String(x.user_id));
    let profileMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds) as any;
      (profiles || []).forEach((pr: any) => { profileMap[pr.user_id] = pr; });
    }

    setAttributions((a || []).map((x: any) => ({ ...x, profiles: profileMap[x.user_id] || null })));
    setPartners(p || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = attributions.filter(a => {
    if (filterPartner !== "all" && a.partner_id !== filterPartner) return false;
    if (filterSearch) {
      const s = filterSearch.toLowerCase();
      const name = a.profiles?.full_name?.toLowerCase() || "";
      const code = a.coupon_code?.toLowerCase() || "";
      if (!name.includes(s) && !code.includes(s) && !a.user_id.includes(s)) return false;
    }
    return true;
  });

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-heading font-bold">Atribuições (Clientes por Parceiro)</h2>

      <div className="flex gap-3 flex-wrap">
        <Select value={filterPartner} onValueChange={setFilterPartner}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Todos parceiros" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos parceiros</SelectItem>
            {partners.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Input placeholder="Buscar por nome, cupom ou user_id" value={filterSearch} onChange={e => setFilterSearch(e.target.value)} className="max-w-xs" />
      </div>

      <Card className="shadow-soft rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Parceiro</TableHead>
                <TableHead>Cupom</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Custo Zero</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Nenhuma atribuição encontrada.</TableCell></TableRow>
              ) : filtered.map(a => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{a.profiles?.full_name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{a.user_id.slice(0, 8)}…</p>
                    </div>
                  </TableCell>
                  <TableCell>{(a as any).partners?.name || "—"}</TableCell>
                  <TableCell><span className="font-mono text-xs">{a.coupon_code || "—"}</span></TableCell>
                  <TableCell className="text-xs">{a.assigned_plan_slug || "padrão"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{a.pricing_model_snapshot || "—"}</Badge></TableCell>
                  <TableCell>{a.client_cost_zero ? <Badge>Sim</Badge> : "Não"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(a.created_at).toLocaleDateString("pt-BR")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">Total: {filtered.length} atribuições</p>
    </div>
  );
};

export default AdminAttributions;
