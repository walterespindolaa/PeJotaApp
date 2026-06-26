import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText, RefreshCw, Loader2, Sparkles, Download, Clock,
  Baby, Heart, User, Users, Plane, Globe, Car, CarFront, Home,
  GraduationCap, Stethoscope, Palmtree, TrendingUp, Target, AlertTriangle,
  Landmark, Building2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDependentes } from "@/hooks/useDependentes";
import { usePremissas } from "@/hooks/usePremissas";
import { useReportPersistence } from "@/hooks/useReportPersistence";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { renderMarkdownSections } from "@/lib/renderMarkdown";
import { FV, PV, PMT } from "@/lib/financial";
import { usePrivacyFmt } from "@/components/PrivacyValue";
import CenariosChart from "@/components/aposentadoria/CenariosChart";
import AtlasReportHeader from "@/components/report/AtlasReportHeader";
import AtlasReportClosing from "@/components/report/AtlasReportClosing";
import AIReportDisclaimer from "@/components/legal/AIReportDisclaimer";
import ReportIntro from "@/components/report/ReportIntro";
import RelatorioSecoesAvancadas from "@/components/report/RelatorioSecoesAvancadas";
import type { LucideIcon } from "lucide-react";

const REPORT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-report`;

const OBJ_ICON_MAP: Record<string, LucideIcon> = {
  viagem_nacional: Plane, viagem_internacional: Globe,
  troca_carro: CarFront, compra_carro: Car, compra_imovel: Home,
  casamento: Heart, faculdade: GraduationCap, intercambio: Globe,
  residencia_medica: Stethoscope, sabatico: Palmtree, outro: Sparkles,
};

const DEP_ICON_MAP: Record<string, LucideIcon> = {
  filho: Baby, mae: Heart, pai: User, conjuge: Heart, irmao: Users, outro: User,
};

function guessObjIcon(nome: string): LucideIcon {
  const n = nome.toLowerCase();
  if (n.includes("viagem")) return n.includes("inter") ? Globe : Plane;
  if (n.includes("carro")) return Car;
  if (n.includes("imóvel") || n.includes("casa") || n.includes("apart")) return Home;
  if (n.includes("casamento")) return Heart;
  if (n.includes("faculdade") || n.includes("curso")) return GraduationCap;
  if (n.includes("intercâmbio") || n.includes("intercambio")) return Globe;
  return Sparkles;
}

const calcAge = (dataNasc: string | null): number | null => {
  if (!dataNasc) return null;
  const birth = new Date(dataNasc + "T12:00:00");
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--;
  return age;
};

const fmtBRL = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

const RelatorioVida = () => {
  const { user } = useAuth();
  const { fmt } = usePrivacyFmt();
  const { dependentes } = useDependentes();
  const { view: householdView } = useHouseholdView();
  const { content, loading, initialLoading, generatedAt, generateReport, downloadPDF } = useReportPersistence("planejamento_360");

  const [userName, setUserName] = useState("");
  const [retirementData, setRetirementData] = useState<any>(null);
  const [objetivos, setObjetivos] = useState<any[]>([]);
  const [investimentos, setInvestimentos] = useState<any[]>([]);
  const [bens, setBens] = useState<any[]>([]);
  const [rendaMensal, setRendaMensal] = useState(0);
  const [despesaMensal, setDespesaMensal] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [profileRes, aposentRes, invRes, bensRes, objRes, recRes, despRes] = await Promise.all([
        supabase.from("profiles").select("full_name, nome_pessoa1").eq("user_id", user.id).maybeSingle(),
        supabase.from("aposentadoria").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("investimentos_financeiros").select("nome, tipo, classe, valor_atual, total_aportado, instituicao").eq("user_id", user.id),
        supabase.from("investimentos_nao_financeiros").select("nome, tipo, valor, divida_vinculada, gera_renda, valor_renda").eq("user_id", user.id),
        supabase.from("objetivos").select("nome, valor_objetivo, valor_acumulado, data_objetivo, frequencia, detalhes, responsavel, aporte_mensal").eq("user_id", user.id),
        supabase.from("receitas").select("valor").eq("user_id", user.id).eq("recorrente", true),
        supabase.from("despesas").select("valor").eq("user_id", user.id).eq("recorrente", true).eq("is_parcelada", false),
      ]);

      setUserName((profileRes.data as any)?.full_name || (profileRes.data as any)?.nome_pessoa1 || "");
      setInvestimentos(invRes.data || []);
      setBens((bensRes.data || []) as any[]);
      setObjetivos((objRes.data || []) as any[]);
      setRendaMensal(((recRes.data || []) as any[]).reduce((s, r) => s + Number(r.valor || 0), 0));
      setDespesaMensal(((despRes.data || []) as any[]).reduce((s, d) => s + Number(d.valor || 0), 0));

      const apo = aposentRes.data as any;
      if (apo) {
        const patFin = (invRes.data || []).reduce((s: number, i: any) => s + Number(i.valor_atual || 0), 0);
        const bensData = bensRes.data || [];
        const patBens = bensData.reduce((s: number, b: any) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0);
        const rendaBens = bensData.filter((b: any) => b.gera_renda).reduce((s: number, b: any) => s + Number(b.valor_renda || 0), 0);

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

        const patrimonioAtual = patFin + (incluirBens ? patBens : 0);
        const rendaPassivaTotal = rendaPassAtu + (incluirBens ? rendaBens : 0);
        const gapMensal = Math.max(0, rendaDes - rendaPassivaTotal);
        const mesesAte = Math.max(0, (idadeAp - idadeAtual) * 12);
        const mesesPos = Math.max(0, (expVida - idadeAp) * 12);

        const realidade = mesesAte > 0 ? FV(r, mesesAte, -poupMen, -patrimonioAtual) : patrimonioAtual;
        const consumoH23 = mesesPos > 0 && gapMensal > 0 ? -PV(r, mesesPos, gapMensal, 0) : 0;
        const poupConsumo = gapMensal > 0 && mesesAte > 0 ? -PMT(r, mesesAte, -patrimonioAtual, consumoH23) : 0;
        const viverL23 = gapMensal > 0 && r > 0 ? gapMensal / r : 0;
        const poupViver = gapMensal > 0 && mesesAte > 0 ? -PMT(r, mesesAte, -patrimonioAtual, viverL23) : 0;

        setRetirementData({
          idadeAtual, idadeAposentadoria: idadeAp, expectativaVida: expVida, inflacao: infl,
          patrimonioAtual, poupancaMensal: poupMen, taxaRealMensal: r,
          rendaDesejada: rendaDes, rendaPassiva: rendaPassivaTotal,
          rendaPassivaAtual: rendaPassAtu, rendaPassivaBens: rendaBens, incluirBens,
          poupancaConsumo: poupConsumo, poupancaViverRenda: poupViver,
          patrimonioRealidade: realidade, montanteConsumo: consumoH23, montanteViverRenda: viverL23,
          gapMensal,
        });
      }
    })();
  }, [user]);

  const patFin = investimentos.reduce((s, i: any) => s + Number(i.valor_atual || 0), 0);
  const patBens = bens.reduce((s, b: any) => s + Number(b.valor || 0) - Number(b.divida_vinculada || 0), 0);
  const totalObjMensal = objetivos.reduce((s, o: any) => s + Number(o.aporte_mensal || 0), 0);

  const renderContentWithVisuals = () => {
    if (!content) return null;
    const sections = content.split(/(?=^## )/m);
    const result: JSX.Element[] = [];

    sections.forEach((section, idx) => {
      result.push(<div key={`s-${idx}`}>{renderMarkdownSections(section)}</div>);

      // After Objetivos section — inject visual block
      if (section.match(/## \d+\.\s*(Objetivos de Vida|Objetivos)/i) && objetivos.length > 0) {
        result.push(
          <div key="obj-visuals" className="my-6 p-5 rounded-2xl bg-muted/20 border border-border/30">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-heading font-bold text-sm flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Objetivos de Vida</h4>
              <span className="text-xs font-semibold text-primary">Total mensal: {fmtBRL(totalObjMensal)}</span>
            </div>
            <div className="space-y-2">
              {objetivos.map((o: any, i: number) => {
                const Icon = guessObjIcon(o.nome);
                return (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border/20">
                    <div className="p-1.5 rounded-lg bg-primary/10"><Icon className="h-4 w-4 text-primary" /></div>
                    <span className="text-sm font-medium flex-1 truncate">{o.nome}</span>
                    <span className="text-xs text-muted-foreground">{o.aporte_mensal ? `${fmtBRL(o.aporte_mensal)}/mês` : "—"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      // After patrimônio-related section — inject simple summary (NOT detailed tables)
      if (section.match(/## \d+\.\s*(Bens.*Invest|Invest.*Bens|Investimentos|Capacidade de Poupan)/i)) {
        result.push(
          <div key="pat-summary" className="my-6">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Financeiro</p>
                <p className="text-sm font-bold text-primary">{fmt(patFin)}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Bens (líquido)</p>
                <p className="text-sm font-bold">{fmt(patBens)}</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/30 text-center">
                <p className="text-xs text-muted-foreground">Patrimônio Total</p>
                <p className="text-sm font-bold text-success">{fmt(patFin + patBens)}</p>
              </div>
            </div>
          </div>
        );
      }

      // After Aposentadoria section — inject charts
      if (section.match(/## \d+\.\s*(Aposentadoria|Aposentadoria e Longo Prazo)/i) && retirementData) {
        result.push(
          <div key="ret-visuals" className="my-6 space-y-4">
            <CenariosChart {...retirementData} />
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <ScenarioCard title="Cenário Realidade" icon={TrendingUp} value={retirementData.patrimonioRealidade} description="Patrimônio projetado mantendo aportes atuais" variant="default" />
              <ScenarioCard title="Cenário Consumo" icon={Target} value={retirementData.montanteConsumo} description="Necessário para gastar até o fim da vida" variant="warning" />
              <ScenarioCard title="Cenário Viver de Renda" icon={Sparkles} value={retirementData.montanteViverRenda} description="Necessário para viver de renda perpetuamente" variant="premium" />
            </div>
          </div>
        );
      }

      // After Dependentes section — inject cards
      if (section.match(/## \d+\.\s*(Dependentes|Impactos Familiares)/i) && dependentes.length > 0) {
        result.push(
          <div key="dep-visuals" className="my-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dependentes.map((dep) => {
                const Icon = DEP_ICON_MAP[dep.tipo] || User;
                const age = calcAge(dep.data_nascimento);
                const linked = objetivos.filter((o: any) => {
                  const det = (o.detalhes || o.nome || "").toLowerCase();
                  return det.includes((dep.nome || "").toLowerCase().split(" ")[0]);
                });
                return (
                  <Card key={dep.id} className="rounded-xl border border-border/40 bg-card shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-full bg-primary/10"><Icon className="h-5 w-5 text-primary" /></div>
                        <div>
                          <p className="font-semibold text-sm text-foreground">{dep.nome}</p>
                          <p className="text-xs text-muted-foreground">{dep.parentesco}{age !== null ? ` · ${age} anos` : ""}</p>
                        </div>
                      </div>
                      {dep.observacoes && <p className="text-xs text-muted-foreground mt-1">{dep.observacoes}</p>}
                      {linked.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/30">
                          <p className="text-xs text-muted-foreground mb-1">Objetivos vinculados:</p>
                          {linked.map((o: any, j: number) => {
                            const OIcon = guessObjIcon(o.nome);
                            return (
                              <div key={j} className="flex items-center gap-1.5 text-xs text-foreground/80">
                                <OIcon className="h-3 w-3 text-primary/60" /><span>{o.nome}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      }
    });

    return result;
  };

  if (initialLoading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary/40" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <ReportIntro
        whatIs="O planejamento do caminho que você precisa seguir para alcançar seus objetivos."
        whatYouSee="Seus objetivos financeiros, o tempo necessário para alcançá-los e os ajustes necessários na sua rotina e nos seus investimentos."
        howItHelps="Transforma metas soltas em um plano concreto, mostrando exatamente o que precisa ser feito para evoluir."
      />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary/10"><FileText className="h-7 w-7 text-primary" strokeWidth={1.5} /></div>
            <div>
              <h1 className="text-2xl font-heading font-bold">Estratégia de Subida | PeJota</h1>
              {userName && <p className="text-sm text-muted-foreground font-medium">{userName}</p>}
              <p className="text-muted-foreground text-xs">Seus objetivos, o tempo para alcançá-los e os ajustes necessários na rotina.</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {content && (
            <Button onClick={() => downloadPDF("report-content")} variant="outline" className="gap-2 rounded-xl" size="lg">
              <Download className="h-4 w-4" /> Baixar PDF
            </Button>
          )}
          <Button onClick={() => generateReport(REPORT_URL, { visao: householdView })} disabled={loading} className="gap-2 rounded-xl shadow-sm" size="lg">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {loading ? "Gerando..." : content ? "Atualizar análise da IA" : "Gerar análise com IA"}
          </Button>
        </div>
      </div>

      {generatedAt && !loading && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" /> Última atualização em: {new Date(generatedAt).toLocaleString("pt-BR")}
        </div>
      )}

      {!content && !loading && (
        <Card className="shadow-card rounded-2xl border-dashed border-2 border-border/40">
          <CardContent className="py-20 text-center">
            <div className="p-6 rounded-full bg-primary/5 w-fit mx-auto mb-6"><Sparkles className="h-14 w-14 text-primary/25" strokeWidth={1.5} /></div>
            <h3 className="font-heading font-semibold text-xl text-foreground/70 mb-2">Estratégia de Subida</h3>
            <p className="text-muted-foreground max-w-md mx-auto text-sm">
              Clique em "Gerar análise com IA" para transformar seus objetivos em um plano concreto com prazos, ajustes e próximos passos.
            </p>
          </CardContent>
        </Card>
      )}

      {(content || loading) && (
        <div id="report-content">
          <AtlasReportHeader title="Estratégia de Subida | PeJota" userName={userName} />
          <AIReportDisclaimer />

          {/* Executive Summary */}
          {content && !loading && (
            <Card className="shadow-card rounded-2xl border-primary/15 bg-gradient-to-r from-primary/5 to-transparent mb-6">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-heading font-bold">Síntese Executiva</h3>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">
                  Avaliação da viabilidade do plano de vida de {userName || "você"}: capacidade de poupança, objetivos, aposentadoria e renda ideal. Este relatório identifica gaps entre o que você quer e o que é possível, e sugere ajustes para viabilizar o planejamento.
                </p>
              </CardContent>
            </Card>
          )}

          {loading && !content && (
            <Card className="shadow-card rounded-2xl bg-card mb-6">
              <CardContent className="p-8 sm:p-10">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /><span className="text-sm">Analisando seus dados financeiros...</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Each section is its own direct child of #report-content so the
              PDF engine breaks pages BETWEEN sections, never mid-sentence */}
          {renderContentWithVisuals()?.map((item) => (
            <Card key={item.key} className="shadow-card rounded-2xl bg-card mb-6 break-inside-avoid">
              <CardContent className="p-8 sm:p-10">
                <div className="prose-sm max-w-none">{item}</div>
              </CardContent>
            </Card>
          ))}

          {loading && content && (
            <div className="flex items-center gap-2 text-muted-foreground mb-6">
              <Loader2 className="h-4 w-4 animate-spin" /><span className="text-xs">Gerando...</span>
            </div>
          )}

          {/* Seções de dados (Fluxo, Projeção, Patrimônio, Termos, Disclaimer) — saem também no PDF */}
          {content && !loading && (
            <RelatorioSecoesAvancadas
              investimentos={investimentos}
              bens={bens}
              retirementData={retirementData}
              rendaMensal={rendaMensal}
              despesaMensal={despesaMensal}
            />
          )}

          {content && !loading && <AtlasReportClosing category="diagnostico" />}
        </div>
      )}
    </div>
  );
};

function ScenarioCard({ title, icon: Icon, value, description, variant }: {
  title: string; icon: LucideIcon; value: number; description: string;
  variant: "default" | "warning" | "premium";
}) {
  const colors = {
    default: "bg-card border-border/40",
    warning: "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/40",
    premium: "bg-primary/5 border-primary/20",
  };
  return (
    <Card className={`rounded-xl border ${colors[variant]} shadow-sm`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-primary/70" />
          <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">{title}</span>
        </div>
        <p className="text-lg font-bold text-foreground">{fmtBRL(value)}</p>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export default RelatorioVida;
