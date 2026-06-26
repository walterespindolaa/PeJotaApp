import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Wallet, Landmark, TrendingUp, RefreshCw, Loader2, Clock, Sparkles, Building2 } from "lucide-react";
import { type PeriodFilter, PERIOD_LABELS, loadPeriodFilter, savePeriodFilter } from "@/lib/dateRange";
import { useReportPersistence } from "@/hooks/useReportPersistence";
import { renderMarkdownSections } from "@/lib/renderMarkdown";
import FluxoCaixa from "@/components/relatorio/FluxoCaixa";
import AtlasReportHeader from "@/components/report/AtlasReportHeader";
import AtlasReportClosing from "@/components/report/AtlasReportClosing";
import AIReportDisclaimer from "@/components/legal/AIReportDisclaimer";
import ReportIntro from "@/components/report/ReportIntro";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";

const REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/financial-report`;

// Consultive AI block card
const AIBlock = ({ title, icon: Icon, content: md }: { title: string; icon: React.ElementType; content: string }) => {
  if (!md.trim()) return null;
  return (
    <Card className="shadow-card rounded-2xl border-primary/10 bg-gradient-to-br from-card to-primary/[0.02]">
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border/30">
          <div className="p-1.5 rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
          <h3 className="font-heading font-bold text-sm">{title}</h3>
        </div>
        <div className="prose-sm max-w-none">{renderMarkdownSections(md)}</div>
      </CardContent>
    </Card>
  );
};

const Projecoes = () => {
  const { user } = useAuth();
  const { view: householdView } = useHouseholdView();
  const [dataLoading, setDataLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodFilter>(loadPeriodFilter);
  const { content, loading: aiLoading, initialLoading, generatedAt, generateReport, downloadPDF } = useReportPersistence("financeiro");

  const [cashflow, setCashflow] = useState({ receita: 0, despesa: 0, economia: 0, taxaPoupanca: 0 });

  const handlePeriodChange = (v: string) => { const f = v as PeriodFilter; setPeriod(f); savePeriodFilter(f); };

  useEffect(() => {
    if (user) setDataLoading(false);
  }, [user]);

  // Split AI content into blocks by ## headers (emoji-tolerant)
  const aiBlocks = useMemo(() => {
    const empty = { panorama: "", categorias: "", alertas: "", oportunidades: "", extras: [] as string[] };
    if (!content) return empty;
    const sections = content.split(/(?=^## )/m);
    let panorama = "", categorias = "", alertas = "", oportunidades = "";
    const extras: string[] = [];
    sections.forEach(s => {
      if (!s.trim().startsWith("##")) return;
      const firstLine = s.split("\n")[0].toLowerCase();
      if (/panorama|fluxo de caixa/.test(firstLine)) panorama = s;
      else if (/radiografia|categorias/.test(firstLine)) categorias = s;
      else if (/alerta/.test(firstLine)) alertas = s;
      else if (/oportunidade|otimiza/.test(firstLine)) oportunidades = s;
      else extras.push(s);
    });
    return { panorama, categorias, alertas, oportunidades, extras };
  }, [content]);

  if (dataLoading && initialLoading) return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div id="financeiro-report">
      <ReportIntro
        whatIs="Um acompanhamento detalhado da sua vida financeira no dia a dia."
        whatYouSee="Seu fluxo de caixa, padrões de gastos, categorias e comportamentos que impactam sua evolução financeira."
        howItHelps="Permite identificar desperdícios, ajustar hábitos e manter sua evolução sob controle constante."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" /> Controle da Jornada | PeJota
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Fluxo de caixa, padrões de gastos e oportunidades de melhoria.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[180px] rounded-xl text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PERIOD_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => downloadPDF("financeiro-report")} variant="outline" className="rounded-xl gap-2" size="sm">
            <Download className="h-4 w-4" /> Baixar PDF
          </Button>
          <Button onClick={() => generateReport(REPORT_URL, { period, visao: householdView })} disabled={aiLoading} className="rounded-xl gap-2" size="sm">
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {aiLoading ? "Gerando..." : content ? "Atualizar IA" : "Gerar análise IA"}
          </Button>
        </div>
      </div>

      {generatedAt && !aiLoading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Última atualização IA: {new Date(generatedAt).toLocaleString("pt-BR")}
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
            <Sparkles className="h-2.5 w-2.5" /> Gerado por IA | PeJota
          </span>
        </div>
      )}

      <AtlasReportHeader title="Controle da Jornada | PeJota" />
      <AIReportDisclaimer />

      {/* AI BLOCK 1 — Panorama do Fluxo de Caixa */}
      {aiBlocks.panorama && <AIBlock title="Análise — Panorama do Fluxo de Caixa" icon={Sparkles} content={aiBlocks.panorama} />}
      {aiLoading && !content && (
        <Card className="shadow-card rounded-2xl"><CardContent className="p-6">
          <div className="flex items-center gap-3 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Analisando fluxo de caixa...</span></div>
        </CardContent></Card>
      )}

      {/* AI BLOCK 2 — Radiografia de Categorias */}
      {aiBlocks.categorias && <AIBlock title="Análise — Radiografia de Categorias" icon={Building2} content={aiBlocks.categorias} />}

      {/* Fluxo de Caixa */}
      <Card className="shadow-soft rounded-2xl">
        <CardHeader className="pb-2"><CardTitle className="font-heading text-base">Fluxo de Caixa</CardTitle></CardHeader>
        <CardContent><FluxoCaixa period={period} onDataChange={setCashflow} /></CardContent>
      </Card>

      {/* AI BLOCK 3 — Alertas Operacionais */}
      {aiBlocks.alertas && <AIBlock title="Análise — Alertas Operacionais" icon={TrendingUp} content={aiBlocks.alertas} />}

      {/* AI BLOCK 4 — Oportunidades de Otimização */}
      {aiBlocks.oportunidades && <AIBlock title="Análise — Oportunidades de Otimização" icon={Wallet} content={aiBlocks.oportunidades} />}

      {/* Fallback: unmatched AI sections */}
      {aiBlocks.extras.map((extra, i) => (
        <AIBlock key={`extra-${i}`} title="Análise — Insights Adicionais" icon={Sparkles} content={extra} />
      ))}

      {/* No content placeholder */}
      {!content && !aiLoading && (
        <Card className="shadow-card rounded-2xl border-dashed border-2 border-border/40">
          <CardContent className="py-16 text-center">
            <div className="p-5 rounded-full bg-primary/5 w-fit mx-auto mb-5"><Landmark className="h-12 w-12 text-primary/25" strokeWidth={1.5} /></div>
            <h3 className="font-heading font-semibold text-lg text-foreground/70 mb-2">Leitura operacional do mês</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              Clique em "Gerar análise IA" para receber uma leitura interpretativa do fluxo de caixa, categorias de despesas e oportunidades de otimização.
            </p>
          </CardContent>
        </Card>
      )}

      {content && !aiLoading && <AtlasReportClosing category="futuro" />}

      {aiLoading && content && (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Gerando análise...</span></div>
      )}
      </div>
    </div>
  );
};

export default Projecoes;
