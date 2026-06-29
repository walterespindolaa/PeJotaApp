import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Building2 } from "lucide-react";
import { format } from "date-fns";
import { dreDoMes, type Tx, type Categoria } from "@/lib/pejota/businessFinance";

const db = supabase as any;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function DRE() {
  const { selected, loading: companiesLoading } = useCompanies();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [cats, setCats] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(false);
  const [mes, setMes] = useState(format(new Date(), "yyyy-MM"));

  const load = useCallback(async () => {
    if (!selected) { setTxs([]); setCats([]); return; }
    setLoading(true);
    const [txRes, catRes] = await Promise.all([
      db.from("business_transactions").select("date, amount, direction, category_id").eq("company_id", selected.id).limit(5000),
      db.from("business_categories").select("id, grupo").eq("company_id", selected.id),
    ]);
    setTxs((txRes.data || []) as Tx[]);
    setCats((catRes.data || []) as Categoria[]);
    setLoading(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const dre = dreDoMes(txs, cats, mes);
  const linhas = [
    { label: "Receita bruta", value: dre.receitaBruta, kind: "pos" as const, strong: false },
    { label: "(-) Deduções (impostos s/ receita)", value: -dre.deducoes, kind: "neg" as const, strong: false },
    { label: "= Receita líquida", value: dre.receitaLiquida, kind: "sub" as const, strong: true },
    { label: "(-) Custos fixos", value: -dre.custosFixos, kind: "neg" as const, strong: false },
    { label: "(-) Folha", value: -dre.folha, kind: "neg" as const, strong: false },
    { label: "(-) Dispensável", value: -dre.dispensavel, kind: "neg" as const, strong: false },
    { label: "= Lucro líquido", value: dre.lucroLiquido, kind: "total" as const, strong: true },
  ];

  if (!companiesLoading && !selected) return (
    <div className="max-w-5xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para ver a DRE.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><FileText className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">DRE gerencial</h1>
          <p className="text-sm text-muted-foreground">Demonstrativo de resultado do mês {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-auto" />
      </div>

      <Card><CardContent className="p-0">
        {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div> : (
          <table className="w-full text-sm">
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className={`border-b last:border-0 ${l.kind === "total" ? "bg-primary/5" : l.kind === "sub" ? "bg-muted/40" : ""}`}>
                  <td className={`p-3 ${l.strong ? "font-semibold" : ""}`}>{l.label}</td>
                  <td className={`p-3 text-right tabular-nums ${l.strong ? "font-semibold" : ""} ${l.value < 0 ? "text-destructive" : l.kind === "total" ? "text-primary" : ""}`}>{brl(l.value)}</td>
                </tr>
              ))}
              <tr><td className="p-3 text-muted-foreground text-xs">Margem líquida</td><td className="p-3 text-right text-xs text-muted-foreground">{dre.receitaBruta > 0 ? pct(dre.margem) : "—"}</td></tr>
            </tbody>
          </table>
        )}
      </CardContent></Card>

      <p className="text-xs text-muted-foreground">
        Os valores vêm dos lançamentos do caixa, agrupados pelo <strong>grupo da categoria</strong> (Receita, Deduções, Custos Fixos, Folha, Dispensável).
        Defina o grupo de cada categoria no financeiro do negócio para a DRE ficar precisa.
      </p>
    </div>
  );
}
