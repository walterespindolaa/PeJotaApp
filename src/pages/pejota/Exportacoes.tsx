import { useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Building2, Wallet, Receipt, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { dreDoMes, type Tx, type Categoria } from "@/lib/pejota/businessFinance";

const db = supabase as any;
const thisMonth = () => format(new Date(), "yyyy-MM");
const brlNum = (v: number) => Number(Number(v || 0).toFixed(2));

function baixarXLSX(sheets: { nome: string; linhas: any[] }[], arquivo: string) {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.linhas.length ? s.linhas : [{ aviso: "Sem dados no período" }]);
    XLSX.utils.book_append_sheet(wb, ws, s.nome.slice(0, 31));
  }
  XLSX.writeFile(wb, arquivo);
}

export default function Exportacoes() {
  const { selected, loading: companiesLoading } = useCompanies();
  const { toast } = useToast();
  const [mes, setMes] = useState(thisMonth());
  const [busy, setBusy] = useState<string | null>(null);

  const slug = (selected?.name || "empresa").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const exportCaixa = async () => {
    if (!selected) return; setBusy("caixa");
    const { data } = await db.from("business_transactions").select("date, description, direction, amount, source, category_id").eq("company_id", selected.id).order("date", { ascending: false }).limit(10000);
    const linhas = (data || []).map((t: any) => ({
      Data: t.date, Descrição: t.description,
      Tipo: t.direction === "in" ? "Entrada" : "Saída",
      Valor: brlNum(t.amount), Origem: t.source || "manual",
    }));
    baixarXLSX([{ nome: "Caixa", linhas }], `pejota-caixa-${slug}.xlsx`);
    setBusy(null); toast({ title: "Caixa exportado", description: `${linhas.length} lançamentos.` });
  };

  const exportContas = async () => {
    if (!selected) return; setBusy("contas");
    const { data } = await db.from("business_bills").select("kind, description, amount, due_date, status, paid_date, payer_name").eq("company_id", selected.id).order("due_date");
    const map = (k: string) => (data || []).filter((b: any) => b.kind === k).map((b: any) => ({
      Descrição: b.description, Valor: brlNum(b.amount), Vencimento: b.due_date || "",
      Status: b.status, "Pago/Recebido em": b.paid_date || "", Pagador: b.payer_name || "",
    }));
    baixarXLSX([{ nome: "A receber", linhas: map("receber") }, { nome: "A pagar", linhas: map("pagar") }], `pejota-contas-${slug}.xlsx`);
    setBusy(null); toast({ title: "Contas exportadas" });
  };

  const exportDRE = async () => {
    if (!selected) return; setBusy("dre");
    const [txRes, catRes] = await Promise.all([
      db.from("business_transactions").select("date, amount, direction, category_id").eq("company_id", selected.id).limit(10000),
      db.from("business_categories").select("id, grupo").eq("company_id", selected.id),
    ]);
    const dre = dreDoMes((txRes.data || []) as Tx[], (catRes.data || []) as Categoria[], mes);
    const linhas = [
      { Linha: "Receita bruta", Valor: dre.receitaBruta },
      { Linha: "(-) Deduções", Valor: -dre.deducoes },
      { Linha: "= Receita líquida", Valor: dre.receitaLiquida },
      { Linha: "(-) Custos fixos", Valor: -dre.custosFixos },
      { Linha: "(-) Folha", Valor: -dre.folha },
      { Linha: "(-) Dispensável", Valor: -dre.dispensavel },
      { Linha: "= Lucro líquido", Valor: dre.lucroLiquido },
      { Linha: "Margem líquida (%)", Valor: dre.receitaBruta > 0 ? Number((dre.margem * 100).toFixed(1)) : 0 },
    ];
    baixarXLSX([{ nome: `DRE ${mes}`, linhas }], `pejota-dre-${mes}-${slug}.xlsx`);
    setBusy(null); toast({ title: "DRE exportada", description: `Mês ${mes}.` });
  };

  if (!companiesLoading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para exportar relatórios.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  const cards = [
    { key: "caixa", icon: Wallet, titulo: "Lançamentos do caixa", desc: "Todas as entradas e saídas (Excel).", on: exportCaixa },
    { key: "contas", icon: Receipt, titulo: "Contas a receber e a pagar", desc: "Duas abas: a receber e a pagar (Excel).", on: exportContas },
    { key: "dre", icon: FileText, titulo: "DRE do mês", desc: "Demonstrativo de resultado do mês escolhido (Excel).", on: exportDRE },
  ];

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Download className="w-5 h-5" /></div>
          <div><h1 className="text-xl font-heading font-semibold">Exportações</h1>
          <p className="text-sm text-muted-foreground">Baixe seus dados em Excel para o contador ou backup {selected ? `· ${selected.name}` : ""}.</p></div>
        </div>
        <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="w-auto" />
      </div>

      <div className="space-y-3">
        {cards.map(c => (
          <Card key={c.key}><CardContent className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-muted grid place-items-center flex-shrink-0"><c.icon className="w-4 h-4 text-muted-foreground" /></div>
              <div><p className="text-sm font-medium">{c.titulo}</p><p className="text-xs text-muted-foreground">{c.desc}</p></div>
            </div>
            <Button variant="outline" onClick={c.on} disabled={!!busy} className="gap-2">{busy === c.key ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Excel</Button>
          </CardContent></Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">Os arquivos são gerados no seu navegador a partir dos dados da empresa selecionada (isolados por RLS).</p>
    </div>
  );
}
