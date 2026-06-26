import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CreditCard, Plus, History, Bot, Upload, Eye, BookOpen, Activity, Lock, ArrowLeft } from "lucide-react";
import FaturaImportTab, { type ImportResult, type StatementLine } from "@/components/fatura/FaturaImportTab";
import FaturaReviewTab from "@/components/fatura/FaturaReviewTab";
import FaturaHistoryTab from "@/components/fatura/FaturaHistoryTab";
import FaturaRulesTab from "@/components/fatura/FaturaRulesTab";
import FaturaAuditTab from "@/components/fatura/FaturaAuditTab";
import FaturaSummaryCards from "@/components/fatura/FaturaSummaryCards";
import FaturaDistributionChart from "@/components/fatura/FaturaDistributionChart";
import FaturaConfidenceIndicator from "@/components/fatura/FaturaConfidenceIndicator";
import FaturaInsights from "@/components/fatura/FaturaInsights";
import { usePlan } from "@/hooks/usePlan";
import { useUserRole } from "@/hooks/useUserRole";

export default function Fatura() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const plan = usePlan();
  const { isAdmin } = useUserRole();
  const [tab, setTab] = useState("import");
  const [currentStatementId, setCurrentStatementId] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [lines, setLines] = useState<StatementLine[]>([]);
  const [stats, setStats] = useState<ImportResult["stats"] | null>(null);
  const [historyRefresh, setHistoryRefresh] = useState(0);

  // Guard: non-admin trying to access admin-only tabs
  const handleTabChange = useCallback((value: string) => {
    if ((value === "rules" || value === "audit") && !isAdmin) {
      setTab("import");
      return;
    }
    setTab(value);
  }, [isAdmin]);

  const handleImportComplete = useCallback((result: ImportResult) => {
    setCurrentStatementId(result.statementId);
    setLines(result.lines);
    setStats(result.stats);
    setTab("review");
    setHistoryRefresh(p => p + 1);
  }, []);

  const handleOpenStatement = useCallback(async (id: string, month: string) => {
    if (!user) return;
    const { data } = await supabase.from("credit_card_statement_lines" as any)
      .select("*").eq("statement_id", id).order("line_index", { ascending: true });
    if (data) {
      const mapped: StatementLine[] = (data as any[]).map(d => ({
        ...d, purchase_date: d.purchase_date, merchant_raw: d.merchant_raw || "",
        merchant_norm: d.merchant_norm || "", raw_text: d.raw_text || "",
        isDuplicate: d.status === "duplicate", knownInstallment: false, keepAsIs: false,
      }));
      setCurrentStatementId(id);
      setCurrentMonth(month);
      setLines(mapped);
      const { data: stmt } = await supabase.from("credit_card_statements" as any)
        .select("*").eq("id", id).single();
      if (stmt) {
        const s = stmt as any;
        setStats({
          total: s.total_items, byRules: s.rule_items_count || 0,
          byCache: s.cache_items_count || 0, byAI: s.ai_items_count || 0,
          provider: s.provider || s.source_name, bank: s.source_name,
          estimatedTokens: s.tokens_in || 0, processingMs: s.latency_ms || 0,
        });
      }
      setTab("review");
    }
  }, [user]);

  const handleApplied = useCallback(() => {
    setLines([]);
    setCurrentStatementId(null);
    setStats(null);
    setTab("history");
    setHistoryRefresh(p => p + 1);
  }, []);

  const pendingCount = lines.filter(l => l.status === "pending_review").length;

  return (
    <div className="relative">
      {/* Overlay for non-admin users */}
      {!isAdmin && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-2xl">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md text-center space-y-4 mx-4">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-heading font-bold text-foreground">Em breve</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Estamos finalizando a importação automática de faturas. Você poderá usar essa área em breve.
            </p>
            <p className="text-xs text-muted-foreground/60">
              Enquanto isso, use o módulo de lançamentos para registrar seus gastos com cartão.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => navigate("/dashboard/renda-despesas")}>
                <ArrowLeft className="h-4 w-4" /> Voltar
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className={`space-y-5 p-1 md:p-4 ${!isAdmin ? "pointer-events-none select-none" : ""}`}>
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
              <CreditCard className="h-7 w-7 text-primary" />
              Faturas do Cartão
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Importe, revise e transforme sua fatura em lançamentos em 1 clique.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {stats?.bank && (
              <Badge variant="outline" className="text-xs gap-1">
                <CreditCard className="h-3 w-3" /> {stats.bank}
              </Badge>
            )}
            {stats && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="outline" className="text-xs cursor-default">
                      ~US$ {((stats.estimatedTokens || 0) * 0.00015 / 1000).toFixed(4)}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="text-xs">
                    Custo estimado da IA nesta fatura ({stats.estimatedTokens || 0} tokens, {stats.processingMs || 0}ms)
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Badge variant={plan.isFull ? "default" : "secondary"} className="text-xs">
              {plan.isFull ? "Plano Full" : plan.isTrialActive ? "Trial" : "Free"}
            </Badge>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger>
                  <Badge variant="outline" className="text-xs gap-1 cursor-default">
                    <Bot className="h-3 w-3" /> IA: ligado
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  <p className="font-semibold mb-1">Transparência de uso da IA</p>
                  <p>A IA categoriza apenas transações não resolvidas por regras ou cache.</p>
                  <p className="mt-1">Nenhuma informação pessoal é armazenada pela IA ou usada para treinamento de modelos. Os dados são processados de forma efêmera.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button size="sm" onClick={() => setTab("import")}>
              <Plus className="h-4 w-4 mr-1" /> Importar nova
            </Button>
          </div>
        </div>

        {/* Summary + metrics panel */}
        <FaturaSummaryCards lines={lines} stats={stats} />

        {lines.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FaturaDistributionChart lines={lines} />
            <FaturaConfidenceIndicator lines={lines} />
            <FaturaInsights lines={lines} statementMonth={currentMonth} />
          </div>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="import" className="gap-1"><Upload className="h-3.5 w-3.5" /> Importação</TabsTrigger>
            <TabsTrigger value="review" className="gap-1 relative">
              <Eye className="h-3.5 w-3.5" /> Revisão
              {pendingCount > 0 && <span className="ml-1 bg-destructive text-destructive-foreground text-[9px] px-1 rounded-full">{pendingCount}</span>}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1"><History className="h-3.5 w-3.5" /> Histórico</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="rules" className="gap-1"><BookOpen className="h-3.5 w-3.5" /> Regras</TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="audit" className="gap-1"><Activity className="h-3.5 w-3.5" /> Auditoria</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="import">
            <FaturaImportTab onImportComplete={handleImportComplete} />
          </TabsContent>
          <TabsContent value="review">
            <FaturaReviewTab statementId={currentStatementId} lines={lines} setLines={setLines} statementMonth={currentMonth} onApplied={handleApplied} />
          </TabsContent>
          <TabsContent value="history">
            <FaturaHistoryTab onOpenStatement={handleOpenStatement} refreshKey={historyRefresh} />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="rules">
              <FaturaRulesTab />
            </TabsContent>
          )}
          {isAdmin && (
            <TabsContent value="audit">
              <FaturaAuditTab statementId={currentStatementId} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
