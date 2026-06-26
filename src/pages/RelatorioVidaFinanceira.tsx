import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  FileText, RefreshCw, Loader2, Download, Clock, Sparkles,
  Shield, TrendingUp, AlertTriangle, Target, Star,
  Building2, Wallet, PiggyBank, BarChart3, DollarSign,
  Plane, Globe, Car, CarFront, Home, Heart, GraduationCap,
  Users, Percent, Activity, Landmark, BadgePercent,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useReportPersistence } from "@/hooks/useReportPersistence";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { renderMarkdownSections } from "@/lib/renderMarkdown";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { FV, PV, PMT } from "@/lib/financial";
import CenariosChart from "@/components/aposentadoria/CenariosChart";
import AtlasReportHeader from "@/components/report/AtlasReportHeader";
import AtlasReportClosing from "@/components/report/AtlasReportClosing";
import AIReportDisclaimer from "@/components/legal/AIReportDisclaimer";
import ReportIntro from "@/components/report/ReportIntro";
import {
  PieChart, Pie, Cell as PieCell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import type { LucideIcon } from "lucide-react";

const REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/vida-financeira-report`;

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const PIE_COLORS = [
  "hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))",
  "hsl(var(--warning))", "hsl(var(--accent))", "hsl(var(--destructive))",
  "hsl(220 14% 60%)", "hsl(280 40% 55%)",
];

function guessObjIcon(nome: string): LucideIcon {
  const n = nome.toLowerCase();
  if (n.includes("viagem")) return n.includes("inter") ? Globe : Plane;
  if (n.includes("carro")) return Car;
  if (n.includes("imóvel") || n.includes("casa") || n.includes("apart")) return Home;
  if (n.includes("casamento")) return Heart;
  if (n.includes("faculdade") || n.includes("curso")) return GraduationCap;
  return Sparkles;
}

const RelatorioVidaFinanceira = () => {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const { view: householdView } = useHouseholdView();
  const {
    content, loading, initialLoading, generatedAt,
    generateReport, downloadPDF: _basePDF,
  } = useReportPersistence("diagnostico_atlas");

  const [userName, setUserName] = useState("");
  const [idade, setIdade] = useState<number | null>(null);
  const [investimentos, setInvestimentos] = useState<any[]>([]);
  const [bens, setBens] = useState<any[]>([]);
  const [despesas, setDespesas] = useState<any[]>([]);
  const [receitas, setReceitas] = useState<any[]>([]);
  const [economias, setEconomias] = useState<any[]>([]);
  const [objetivos, setObjetivos] = useState<any[]>([]);
  const [retirementData, setRetirementData] = useState<any>(null);
  const [atlasScore, setAtlasScore] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profileRes, invRes, bensRes, aposentRes, despRes, recRes, econRes, objRes, scoreRes] = await Promise.all([
        supabase.from("profiles").select("full_name, nome_pessoa1, age").eq("user_id", user.id).maybeSingle(),
        supabase.from("investimentos_financeiros").select("nome, tipo, classe, valor_atual, total_aportado, instituicao, is_reserva_emergencia, liquidez, perfil_risco").eq("user_id", user.id),
        supabase.from("investimentos_nao_financeiros").select("nome, tipo, valor, divida_vinculada, gera_renda, valor_renda").eq("user_id", user.id),
        supabase.from("aposentadoria").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("despesas").select("categoria, valor, tipo, is_parcelada, recorrente").eq("user_id", user.id).limit(500),
        supabase.from("receitas" as any).select("valor, categoria, tipo").eq("user_id", user.id).limit(200).then((r: any) => r, () => ({ data: null })),
        supabase.from("economias").select("valor, data").eq("user_id", user.id).limit(200),
        supabase.from("objetivos").select("nome, valor_objetivo, valor_acumulado, data_objetivo, aporte_mensal").eq("user_id", user.id),
        supabase.from("atlas_score_snapshots").select("score, breakdown, snapshot_date").eq("user_id", user.id).order("snapshot_date", { ascending: false }).limit(1),
      ]);

      const p = profileRes.data as any;
      setUserName(p?.full_name || p?.nome_pessoa1 || "");
      setIdade(p?.age || null);
      setInvestimentos(invRes.data || []);
      setBens((bensRes.data || []) as any[]);
      setDespesas(despRes.data || []);
      setReceitas((recRes as any)?.data || []);
      setEconomias(econRes.data || []);
      setObjetivos((objRes.data || []) as any[]);
      if ((scoreRes.data || []).length > 0) setAtlasScore((scoreRes.data as any)[0]);

      const apo = aposentRes.data as any;
      if (apo) {
        setIdade(apo.idade_atual || p?.age || null);
        const patFinVal = (invRes.data || []).reduce((s: number, i: any) => s + Number(i.valor_atual || 0), 0);
        const bensData = bensRes.data || [];
        const patBensVal = bensData.reduce((s: number, b: any) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0);
        const rendaBensVal = bensData.filter((b: any) => b.gera_renda).reduce((s: number, b: any) => s + Number(b.valor_renda || 0), 0);
        const taxaN = Number(apo.taxa_nominal || 0.10);
        const infl = Number(apo.inflacao || 0.05);
        const taxaRealAnual = ((1 + taxaN) / (1 + infl)) - 1;
        const r = taxaRealAnual > 0 ? Math.pow(1 + taxaRealAnual, 1 / 12) - 1 : 0.0001;
        const idadeAtual = apo.idade_atual || 30;
        const idadeAp = apo.idade_aposentadoria || 60;
        const expVida = apo.expectativa_vida || 90;
        const rendaDes = Number(apo.renda_desejada || 0);
        const rendaPassAtu = Number(apo.renda_passiva_atual || 0);
        const poupMen = Number(apo.poupanca_mensal || 0);
        const incluirBens = Boolean(apo.incluir_bens);
        const patrimonioAtual = patFinVal + (incluirBens ? patBensVal : 0);
        const rendaPassivaTotal = rendaPassAtu + (incluirBens ? rendaBensVal : 0);
        const gapMensal = Math.max(0, rendaDes - rendaPassivaTotal);
        const mesesAte = Math.max(0, (idadeAp - idadeAtual) * 12);
        const mesesPos = Math.max(0, (expVida - idadeAp) * 12);
        const realidade = mesesAte > 0 ? FV(r, mesesAte, -poupMen, -patrimonioAtual) : patrimonioAtual;
        const consumo = mesesPos > 0 && gapMensal > 0 ? -PV(r, mesesPos, gapMensal, 0) : 0;
        const viverRenda = gapMensal > 0 && r > 0 ? gapMensal / r : 0;
        const poupConsumo = gapMensal > 0 && mesesAte > 0 ? -PMT(r, mesesAte, -patrimonioAtual, consumo) : 0;
        const poupViver = gapMensal > 0 && mesesAte > 0 ? -PMT(r, mesesAte, -patrimonioAtual, viverRenda) : 0;

        setRetirementData({
          idadeAtual, idadeAposentadoria: idadeAp, expectativaVida: expVida,
          patrimonioAtual, poupancaMensal: poupMen, taxaRealMensal: r,
          rendaDesejada: rendaDes, gapMensal,
          rendaPassiva: rendaPassivaTotal, rendaPassivaAtual: rendaPassAtu,
          rendaPassivaBens: rendaBensVal, incluirBens,
          patrimonioRealidade: realidade, montanteConsumo: consumo, montanteViverRenda: viverRenda,
          poupancaConsumo: poupConsumo, poupancaViverRenda: poupViver,
        });
      }
    })();
  }, [user]);

  // ---- Computed Values ----
  const patFin = investimentos.reduce((s, i: any) => s + Number(i.valor_atual || 0), 0);
  const totalAportado = investimentos.reduce((s, i: any) => s + Number(i.total_aportado || 0), 0);
  const patBensVal = bens.reduce((s, b: any) => s + Number(b.valor || 0), 0);
  const totalDividas = bens.reduce((s, b: any) => s + Number(b.divida_vinculada || 0), 0);
  const patBensLiq = patBensVal - totalDividas;
  const reserva = investimentos.filter((i: any) => i.is_reserva_emergencia).reduce((s, i: any) => s + Number(i.valor_atual || 0), 0);
  const totalDesp = despesas.reduce((s, d: any) => s + Number(d.valor), 0);
  const despFixas = despesas.filter((d: any) => d.tipo === "fixa").reduce((s, d: any) => s + Number(d.valor), 0);
  const despVar = despesas.filter((d: any) => d.tipo === "variavel").reduce((s, d: any) => s + Number(d.valor), 0);
  const totalRec = receitas.reduce((s: number, r: any) => s + Number(r.valor || 0), 0);
  const totalEcon = economias.reduce((s: number, e: any) => s + Number(e.valor || 0), 0);
  const mesesReserva = totalDesp > 0 ? (reserva / totalDesp) : 0;
  const totalParcelamentos = despesas.filter((d: any) => d.is_parcelada).reduce((s, d: any) => s + Number(d.valor), 0);
  const totalObjMensal = objetivos.reduce((s, o: any) => s + Number(o.aporte_mensal || 0), 0);
  const patrimonioTotal = patFin + patBensLiq;
  const taxaPoupanca = totalRec > 0 ? Math.round((totalEcon / totalRec) * 100) : 0;
  const custoAnual = totalDesp * 12;
  const patrimonioNecessarioIF = custoAnual > 0 ? Math.round(custoAnual / 0.04) : 0;
  const indiceIF = patrimonioNecessarioIF > 0 ? Math.round((patrimonioTotal / patrimonioNecessarioIF) * 100) : 0;
  const gapIF = Math.max(0, patrimonioNecessarioIF - patrimonioTotal);

  // Category breakdown for charts
  const catMap: Record<string, number> = {};
  despesas.forEach((d: any) => { catMap[d.categoria || "Outros"] = (catMap[d.categoria || "Outros"] || 0) + Number(d.valor); });
  const topCats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const catPieData = topCats.map(([name, value]) => ({ name, value }));

  // Investment class breakdown
  const classeMap: Record<string, number> = {};
  investimentos.forEach((i: any) => { classeMap[i.classe || i.tipo || "Outros"] = (classeMap[i.classe || i.tipo || "Outros"] || 0) + Number(i.valor_atual || 0); });
  const classeData = Object.entries(classeMap).map(([name, value]) => ({ name, value, pct: patFin > 0 ? Math.round((value / patFin) * 100) : 0 })).sort((a, b) => b.value - a.value);

  // Patrimony composition for pie
  const patImob = bens.filter((b: any) => ["imovel", "imóvel", "Imóvel"].includes(b.tipo)).reduce((s: number, b: any) => s + Number(b.valor || 0), 0);
  const patVeic = bens.filter((b: any) => ["veiculo", "veículo", "Veículo", "carro"].includes(b.tipo)).reduce((s: number, b: any) => s + Number(b.valor || 0), 0);
  const patComposicao = [
    { name: "Financeiro", value: patFin },
    { name: "Imóveis", value: patImob },
    { name: "Veículos", value: patVeic },
    { name: "Outros Bens", value: Math.max(0, patBensVal - patImob - patVeic) },
  ].filter(d => d.value > 0);

  // Revenue vs Expense bar data
  const fluxoBarData = [
    { name: "Receita", value: totalRec, fill: "hsl(var(--success))" },
    { name: "Despesas", value: totalDesp, fill: "hsl(var(--destructive))" },
    { name: "Parcelam.", value: totalParcelamentos, fill: "hsl(var(--warning))" },
    { name: "Poupança", value: totalEcon, fill: "hsl(var(--info))" },
  ];

  // PDF download — uses shared engine from useReportPersistence (cover + slicing)
  const handleDownloadPDF = () => _basePDF("vida-fin-report");

  // ---- Content Rendering with Visual Interleaving ----
  const renderContentWithVisuals = () => {
    if (!content) return null;
    const sections = content.split(/(?=^## )/m);
    const result: JSX.Element[] = [];

    sections.forEach((section, idx) => {
      result.push(<div key={`s-${idx}`}>{renderMarkdownSections(section)}</div>);

      // After "Raio-X Financeiro" → inject patrimônio-focused KPI cards (NO cash flow metrics)
      if (section.match(/## (Raio-X|Raio X)/i)) {
        result.push(
          <div key="raio-x-cards" className="my-6">
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {idade && <KPICard icon={Users} label="Idade" value={`${idade} anos`} />}
              <KPICard icon={TrendingUp} label="Patrimônio Total" value={fmtBRL(patrimonioTotal)} color="text-primary" />
              <KPICard icon={BarChart3} label="Pat. Financeiro" value={fmtBRL(patFin)} color="text-info" />
              <KPICard icon={Building2} label="Pat. Imobilizado" value={fmtBRL(patBensVal)} />
              <KPICard icon={AlertTriangle} label="Dívidas" value={fmtBRL(totalDividas)} color="text-destructive" />
              <KPICard icon={Shield} label="Reserva" value={`${mesesReserva.toFixed(1)} meses`} color={mesesReserva >= 6 ? "text-success" : "text-warning"} />
              <KPICard icon={BadgePercent} label="Índice IF" value={`${indiceIF}%`} color={indiceIF >= 100 ? "text-success" : "text-primary"} />
            </div>
          </div>
        );
      }

      // Fluxo de Caixa visuals removed — now exclusive to Financeiro report

      // After "Estrutura Patrimonial" → inject patrimony pie + cards
      if (section.match(/## (Estrutura Patrimonial)/i)) {
        result.push(
          <div key="pat-structure" className="my-6 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard icon={Wallet} label="Patrimônio Total" value={fmtBRL(patrimonioTotal)} color="text-primary" />
              <StatCard icon={TrendingUp} label="Pat. Financeiro" value={fmtBRL(patFin)} color="text-info" />
              <StatCard icon={Building2} label="Pat. Imobilizado" value={fmtBRL(patBensLiq)} color="text-accent" />
              <StatCard icon={AlertTriangle} label="Dívidas" value={fmtBRL(totalDividas)} color="text-destructive" />
            </div>
            {patComposicao.length > 0 && (
              <Card className="rounded-2xl border-border/30 shadow-sm">
                <CardContent className="p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Composição Patrimonial</p>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={patComposicao} cx="50%" cy="50%" outerRadius={70} innerRadius={35} dataKey="value" paddingAngle={2}>
                          {patComposicao.map((_, i) => <PieCell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fmtBRL(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 justify-center mt-2">
                    {patComposicao.map((d, i) => (
                      <span key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {d.name}: {fmtBRL(d.value)}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        );
      }

      // After "Diagnostico de Investimentos" → inject table + class breakdown
      if (section.match(/## (Diagnostico de Investimentos|Diagnóstico de Investimentos)/i) && investimentos.length > 0) {
        result.push(
          <div key="inv-tables" className="my-6 space-y-4">
            {/* Class breakdown table */}
            <div className="rounded-2xl border border-border/30 bg-card p-4 overflow-x-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Alocação por Classe de Ativo</p>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Classe</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">%</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {classeData.map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{c.name}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(c.value)}</TableCell>
                      <TableCell className="text-right text-sm font-bold">{c.pct}%</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border/50">
                    <TableCell className="font-bold text-sm">Total</TableCell>
                    <TableCell className="text-right font-bold text-sm text-primary">{fmt(patFin)}</TableCell>
                    <TableCell className="text-right font-bold text-sm">100%</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            {/* Full investment table */}
            <div className="rounded-2xl border border-border/30 bg-card p-4 overflow-x-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Investimentos Financeiros</p>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Nome</TableHead><TableHead>Tipo/Classe</TableHead><TableHead>Instituição</TableHead>
                  <TableHead className="text-right">Aportado</TableHead><TableHead className="text-right">Atual</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {investimentos.map((inv: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium text-sm">{inv.nome}</TableCell>
                      <TableCell className="text-sm">{inv.classe || inv.tipo}</TableCell>
                      <TableCell className="text-sm">{inv.instituicao}</TableCell>
                      <TableCell className="text-right text-sm">{fmt(inv.total_aportado)}</TableCell>
                      <TableCell className="text-right font-bold text-sm">{fmt(inv.valor_atual)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 border-border/50">
                    <TableCell colSpan={3} className="font-bold text-sm">Total</TableCell>
                    <TableCell className="text-right font-bold text-sm">{fmt(totalAportado)}</TableCell>
                    <TableCell className="text-right font-bold text-sm text-primary">{fmt(patFin)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            {/* Bens table */}
            {bens.length > 0 && (
              <div className="rounded-2xl border border-border/30 bg-card p-4 overflow-x-auto">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Bens e Imóveis</p>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Nome</TableHead><TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead><TableHead className="text-right">Dívida</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {bens.map((b: any, i: number) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{b.nome}</TableCell>
                        <TableCell className="text-sm">{b.tipo}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(b.valor)}</TableCell>
                        <TableCell className="text-right text-sm">{fmt(b.divida_vinculada)}</TableCell>
                        <TableCell className="text-right font-bold text-sm">{fmt(Number(b.valor) - Number(b.divida_vinculada))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        );
      }

      // Projeção Patrimonial / CenariosChart removed — now exclusive to Planejamento 360

      // After "Simulacao de Independencia" → inject IF cards
      if (section.match(/## (Simulacao|Simulação)/i)) {
        result.push(
          <div key="if-cards" className="my-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard icon={DollarSign} label="Custo Anual" value={fmtBRL(custoAnual)} color="text-foreground" />
            <StatCard icon={Target} label="Pat. Necessário (4%)" value={fmtBRL(patrimonioNecessarioIF)} color="text-primary" />
            <StatCard icon={TrendingUp} label="Pat. Atual" value={fmtBRL(patrimonioTotal)} color="text-info" />
            <StatCard icon={AlertTriangle} label="Gap" value={fmtBRL(gapIF)} color={gapIF === 0 ? "text-success" : "text-warning"} />
          </div>
        );
      }

      // Mapa do Futuro timeline removed — now exclusive to Planejamento 360

      // After "Score Financeiro" → inject score visual
      if (section.match(/## (Score Financeiro|Score)/i) && atlasScore) {
        const score = atlasScore.score;
        const level = score >= 80 ? "Excelente" : score >= 60 ? "Bom" : score >= 40 ? "Regular" : "Crítico";
        const levelColor = score >= 80 ? "text-success" : score >= 60 ? "text-info" : score >= 40 ? "text-warning" : "text-destructive";
        const progressColor = score >= 80 ? "bg-success" : score >= 60 ? "bg-info" : score >= 40 ? "bg-warning" : "bg-destructive";
        result.push(
          <div key="score-card" className="my-6 rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <div className="flex items-center gap-6">
              <div className="text-center shrink-0">
                <Star className="h-8 w-8 text-primary mx-auto mb-1" />
                <p className="text-4xl font-bold text-primary">{score}</p>
                <p className={`text-sm font-semibold ${levelColor} mt-1`}>{level}</p>
              </div>
              <div className="flex-1">
                <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${progressColor} transition-all`} style={{ width: `${score}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">Atlas Score · {new Date(atlasScore.snapshot_date).toLocaleDateString("pt-BR")}</p>
              </div>
            </div>
          </div>
        );
      }
    });

    return result;
  };

  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  if (initialLoading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportIntro
        whatIs="Um raio-X completo da sua vida financeira atual."
        whatYouSee="Onde está seu dinheiro hoje, como ele está distribuído e quais pontos estão desorganizados ou desalinhados."
        howItHelps="Te dá clareza total do ponto de partida, para parar de agir no escuro e começar a tomar decisões com base na realidade."
      />
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/15 to-accent/15">
              <FileText className="h-7 w-7 text-primary" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-2xl font-heading font-bold">Base da Montanha</h1>
              {userName && <p className="text-sm text-muted-foreground font-medium">{userName}</p>}
              <p className="text-muted-foreground text-xs">Raio-X completo: onde está seu dinheiro, como está distribuído e o que ajustar.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {content && (
            <Button onClick={handleDownloadPDF} variant="outline" className="gap-2 rounded-xl" size="lg">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          )}
          <Button onClick={() => generateReport(REPORT_URL, { visao: householdView })} disabled={loading} className="gap-2 rounded-xl shadow-sm" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "Gerando..." : content ? "Atualizar Relatório" : "Gerar Base da Montanha"}
          </Button>
        </div>
      </div>

      {generatedAt && !loading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Última atualização: {new Date(generatedAt).toLocaleString("pt-BR")}
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
            <Sparkles className="h-2.5 w-2.5" /> Gerado por IA | Atlas
          </span>
        </div>
      )}

      {/* Empty State */}
      {!content && !loading && (
        <Card className="shadow-card rounded-2xl border-dashed border-2 border-border/40">
          <CardContent className="py-20 text-center">
            <div className="p-6 rounded-full bg-primary/5 w-fit mx-auto mb-6">
              <Activity className="h-14 w-14 text-primary/25" strokeWidth={1.5} />
            </div>
             <h3 className="font-heading font-semibold text-xl text-foreground/70 mb-2">Base da Montanha</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              Clique em "Gerar Base da Montanha" para descobrir onde está seu dinheiro hoje, como ele está distribuído e quais pontos precisam de atenção.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report Content */}
      {(content || loading) && (
        <div id="vida-fin-report">
          {/* Cover */}
          <Card className="shadow-card rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10 mb-6">
            <CardContent className="py-10 text-center">
              <img src="/logo.png" alt="Atlas" className="w-14 h-14 mx-auto mb-3 rounded-2xl object-contain" />
              <h2 className="text-2xl font-heading font-bold text-foreground mb-1">Base da Montanha</h2>
              {userName && <p className="text-lg text-foreground/70 font-medium">{userName}</p>}
              <p className="text-sm text-muted-foreground mt-1">{today}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                <Sparkles className="h-3 w-3" /> Gerado por IA · Atlas
              </div>
            </CardContent>
          </Card>

          {/* Executive Summary + KPI Top Bar */}
          {content && !loading && (
            <>
              {/* Síntese Executiva */}
              <Card className="shadow-card rounded-2xl border-primary/15 bg-gradient-to-r from-primary/5 to-transparent mb-4">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-heading font-bold">Síntese Executiva</h3>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">
                    {patrimonioTotal > 0
                      ? `${userName || "Você"} possui patrimônio total de ${fmtBRL(patrimonioTotal)} (${fmtBRL(patFin)} financeiro + ${fmtBRL(patBensLiq)} em bens). ` +
                        `Com reserva de emergência cobrindo ${mesesReserva.toFixed(1)} meses de despesas e índice de independência financeira de ${indiceIF}%, ` +
                        `${indiceIF >= 100 ? "já atingiu a independência financeira." : indiceIF >= 50 ? "está na metade do caminho para a independência financeira." : "ainda precisa construir patrimônio para alcançar a independência financeira."}`
                      : `Ainda não há dados patrimoniais suficientes para gerar a síntese. Registre seus investimentos e bens para uma análise completa.`
                    }
                  </p>
                </CardContent>
              </Card>

              {/* KPI Top Bar — leitura de 15 segundos */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                <KPICard icon={TrendingUp} label="Pat. Total" value={fmtBRL(patrimonioTotal)} color="text-primary" />
                <KPICard icon={Wallet} label="Pat. Líquido" value={fmtBRL(patrimonioTotal - totalDividas)} color="text-info" />
                <KPICard icon={BarChart3} label="Pat. Financeiro" value={fmtBRL(patFin)} color="text-info" />
                <KPICard icon={Shield} label="Reserva" value={`${mesesReserva.toFixed(1)} meses`} color={mesesReserva >= 6 ? "text-success" : mesesReserva >= 3 ? "text-warning" : "text-destructive"} />
                <KPICard icon={BadgePercent} label="Gap IF" value={fmtBRL(gapIF)} color={gapIF === 0 ? "text-success" : "text-warning"} />
                <KPICard icon={Star} label="Score Atlas" value={atlasScore ? `${atlasScore.score}/100` : "—"} color="text-primary" />
              </div>

              {/* Semáforo Visual */}
              <Card className="shadow-card rounded-2xl mb-6">
                <CardContent className="p-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Diagnóstico por Eixo</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <SemaforoItem label="Liquidez" status={mesesReserva >= 6 ? "green" : mesesReserva >= 3 ? "yellow" : "red"} />
                    <SemaforoItem label="Disciplina" status={taxaPoupanca >= 20 ? "green" : taxaPoupanca >= 10 ? "yellow" : "red"} />
                    <SemaforoItem label="Diversificação" status={Object.keys(classeMap).length >= 4 ? "green" : Object.keys(classeMap).length >= 2 ? "yellow" : "red"} />
                    <SemaforoItem label="Aposentadoria" status={indiceIF >= 80 ? "green" : indiceIF >= 30 ? "yellow" : "red"} />
                    <SemaforoItem label="Proteção" status={mesesReserva >= 6 && totalDividas === 0 ? "green" : mesesReserva >= 3 ? "yellow" : "red"} />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {/* Main content */}
          <Card className="shadow-card rounded-2xl bg-card">
            <CardContent className="p-6 sm:p-10">
              {loading && !content && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Analisando seus dados financeiros e gerando o relatório completo...</span>
                </div>
              )}
              <div className="prose-sm max-w-none">{renderContentWithVisuals()}</div>
              {loading && content && (
                <div className="flex items-center gap-2 text-muted-foreground mt-4 pt-4 border-t border-border/30">
                  <Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Gerando...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Closing message */}
          {content && !loading && (
            <AtlasReportClosing
              category="diagnostico"
              proximoMovimento={
                mesesReserva < 3
                  ? "Priorize montar sua reserva de emergência: direcione toda a poupança mensal para atingir pelo menos 3 meses de despesas em ativos líquidos."
                  : mesesReserva < 6
                  ? "Reforce sua reserva de emergência até atingir 6 meses de cobertura para garantir segurança financeira completa."
                  : indiceIF < 30
                  ? "Aumente seus aportes mensais em investimentos diversificados para acelerar a construção de patrimônio rumo à independência financeira."
                  : taxaPoupanca < 20
                  ? "Otimize seu fluxo de caixa: reduza despesas variáveis e aumente a taxa de poupança para pelo menos 20% da renda."
                  : "Mantenha a disciplina atual e diversifique a carteira. Reavalie trimestralmente seus objetivos e ajuste a alocação de ativos."
              }
            />
          )}
        </div>
      )}
    </div>
  );
};

// ---- Sub-components ----

function KPICard({ icon: Icon, label, value, color = "text-foreground" }: { icon: LucideIcon; label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-card p-3 text-center">
      <Icon className={`h-4 w-4 mx-auto mb-1 ${color}`} />
      <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">{label}</p>
      <p className={`text-xs font-bold ${color}`}>{value}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-border/30 bg-card p-4 text-center">
      <Icon className={`h-5 w-5 mx-auto mb-2 ${color}`} />
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ScenarioCard({ title, value, desc, variant }: { title: string; value: number; desc: string; variant: "default" | "warning" | "premium" }) {
  const colors = { default: "bg-card border-border/40", warning: "bg-warning/5 border-warning/20", premium: "bg-primary/5 border-primary/20" };
  return (
    <Card className={`rounded-xl border ${colors[variant]} shadow-sm`}>
      <CardContent className="p-4">
        <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{title}</span>
        <p className="text-lg font-bold text-foreground mt-1">{fmtBRL(value)}</p>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </CardContent>
    </Card>
  );
}

function SemaforoItem({ label, status }: { label: string; status: "green" | "yellow" | "red" }) {
  const colors = {
    green: { bg: "bg-success/15", dot: "bg-success", text: "text-success" },
    yellow: { bg: "bg-warning/15", dot: "bg-warning", text: "text-warning" },
    red: { bg: "bg-destructive/15", dot: "bg-destructive", text: "text-destructive" },
  };
  const statusLabel = { green: "Saudável", yellow: "Atenção", red: "Crítico" };
  const c = colors[status];
  return (
    <div className={`rounded-xl ${c.bg} p-3 text-center`}>
      <div className={`w-3 h-3 rounded-full ${c.dot} mx-auto mb-1.5`} />
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className={`text-[10px] font-medium ${c.text}`}>{statusLabel[status]}</p>
    </div>
  );
}

export default RelatorioVidaFinanceira;
