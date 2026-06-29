import { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Calculator, Building2, Users, Wrench, Landmark, Megaphone, Boxes, Store } from "lucide-react";
import { format, subMonths } from "date-fns";
import { resumoMes, saldoCaixa, type Tx } from "@/lib/pejota/businessFinance";
import {
  contratarFuncionario, comprarEquipamento, capitalDeGiro, investirMarketing, aumentarEstoque, abrirFilial,
  type PJContext, type PJResult,
} from "@/lib/pejota/pjDecisionEngine";

const db = supabase as any;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const meses = (n: number) => (n === Infinity ? "∞" : `${n.toFixed(1)} meses`);
const numv = (s: string) => Number(String(s).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "")) || 0;

type DecKey = "contratar" | "equipamento" | "capital_giro" | "marketing" | "estoque" | "filial";
const DECISOES: { key: DecKey; label: string; icon: any; desc: string }[] = [
  { key: "contratar", label: "Contratar funcionário", icon: Users, desc: "Custo com encargos × margem" },
  { key: "equipamento", label: "Comprar equipamento", icon: Wrench, desc: "À vista ou financiado + payback" },
  { key: "capital_giro", label: "Capital de giro / empréstimo", icon: Landmark, desc: "PMT e juros totais" },
  { key: "marketing", label: "Investir em marketing", icon: Megaphone, desc: "ROI e retorno esperado" },
  { key: "estoque", label: "Aumentar estoque", icon: Boxes, desc: "Capital imobilizado + custo de oportunidade" },
  { key: "filial", label: "Abrir filial / ponto", icon: Store, desc: "Investimento, custo fixo e payback" },
];

const VEREDITO: Record<string, { label: string; cls: string }> = {
  favoravel: { label: "Favorável", cls: "bg-emerald-500/15 text-emerald-600" },
  atencao: { label: "Atenção", cls: "bg-amber-500/15 text-amber-600" },
  arriscado: { label: "Arriscado", cls: "bg-destructive/15 text-destructive" },
};

export default function SimuladorPJ() {
  const { selected, loading: companiesLoading } = useCompanies();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [tipo, setTipo] = useState<DecKey>("contratar");
  const [f, setF] = useState<Record<string, string>>({ fator: "1,70", taxa: "2,00", n: "12", giro: "3" });
  const [financiado, setFinanciado] = useState(false);
  const [result, setResult] = useState<PJResult | null>(null);

  const load = useCallback(async () => {
    if (!selected) { setTxs([]); return; }
    const { data } = await db.from("business_transactions").select("date, amount, direction, category_id").eq("company_id", selected.id).limit(5000);
    setTxs((data || []) as Tx[]);
  }, [selected]);
  useEffect(() => { load(); }, [load]);

  // Contexto PJ: caixa + médias dos últimos 3 meses
  const ctx: PJContext = useMemo(() => {
    const now = new Date();
    const ultimos3 = [0, 1, 2].map(i => format(subMonths(now, i), "yyyy-MM"));
    const r3 = ultimos3.map(m => resumoMes(txs, m));
    const receitaMensal = r3.reduce((s, r) => s + r.receita, 0) / 3;
    const despesaMensal = r3.reduce((s, r) => s + r.despesa, 0) / 3;
    const margem = receitaMensal > 0 ? (receitaMensal - despesaMensal) / receitaMensal : 0;
    return { saldoCaixa: saldoCaixa(txs), receitaMensal, despesaMensal, margem: Math.max(0, margem), taxaMensal: 0.01 };
  }, [txs]);

  const simular = () => {
    let res: PJResult;
    switch (tipo) {
      case "contratar":
        res = contratarFuncionario(numv(f.salario || "0"), numv(f.fator || "1,7"), ctx, numv(f.ganho || "0")); break;
      case "equipamento":
        res = comprarEquipamento(numv(f.valor || "0"), ctx, { financiado, n: numv(f.n || "12"), taxaMensal: numv(f.taxa || "2") / 100, ganhoMensal: numv(f.ganho || "0") }); break;
      case "capital_giro":
        res = capitalDeGiro(numv(f.valor || "0"), numv(f.taxa || "2") / 100, numv(f.n || "12"), ctx); break;
      case "marketing":
        res = investirMarketing(numv(f.gasto || "0"), numv(f.n || "12"), numv(f.receita || "0"), ctx); break;
      case "estoque":
        res = aumentarEstoque(numv(f.valor || "0"), numv(f.giro || "3"), ctx); break;
      case "filial":
        res = abrirFilial(numv(f.invest || "0"), numv(f.custofixo || "0"), numv(f.receita || "0"), ctx); break;
    }
    setResult(res!);
  };

  const Campo = ({ k, label, ph }: { k: string; label: string; ph?: string }) => (
    <div><Label className="text-xs">{label}</Label><Input inputMode="decimal" placeholder={ph} value={f[k] || ""} onChange={e => setF(s => ({ ...s, [k]: e.target.value }))} /></div>
  );

  if (!companiesLoading && !selected) return (
    <div className="max-w-3xl mx-auto p-6"><Card><CardContent className="py-12 text-center">
      <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground/50" />
      <p className="text-sm text-muted-foreground mb-4">Selecione ou crie uma empresa para simular decisões.</p>
      <Link to="/dashboard/negocios"><Button>Ir para o negócio</Button></Link>
    </CardContent></Card></div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary grid place-items-center flex-shrink-0"><Calculator className="w-5 h-5" /></div>
        <div><h1 className="text-xl font-heading font-semibold">Simulador de decisão (empresa)</h1>
        <p className="text-sm text-muted-foreground">Impacto de grandes decisões do negócio com fórmulas reais: PMT, juros compostos, payback e fôlego de caixa (runway).</p></div>
      </div>

      {/* Contexto atual */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: "Caixa atual", v: brl(ctx.saldoCaixa) },
          { l: "Receita/mês (3m)", v: brl(ctx.receitaMensal) },
          { l: "Despesa/mês (3m)", v: brl(ctx.despesaMensal) },
          { l: "Margem", v: `${(ctx.margem * 100).toFixed(0)}%` },
        ].map(k => <div key={k.l} className="bg-muted/50 rounded-xl p-3"><p className="text-[11px] text-muted-foreground">{k.l}</p><p className="text-lg font-semibold mt-0.5">{k.v}</p></div>)}
      </div>

      {/* Tipo de decisão */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {DECISOES.map(d => (
          <button key={d.key} onClick={() => { setTipo(d.key); setResult(null); }}
            className={`text-left rounded-xl border p-3 transition-colors ${tipo === d.key ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}>
            <div className="flex items-center gap-2 mb-1"><d.icon className={`w-4 h-4 ${tipo === d.key ? "text-primary" : "text-muted-foreground"}`} /><span className="text-sm font-medium">{d.label}</span></div>
            <p className="text-[11px] text-muted-foreground">{d.desc}</p>
          </button>
        ))}
      </div>

      {/* Inputs por decisão */}
      <Card><CardContent className="p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {tipo === "contratar" && <>
            <Campo k="salario" label="Salário bruto (R$/mês)" ph="3.000" />
            <Campo k="fator" label="Fator de encargos" ph="1,70" />
            <Campo k="ganho" label="Receita extra gerada (R$/mês, opcional)" ph="0" />
          </>}
          {tipo === "equipamento" && <>
            <Campo k="valor" label="Valor do equipamento (R$)" ph="12.000" />
            <Campo k="ganho" label="Ganho gerado (R$/mês, opcional)" ph="0" />
            <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
              <Label className="text-xs">Financiado?</Label><Switch checked={financiado} onCheckedChange={setFinanciado} />
            </div>
            {financiado && <Campo k="n" label="Parcelas (meses)" ph="12" />}
            {financiado && <Campo k="taxa" label="Juros (% ao mês)" ph="2,00" />}
          </>}
          {tipo === "capital_giro" && <>
            <Campo k="valor" label="Valor do empréstimo (R$)" ph="10.000" />
            <Campo k="taxa" label="Juros (% ao mês)" ph="2,00" />
            <Campo k="n" label="Parcelas (meses)" ph="12" />
          </>}
          {tipo === "marketing" && <>
            <Campo k="gasto" label="Gasto (R$/mês)" ph="2.000" />
            <Campo k="n" label="Por quantos meses" ph="6" />
            <Campo k="receita" label="Receita esperada (R$/mês)" ph="8.000" />
          </>}
          {tipo === "estoque" && <>
            <Campo k="valor" label="Valor a investir em estoque (R$)" ph="15.000" />
            <Campo k="giro" label="Giro estimado (meses)" ph="3" />
          </>}
          {tipo === "filial" && <>
            <Campo k="invest" label="Investimento inicial (R$)" ph="60.000" />
            <Campo k="custofixo" label="Custo fixo (R$/mês)" ph="8.000" />
            <Campo k="receita" label="Receita esperada (R$/mês)" ph="30.000" />
          </>}
        </div>
        <Button onClick={simular} className="gap-2"><Calculator className="w-4 h-4" /> Simular impacto</Button>
      </CardContent></Card>

      {/* Resultado */}
      {result && (
        <Card><CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold">{result.titulo}</h2>
            <Badge className={VEREDITO[result.veredito].cls}>{VEREDITO[result.veredito].label}</Badge>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/40 rounded-xl p-3"><p className="text-[11px] text-muted-foreground">Caixa hoje</p><p className={`text-base font-semibold ${result.impactoCaixaImediato < 0 ? "text-destructive" : result.impactoCaixaImediato > 0 ? "text-emerald-600" : ""}`}>{result.impactoCaixaImediato === 0 ? "—" : brl(result.impactoCaixaImediato)}</p></div>
            <div className="bg-muted/40 rounded-xl p-3"><p className="text-[11px] text-muted-foreground">Lucro mensal</p><p className={`text-base font-semibold ${result.impactoLucroMensal < 0 ? "text-destructive" : result.impactoLucroMensal > 0 ? "text-emerald-600" : ""}`}>{result.impactoLucroMensal === 0 ? "—" : brl(result.impactoLucroMensal)}</p></div>
            <div className="bg-muted/40 rounded-xl p-3"><p className="text-[11px] text-muted-foreground">Juros / oport.</p><p className="text-base font-semibold">{result.jurosOuOportunidade === 0 ? "—" : brl(result.jurosOuOportunidade)}</p></div>
            <div className="bg-muted/40 rounded-xl p-3"><p className="text-[11px] text-muted-foreground">Payback</p><p className="text-base font-semibold">{result.paybackMeses == null ? "—" : meses(result.paybackMeses)}</p></div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted/20 border p-3 text-sm">
            <span className="text-muted-foreground">Fôlego de caixa (runway):</span>
            <span className="font-medium">{meses(result.runwayAntes)}</span>
            <span className="text-muted-foreground">→</span>
            <span className={`font-semibold ${result.runwayDepois < result.runwayAntes ? "text-destructive" : "text-emerald-600"}`}>{meses(result.runwayDepois)}</span>
          </div>
          <div>
            <p className="text-xs font-medium mb-1">Memória do cálculo</p>
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap bg-muted/20 p-3 rounded-xl border">{result.memoria.join("\n")}</pre>
          </div>
        </CardContent></Card>
      )}

      <p className="text-xs text-muted-foreground">Usa o caixa e as médias dos últimos 3 meses da empresa selecionada. Custo de oportunidade base de 1%/mês; juros de financiamento conforme você informar. Caráter informativo, não é recomendação.</p>
    </div>
  );
}
