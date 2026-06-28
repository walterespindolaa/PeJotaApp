import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, Building2, Save } from "lucide-react";
import { format } from "date-fns";
import { projetadoVsRealizado, type Tx, type BudgetRow } from "@/lib/pejota/businessFinance";

const db = supabase as any;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const toMoney = (s: string) => parseInt(s.replace(/\D/g, "") || "0", 10) / 100;
const thisMonth = () => format(new Date(), "yyyy-MM");

type Cat = { id: string; name: string; emoji: string | null; direction: "in" | "out" };

export default function FluxoCaixa() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [cats, setCats] = useState<Cat[]>([]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [budget, setBudget] = useState<BudgetRow[]>([]);
  const [mes, setMes] = useState(thisMonth());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  // edição local do projetado por categoria (string formatada)
  const [draft, setDraft] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!selected) { setCats([]); setTxs([]); setBudget([]); return; }
    setLoading(true);
    const monthFirst = `${mes}-01`;
    const [catRes, txRes, budRes] = await Promise.all([
      db.from("business_categories").select("id, name, emoji, direction").eq("company_id", selected.id).order("direction").order("sort_order"),
      db.from("business_transactions").select("date, amount, direction, category_id").eq("company_id", selected.id).gte("date", monthFirst).lte("date", `${mes}-31`).limit(5000),
      db.from("business_cashflow_budget").select("ref_month, category_id, projected").eq("company_id", selected.id).eq("ref_month", monthFirst),
    ]);
    setCats((catRes.data || []) as Cat[]);
    setTxs((txRes.data || []) as Tx[]);
    const buds = (budRes.data || []) as BudgetRow[];
    setBudget(buds);
    const d: Record<string, string> = {};
    buds.forEach(b => { if (b.category_id) d[b.category_id] = Number(b.projected || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 }); });
    setDraft(d);
    setLoading(false);
  }, [selected, mes]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => projetadoVsRealizado(budget, txs, mes), [budget, txs, mes]);
  const rowByCat = useMemo(() => new Map(rows.map(r => [r.category_id, r])), [rows]);

  // Mostra todas as categorias + eventuais linhas "sem categoria" que tenham movimento/orçamento.
  const linhas = useMemo(() => {
    const ids = new Set(cats.map(c => c.id));
    const extras = rows.filter(r => r.category_id && !ids.has(r.category_id));
    const semCat = rowByCat.get(null);
    return [
      ...cats.map(c => ({ id: c.id, label: `${c.emoji ? c.emoji + " " : ""}${c.name}`, direction: c.direction, row: rowByCat.get(c.id) })),
      ...extras.map(r => ({ id: r.category_id as string, label: "(categoria removida)", direction: undefined as any, row: r })),
      ...(semCat ? [{ id: "__none__", label: "Sem categoria", direction: undefined as any, row: semCat }] : []),
    ];
  }, [cats, rows, rowByCat]);

  const totals = useMemo(() => {
    const projetado = rows.reduce((s, r) => s + r.projected, 0);
    const realizado = rows.reduce((s, r) => s + r.realized, 0);
    return { projetado, realizado, desvio: realizado - projetado };
  }, [rows]);

  const salvarProjecoes = async () => {
    if (!selected) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    const monthFirst = `${mes}-01`;
    const upserts = Object.entries(draft)
      .filter(([id]) => id && id !== "__none__")
      .map(([category_id, val]) => ({
        company_id: selected.id, user_id: user?.id, ref_month: monthFirst,
        category_id, projected: toMoney(val),
      }));
    if (upserts.length === 0) { setSaving(false); toast({ title: "Nada para salvar" }); return; }
    const { error } = await db.from("business_cashflow_budget").upsert(upserts, { onConflict: "company_id,ref_month,category_id" });
    setSaving(false);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Projeções salvas", description: "Comparando com o realizado do mês." });
    load();
  };

  if (!companiesLoading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para projetar o fluxo de caixa.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><TrendingUp className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Fluxo de caixa — projetado × realizado</h1>
          <p className="text-sm text-muted-foreground">Orce por categoria e compare com o que de fato entrou/saiu {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-auto" />
          <Button onClick={salvarProjecoes} disabled={saving} className="gap-2"><Save className="w-4 h-4" /> {saving ? "Salvando…" : "Salvar"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Projetado (líquido)</p><p className="text-2xl font-semibold mt-1">{brl(totals.projetado)}</p></div>
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Realizado (líquido)</p><p className={`text-2xl font-semibold mt-1 ${totals.realizado >= 0 ? "text-emerald-600" : "text-destructive"}`}>{brl(totals.realizado)}</p></div>
        <div className="bg-muted/50 rounded-xl p-4"><p className="text-xs text-muted-foreground">Desvio</p><p className={`text-2xl font-semibold mt-1 ${totals.desvio >= 0 ? "text-emerald-600" : "text-destructive"}`}>{brl(totals.desvio)}</p></div>
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div> : (
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left font-medium p-3">Categoria</th>
              <th className="text-right font-medium p-3 w-40">Projetado (R$)</th>
              <th className="text-right font-medium p-3">Realizado</th>
              <th className="text-right font-medium p-3">Desvio</th>
            </tr></thead>
            <tbody>{linhas.map(l => {
              const realized = l.row?.realized ?? 0;
              const projected = l.row?.projected ?? 0;
              const diff = realized - projected;
              const editable = l.id !== "__none__" && !!l.id;
              return (
                <tr key={l.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 font-medium">{l.label}{l.direction && <span className="ml-2 text-xs text-muted-foreground">{l.direction === "in" ? "entrada" : "saída"}</span>}</td>
                  <td className="p-2 text-right">
                    {editable ? (
                      <Input inputMode="numeric" placeholder="0,00" className="h-8 text-right tabular-nums"
                        value={draft[l.id] ?? ""}
                        onChange={e => setDraft(d => ({ ...d, [l.id]: toMoney(e.target.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) }))} />
                    ) : <span className="tabular-nums text-muted-foreground">{brl(projected)}</span>}
                  </td>
                  <td className={`p-3 text-right tabular-nums ${realized >= 0 ? "text-emerald-600" : "text-destructive"}`}>{brl(realized)}</td>
                  <td className={`p-3 text-right tabular-nums ${diff >= 0 ? "text-emerald-600" : "text-destructive"}`}>{brl(diff)}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        )}
      </CardContent></Card>

      <p className="text-xs text-muted-foreground">
        <strong>Realizado</strong> = soma dos lançamentos do mês por categoria (entradas positivas, saídas negativas).
        <strong> Projetado</strong> = o que você orça para a categoria no mês. <strong>Desvio</strong> = realizado − projetado
        (verde = entrou mais / gastou menos que o previsto). Edite os valores e clique em <strong>Salvar</strong>.
      </p>
    </div>
  );
}
