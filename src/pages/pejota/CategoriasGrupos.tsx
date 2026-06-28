import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tags, Building2, ArrowUpCircle, ArrowDownCircle } from "lucide-react";

const db = supabase as any;
type Cat = { id: string; name: string; emoji: string | null; direction: "in" | "out"; grupo: string | null };

// Grupos válidos por sentido (alinha à DRE: dreDoMes em businessFinance.ts)
const GRUPOS_IN = ["Receita"];
const GRUPOS_OUT = ["Deduções", "Custos Fixos", "Folha", "Dispensável"];
const DEFAULT_GRUPO = (d: "in" | "out") => (d === "in" ? "Receita" : "Custos Fixos");

export default function CategoriasGrupos() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selected) { setCats([]); return; }
    setLoading(true);
    const { data } = await db.from("business_categories").select("id, name, emoji, direction, grupo").eq("company_id", selected.id).order("direction").order("sort_order");
    setCats((data || []) as Cat[]);
    setLoading(false);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  const setGrupo = async (cat: Cat, grupo: string) => {
    setSavingId(cat.id);
    setCats(cs => cs.map(c => c.id === cat.id ? { ...c, grupo } : c));
    const { error } = await db.from("business_categories").update({ grupo }).eq("id", cat.id);
    setSavingId(null);
    if (error) { toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" }); load(); return; }
  };

  const aplicarPadroes = async () => {
    const semGrupo = cats.filter(c => !c.grupo);
    if (semGrupo.length === 0) { toast({ title: "Todas já têm grupo" }); return; }
    setLoading(true);
    for (const c of semGrupo) {
      await db.from("business_categories").update({ grupo: DEFAULT_GRUPO(c.direction) }).eq("id", c.id);
    }
    toast({ title: "Padrões aplicados", description: `${semGrupo.length} categoria(s) classificada(s).` });
    load();
  };

  const ins = cats.filter(c => c.direction === "in");
  const outs = cats.filter(c => c.direction === "out");
  const semGrupo = cats.filter(c => !c.grupo).length;

  if (!companiesLoading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para classificar categorias.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  const Bloco = ({ titulo, icon: Icon, lista, grupos }: { titulo: string; icon: any; lista: Cat[]; grupos: string[] }) => (
    <Card><CardContent className="p-0">
      <div className="flex items-center gap-2 p-3 border-b"><Icon className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{titulo}</span></div>
      {lista.length === 0 ? <p className="p-4 text-sm text-muted-foreground">Nenhuma categoria.</p> : (
        <div className="divide-y">
          {lista.map(c => (
            <div key={c.id} className="flex items-center justify-between gap-3 p-3">
              <span className="text-sm font-medium">{c.emoji ? `${c.emoji} ` : ""}{c.name}</span>
              <div className="flex items-center gap-2">
                {!c.grupo && <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 text-[10px]">sem grupo</Badge>}
                <Select value={c.grupo || ""} onValueChange={v => setGrupo(c, v)} disabled={savingId === c.id}>
                  <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Definir grupo…" /></SelectTrigger>
                  <SelectContent>{grupos.map(g => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
    </CardContent></Card>
  );

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Tags className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Categorias e grupos da DRE</h1>
          <p className="text-sm text-muted-foreground">Classifique cada categoria para a DRE separar receita, deduções, custos, folha e gastos dispensáveis {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        {semGrupo > 0 && <Button variant="outline" onClick={aplicarPadroes}>Aplicar padrões ({semGrupo})</Button>}
      </div>

      {loading ? <div className="py-12 text-center text-sm text-muted-foreground">Carregando…</div> : (
        <>
          <Bloco titulo="Entradas" icon={ArrowUpCircle} lista={ins} grupos={GRUPOS_IN} />
          <Bloco titulo="Saídas" icon={ArrowDownCircle} lista={outs} grupos={GRUPOS_OUT} />
        </>
      )}

      <div className="text-xs text-muted-foreground space-y-1">
        <p><strong>Receita</strong>: vendas e faturamento. <strong>Deduções</strong>: impostos sobre a venda (DAS, ISS…).</p>
        <p><strong>Custos Fixos</strong>: aluguel, contador, software. <strong>Folha</strong>: salários e pró-labore. <strong>Dispensável</strong>: o que dá pra cortar sem parar a operação.</p>
        <p>Categorias sem grupo entram na DRE pela heurística (entrada=Receita, saída=Custos Fixos). Classificar deixa o resultado preciso.</p>
      </div>
    </div>
  );
}
