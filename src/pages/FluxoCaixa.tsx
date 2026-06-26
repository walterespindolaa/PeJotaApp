import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon, Filter } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import {
  INCOME_CATEGORIES, EXPENSE_CATEGORIES,
  type PeriodFilter, getDateRange, PERIOD_LABELS, loadPeriodFilter, savePeriodFilter,
} from "@/lib/dateRange";
import { usePrivacyFmt } from "@/components/PrivacyValue";

type Entry = {
  id: string; user_id: string; date: string; type: string;
  category: string; description: string; amount: number;
  payment_method: string | null; is_recurring: boolean;
  created_at: string;
};

const COLORS = [
  "hsl(0 70% 55%)", "hsl(25 80% 55%)", "hsl(45 90% 50%)", "hsl(120 45% 45%)",
  "hsl(200 70% 50%)", "hsl(260 60% 55%)", "hsl(320 60% 50%)", "hsl(180 50% 45%)",
  "hsl(60 70% 45%)", "hsl(150 50% 40%)", "hsl(280 50% 50%)",
];

const PAYMENT_METHODS = ["PIX", "Cartão de Crédito", "Cartão de Débito", "Dinheiro", "Transferência", "Boleto", "Outro"];

const FluxoCaixaPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { fmt } = usePrivacyFmt();
  const [period, setPeriod] = useState<PeriodFilter>(loadPeriodFilter);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [entryType, setEntryType] = useState<"income" | "expense">("expense");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense">("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    category: "", description: "", amount: 0,
    customCategory: "", payment_method: "", is_recurring: false,
  });

  const handlePeriodChange = (v: string) => {
    const f = v as PeriodFilter;
    setPeriod(f);
    savePeriodFilter(f);
  };

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { start, end } = getDateRange(period);
    let query = supabase.from("cashflow_entries").select("*").eq("user_id", user.id).lte("date", end).order("date", { ascending: false });
    if (start) query = query.gte("date", start);
    const { data } = await query;
    setEntries((data as any as Entry[]) || []);
    setLoading(false);
  }, [user, period]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const filteredEntries = useMemo(() => {
    let result = entries;
    if (filterType !== "all") result = result.filter(e => e.type === filterType);
    if (filterCategory !== "all") result = result.filter(e => e.category === filterCategory);
    return result;
  }, [entries, filterType, filterCategory]);

  const metrics = useMemo(() => {
    const receita = entries.filter(e => e.type === "income").reduce((s, e) => s + Number(e.amount), 0);
    const despesa = entries.filter(e => e.type === "expense").reduce((s, e) => s + Number(e.amount), 0);
    const economia = receita - despesa;
    const taxaPoupanca = receita > 0 ? (economia / receita) * 100 : 0;
    return { receita, despesa, economia, taxaPoupanca };
  }, [entries]);

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();
    entries.filter(e => e.type === "expense").forEach(e => {
      map.set(e.category, (map.get(e.category) || 0) + Number(e.amount));
    });
    const sorted = Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    if (sorted.length <= 6) return sorted;
    const top6 = sorted.slice(0, 6);
    const outros = sorted.slice(6).reduce((s, c) => s + c.value, 0);
    if (outros > 0) top6.push({ name: "Outros", value: outros });
    return top6;
  }, [entries]);

  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; Receita: number; Despesa: number; Economia: number }>();
    entries.forEach(e => {
      const m = e.date.slice(0, 7);
      if (!map.has(m)) map.set(m, { month: m, Receita: 0, Despesa: 0, Economia: 0 });
      const row = map.get(m)!;
      if (e.type === "income") row.Receita += Number(e.amount);
      else row.Despesa += Number(e.amount);
    });
    return Array.from(map.values())
      .map(r => ({ ...r, Economia: r.Receita - r.Despesa }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [entries]);

  const monthlyAvg = useMemo(() => {
    if (entries.length === 0) return { receita: 0, despesa: 0, economia: 0 };
    const n = Math.max(1, monthlyData.length);
    return { receita: metrics.receita / n, despesa: metrics.despesa / n, economia: metrics.economia / n };
  }, [entries, metrics, monthlyData]);

  const top3 = categoryData.slice(0, 3);

  const allCategories = useMemo(() => {
    const set = new Set(entries.map(e => e.category));
    return Array.from(set).sort();
  }, [entries]);

  const handleSave = async () => {
    if (!user) return;
    const cat = form.customCategory.trim() || form.category;
    if (!cat) { toast({ title: "Selecione uma categoria", variant: "destructive" }); return; }
    if (form.amount <= 0) { toast({ title: "Valor deve ser positivo", variant: "destructive" }); return; }
    if (!form.date) { toast({ title: "Data é obrigatória", variant: "destructive" }); return; }

    const payload: any = {
      user_id: user.id, date: form.date, type: entryType, category: cat,
      description: form.description, amount: form.amount,
      payment_method: form.payment_method || null, is_recurring: form.is_recurring,
    };

    if (editingId) {
      await supabase.from("cashflow_entries").update(payload).eq("id", editingId);
      toast({ title: "Lançamento atualizado" });
    } else {
      await supabase.from("cashflow_entries").insert(payload);
      toast({ title: entryType === "income" ? "Receita adicionada" : "Despesa adicionada" });
    }
    resetForm();
    setOpen(false);
    fetchEntries();
  };

  const handleEdit = (e: Entry) => {
    setEntryType(e.type as "income" | "expense");
    setForm({
      date: e.date, category: e.category, description: e.description || "",
      amount: Number(e.amount), customCategory: "",
      payment_method: e.payment_method || "", is_recurring: e.is_recurring,
    });
    setEditingId(e.id);
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("cashflow_entries").delete().eq("id", id);
    fetchEntries();
  };

  const resetForm = () => {
    setForm({ date: new Date().toISOString().split("T")[0], category: "", description: "", amount: 0, customCategory: "", payment_method: "", is_recurring: false });
    setEditingId(null);
  };

  const openAdd = (type: "income" | "expense") => {
    resetForm();
    setEntryType(type);
    setOpen(true);
  };

  const categories = entryType === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  if (loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold">Fluxo de Caixa</h1>
          <p className="text-muted-foreground text-sm mt-1">Registre e acompanhe suas receitas e despesas reais.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[180px] rounded-xl text-xs">
              <div className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" /><SelectValue /></div>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button className="rounded-xl gap-1 bg-success hover:bg-success/90 text-success-foreground" onClick={() => openAdd("income")}>
            <Plus className="h-3.5 w-3.5" /> Receita
          </Button>
          <Button className="rounded-xl gap-1" variant="destructive" onClick={() => openAdd("expense")}>
            <Plus className="h-3.5 w-3.5" /> Despesa
          </Button>
        </div>
      </div>

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

      {/* Monthly averages */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3 rounded-xl bg-muted/30">
          <p className="text-xs text-muted-foreground">Média mensal receitas</p>
          <p className="text-sm font-heading font-bold">{fmt(monthlyAvg.receita)}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/30">
          <p className="text-xs text-muted-foreground">Média mensal despesas</p>
          <p className="text-sm font-heading font-bold">{fmt(monthlyAvg.despesa)}</p>
        </div>
        <div className="p-3 rounded-xl bg-muted/30">
          <p className="text-xs text-muted-foreground">Economia média mensal</p>
          <p className="text-sm font-heading font-bold">{fmt(monthlyAvg.economia)}</p>
        </div>
      </div>

      {/* Charts */}
      {entries.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie chart */}
          {categoryData.length > 0 && (
            <Card className="shadow-soft rounded-2xl">
              <CardHeader className="pb-2"><CardTitle className="font-heading text-sm flex items-center gap-2"><PieChartIcon className="h-4 w-4" />Despesas por Categoria</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                        {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Top 3 */}
                <div className="mt-3 space-y-2">
                  {top3.map((c, i) => (
                    <div key={c.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i] }} />
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                      <span className="text-sm font-bold">{fmt(c.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Monthly bar chart */}
          {monthlyData.length > 0 && (
            <Card className="shadow-soft rounded-2xl">
              <CardHeader className="pb-2"><CardTitle className="font-heading text-sm">Receita × Despesa (mensal)</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmt(v)} />
                      <Legend />
                      <Bar dataKey="Receita" fill="hsl(145 60% 45%)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Despesa" fill="hsl(0 70% 55%)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filters + Table */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="font-heading text-sm">Lançamentos</CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterType} onValueChange={v => setFilterType(v as any)}>
              <SelectTrigger className="w-[120px] rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-[150px] rounded-xl text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {allCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Você ainda não registrou movimentações neste período.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEntries.slice(0, 100).map(e => (
                    <TableRow key={e.id}>
                      <TableCell className="text-xs">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell>
                        <Badge variant={e.type === "income" ? "default" : "destructive"} className="text-[10px]">
                          {e.type === "income" ? "Receita" : "Despesa"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{e.category}</TableCell>
                      <TableCell className="text-xs max-w-[150px] truncate">{e.description}</TableCell>
                      <TableCell className={`text-right text-xs font-bold ${e.type === "income" ? "text-success" : "text-destructive"}`}>
                        {fmt(Number(e.amount))}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEdit(e)}><Pencil className="h-3 w-3" /></Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60 hover:text-destructive" onClick={() => handleDelete(e.id)}><Trash2 className="h-3 w-3" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={v => { if (!v) resetForm(); setOpen(v); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editingId ? "Editar Lançamento" : (entryType === "income" ? "Nova Receita" : "Nova Despesa")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div><Label>Data</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="rounded-xl" /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v, customCategory: "" })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  <SelectItem value="__custom">Personalizada...</SelectItem>
                </SelectContent>
              </Select>
              {form.category === "__custom" && (
                <Input className="rounded-xl mt-2" placeholder="Digite a categoria" value={form.customCategory} onChange={e => setForm({ ...form, customCategory: e.target.value })} />
              )}
            </div>
            <div><Label>Valor (R$)</Label><Input type="number" min={0} step={0.01} value={form.amount || ""} onChange={e => setForm({ ...form, amount: Math.max(0, +e.target.value) })} className="rounded-xl" /></div>
            <div><Label>Descrição (opcional)</Label><Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="rounded-xl" placeholder="Ex: Aluguel escritório" /></div>
            <div>
              <Label>Forma de pagamento (opcional)</Label>
              <Select value={form.payment_method} onValueChange={v => setForm({ ...form, payment_method: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="rounded-xl">
              {editingId ? "Salvar Alterações" : (entryType === "income" ? "Adicionar Receita" : "Adicionar Despesa")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FluxoCaixaPage;
