import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import {
  PenLine, Plus, ArrowRight, DollarSign, TrendingDown,
  TrendingUp, Search, Loader2, Banknote, ShoppingCart, Home,
} from "lucide-react";

type RecentEntry = {
  id: string;
  type: "receita" | "despesa";
  data: string;
  descricao: string | null;
  categoria: string;
  valor: number;
  created_at: string;
};

export default function TabInsercaoManual() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fmt } = usePrivacyFmt();
  const [entries, setEntries] = useState<RecentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [recRes, despRes] = await Promise.all([
        supabase.from("receitas").select("id,data,descricao,categoria,valor,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
        supabase.from("despesas").select("id,data,descricao,categoria,valor,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      const rec = ((recRes.data as any[]) || []).map(r => ({ ...r, type: "receita" as const }));
      const desp = ((despRes.data as any[]) || []).map(d => ({ ...d, type: "despesa" as const }));
      const merged = [...rec, ...desp].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
      setEntries(merged);
      setLoading(false);
    };
    load();
  }, [user]);

  const filtered = useMemo(() => {
    let items = entries;
    if (filterType !== "all") items = items.filter(e => e.type === filterType);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      items = items.filter(e => e.descricao?.toLowerCase().includes(q) || e.categoria.toLowerCase().includes(q));
    }
    return items;
  }, [entries, filterType, searchTerm]);

  const shortcuts = [
    { label: "Nova Receita", icon: TrendingUp, color: "text-success", onClick: () => navigate("/dashboard/renda-despesas") },
    { label: "Nova Despesa Fixa", icon: Home, color: "text-primary", onClick: () => navigate("/dashboard/renda-despesas") },
    { label: "Nova Despesa Variável", icon: ShoppingCart, color: "text-destructive", onClick: () => navigate("/dashboard/renda-despesas") },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid gap-3 sm:grid-cols-4">
        <Button
          onClick={() => navigate("/dashboard/renda-despesas")}
          className="h-auto py-4 gap-2 flex flex-col items-center"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs font-medium">Novo Lançamento</span>
        </Button>
        {shortcuts.map(s => (
          <Card key={s.label} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={s.onClick}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <span className="text-xs font-medium">{s.label}</span>
              <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar por descrição ou categoria..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9 h-8 text-xs" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Recent entries */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-heading flex items-center justify-between">
            <span className="flex items-center gap-2"><PenLine className="h-4 w-4 text-muted-foreground" /> Lançamentos recentes</span>
            <Badge variant="outline" className="text-xs">{filtered.length} registros</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum lançamento encontrado.</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Data</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Descrição</TableHead>
                    <TableHead className="text-xs">Categoria</TableHead>
                    <TableHead className="text-xs text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 50).map(e => (
                    <TableRow key={`${e.type}-${e.id}`}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(e.data + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${e.type === "receita" ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}>
                          {e.type === "receita" ? "Receita" : "Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate">{e.descricao || "—"}</TableCell>
                      <TableCell className="text-xs">{e.categoria}</TableCell>
                      <TableCell className={`text-xs text-right font-bold ${e.type === "receita" ? "text-success" : "text-destructive"}`}>
                        {fmt(e.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
