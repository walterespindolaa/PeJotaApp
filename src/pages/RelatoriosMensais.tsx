import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrganiza } from "@/hooks/useOrganiza";
import {
  TrendingUp, TrendingDown, Wallet, PiggyBank,
  ShoppingCart, CreditCard, ArrowUpRight, ArrowDownRight, Minus,
  Lightbulb, Download, RefreshCw, Loader2, Clock, Sparkles,
  AlertTriangle, CheckCircle2, Target,
} from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { useReportPersistence } from "@/hooks/useReportPersistence";
import { renderMarkdownSections } from "@/lib/renderMarkdown";
import AtlasReportHeader from "@/components/report/AtlasReportHeader";
import AtlasReportClosing from "@/components/report/AtlasReportClosing";
import AIReportDisclaimer from "@/components/legal/AIReportDisclaimer";
import ReportIntro from "@/components/report/ReportIntro";
import type { VisaoPessoa } from "@/hooks/useOrganiza";

const REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/advisor-report`;
const pctFn = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;

const now = new Date();
const currentMesAno = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

const months = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(now.getFullYear(), i);
  const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const label = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return { value, label: label.charAt(0).toUpperCase() + label.slice(1) };
});

// Consultive advisor card with variants
const AdvisorCard = ({ title, icon: Icon, content: md, variant = "default" }: { title: string; icon: React.ElementType; content: string; variant?: "default" | "alert" | "opportunity" | "action" }) => {
  if (!md.trim()) return null;
  const styles = {
    default: { border: "border-primary/10", bg: "from-card to-primary/[0.02]", icon: "bg-primary/10 text-primary" },
    alert: { border: "border-warning/20", bg: "from-card to-warning/[0.03]", icon: "bg-warning/10 text-warning" },
    opportunity: { border: "border-success/20", bg: "from-card to-success/[0.03]", icon: "bg-success/10 text-success" },
    action: { border: "border-info/20", bg: "from-card to-info/[0.03]", icon: "bg-info/10 text-info" },
  };
  const s = styles[variant];
  return (
    <Card className={`shadow-card rounded-2xl ${s.border} bg-gradient-to-br ${s.bg}`}>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
          <div className={`p-1.5 rounded-lg ${s.icon}`}><Icon className="h-4 w-4" /></div>
          <h3 className="font-heading font-bold text-sm">{title}</h3>
        </div>
        <div className="prose-sm max-w-none">{renderMarkdownSections(md)}</div>
      </CardContent>
    </Card>
  );
};

const RelatoriosMensais = () => {
  const { fmt } = usePrivacyFmt();
  const [mesAno, setMesAno] = useState(currentMesAno);
  const { view: householdView } = useHouseholdView();
  const visaoPessoa: VisaoPessoa = householdView as VisaoPessoa;
  const org = useOrganiza(mesAno, visaoPessoa);
  const { content, loading: aiLoading, generatedAt, generateReport, downloadPDF } = useReportPersistence("conselheiro");

  const [year, month] = mesAno.split("-").map(Number);
  const prevM = month === 1 ? 12 : month - 1;
  const prevY = month === 1 ? year - 1 : year;
  const prevMesAno = `${prevY}-${String(prevM).padStart(2, "0")}`;
  const prevOrg = useOrganiza(prevMesAno, visaoPessoa);

  const variation = (curr: number, prev: number) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const varReceita = variation(org.totalGanhos, prevOrg.totalGanhos);
  const varDespesas = variation(org.despesaCorrente, prevOrg.despesaCorrente);

  const VariationBadge = ({ value }: { value: number }) => {
    if (value === 0) return <Badge variant="outline" className="text-[10px] gap-1"><Minus className="h-3 w-3" /> 0%</Badge>;
    const isPositive = value > 0;
    return (
      <Badge variant="outline" className={`text-[10px] gap-1 ${isPositive ? "text-success border-success/30" : "text-destructive border-destructive/30"}`}>
        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {pctFn(value)}
      </Badge>
    );
  };

  // Split AI content into blocks (parser tolerante a emojis no cabeçalho)
  const aiBlocks = useMemo(() => {
    const empty = { interpretacao: "", comprometimento: "", prioridades: "", perguntas: "", plano: "", extras: [] as string[] };
    if (!content) return empty;
    const sections = content.split(/(?=^## )/m);
    let interpretacao = "", comprometimento = "", prioridades = "", perguntas = "", plano = "";
    const extras: string[] = [];
    sections.forEach(s => {
      if (!s.trim().startsWith("##")) return;
      const firstLine = s.split("\n")[0].toLowerCase();
      if (/diagn[oó]stico|interpreta|executiv/.test(firstLine)) interpretacao = s;
      else if (/comprometimento/.test(firstLine)) comprometimento = s;
      else if (/prioridade|estrat[eé]gic/.test(firstLine)) prioridades = s;
      else if (/pergunta/.test(firstLine)) perguntas = s;
      else if (/plano|a[cç][aã]o/.test(firstLine)) plano = s;
      else extras.push(s);
    });
    return { interpretacao, comprometimento, prioridades, perguntas, plano, extras };
  }, [content]);

  if (org.loading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div id="conselheiro-report">
      <ReportIntro
        whatIs="Um direcionamento prático baseado na sua situação atual."
        whatYouSee="Prioridades claras, próximos passos e recomendações objetivas para melhorar sua vida financeira."
        howItHelps="Te dá clareza sobre o que fazer agora, eliminando dúvidas e acelerando sua evolução."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Lightbulb className="h-6 w-6 text-primary" /> Guia da Jornada | Atlas
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Prioridades claras, próximos passos e recomendações objetivas para sua vida financeira.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={mesAno} onValueChange={setMesAno}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => downloadPDF("conselheiro-report")} variant="outline" className="rounded-xl gap-2" size="sm">
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          <Button onClick={() => generateReport(REPORT_URL, { mesAno, visao: visaoPessoa })} disabled={aiLoading} className="rounded-xl gap-2" size="sm">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {aiLoading ? "Gerando..." : content ? "Atualizar IA" : "Gerar análise IA"}
          </Button>
        </div>
      </div>

      {generatedAt && !aiLoading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Última atualização IA: {new Date(generatedAt).toLocaleString("pt-BR")}
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
            <Sparkles className="h-2.5 w-2.5" /> Gerado por IA | Atlas
          </span>
        </div>
      )}

      <AtlasReportHeader title="Guia da Jornada | Atlas" />
      <AIReportDisclaimer />

      {/* Compact executive summary — 6 essential cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Receita", value: org.totalGanhos, icon: TrendingUp, color: "text-success", var: varReceita },
          { label: "Despesas", value: org.despesaCorrente, icon: TrendingDown, color: "text-destructive", var: varDespesas },
          { label: "Saldo", value: org.saldoPrevisto, icon: Wallet, color: org.saldoPrevisto >= 0 ? "text-success" : "text-destructive" },
          { label: "Parcelamentos", value: org.totalParcelas, icon: ShoppingCart, color: "text-info" },
          { label: "Dívidas", value: org.totalDividas, icon: CreditCard, color: "text-warning" },
          { label: "Compromisso", value: null, icon: Target, color: org.grauCompromissoPrev <= 70 ? "text-success" : org.grauCompromissoPrev <= 90 ? "text-warning" : "text-destructive", pct: org.grauCompromissoPrev },
        ].map((c, i) => (
          <Card key={i} className="shadow-soft rounded-xl">
            <CardContent className="p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                <span className="text-[10px] text-muted-foreground truncate">{c.label}</span>
              </div>
              <p className={`text-base font-heading font-bold ${c.color}`}>
                {c.pct !== undefined ? `${c.pct.toFixed(0)}%` : fmt(c.value!)}
              </p>
              {c.var !== undefined && <VariationBadge value={c.var} />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI loading state */}
      {aiLoading && !content && (
        <Card className="shadow-card rounded-2xl"><CardContent className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Analisando comportamento financeiro...</span></div>
        </CardContent></Card>
      )}

      {/* No content placeholder */}
      {!content && !aiLoading && (
        <Card className="shadow-card rounded-2xl border-dashed border-2 border-border/40">
          <CardContent className="py-16 text-center">
            <div className="p-5 rounded-full bg-primary/5 w-fit mx-auto mb-5"><Lightbulb className="h-12 w-12 text-primary/25" strokeWidth={1.5} /></div>
            <h3 className="font-heading font-semibold text-lg text-foreground/70 mb-2">Conselhos personalizados</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              Clique em "Gerar análise IA" para receber conselhos práticos baseados nos seus hábitos financeiros.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Distributed AI blocks — each as an independent advisor card */}
      {aiBlocks.interpretacao && <AdvisorCard title="Diagnóstico Executivo" icon={Sparkles} content={aiBlocks.interpretacao} variant="default" />}
      {aiBlocks.comprometimento && <AdvisorCard title="Comprometimento Financeiro" icon={TrendingDown} content={aiBlocks.comprometimento} variant="default" />}
      {aiBlocks.prioridades && <AdvisorCard title="Prioridades Estratégicas" icon={Target} content={aiBlocks.prioridades} variant="default" />}
      {aiBlocks.perguntas && <AdvisorCard title="Perguntas Estratégicas" icon={AlertTriangle} content={aiBlocks.perguntas} variant="alert" />}
      {aiBlocks.plano && <AdvisorCard title="Plano de Ação" icon={CheckCircle2} content={aiBlocks.plano} variant="action" />}
      {aiBlocks.extras.map((extra, i) => (
        <AdvisorCard key={`extra-${i}`} title="Seu Próximo Passo" icon={Sparkles} content={extra} variant="opportunity" />
      ))}

      {content && !aiLoading && <AtlasReportClosing category="disciplina" />}

      {aiLoading && content && (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Gerando conselhos...</span></div>
      )}
      </div>
    </div>
  );
};

export default RelatoriosMensais;