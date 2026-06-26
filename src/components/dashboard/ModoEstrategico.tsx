import { useState, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Target, AlertTriangle, Info, Zap, ArrowRight, Lightbulb } from "lucide-react";
import { EmojiIcon } from "@/components/EmojiIcon";
import { MoneyValue, PercentValue, usePrivacyFmt } from "@/components/PrivacyValue";

interface ModoEstrategicoProps {
  receitaMedia3m: number;
  despesaMedia3m: number;
  economiaMedia3m: number;
  metaValor?: number;
  metaAcumulado?: number;
}

const STRATEGIC_WEIGHTS = [
  { key: "margem", label: "Margem financeira", desc: "Quanto sobra da receita após despesas", icon: "💰", weight: 40 },
  { key: "poupanca", label: "Disciplina de aportes", desc: "% da receita efetivamente economizada/investida", icon: "🐷", weight: 40 },
  { key: "equilibrio", label: "Equilíbrio receita/despesa", desc: "Viver dentro do orçamento de forma consistente", icon: "⚖️", weight: 20 },
];

const SCORE_BANDS = [
  { min: 0, max: 39, label: "Instável", color: "text-destructive", bg: "bg-destructive", ring: "hsl(var(--destructive))", emoji: "🔴", desc: "Vida financeira reativa e vulnerável" },
  { min: 40, max: 69, label: "Organização", color: "text-warning", bg: "bg-warning", ring: "hsl(var(--warning))", emoji: "🟡", desc: "Controle iniciado, ajustes necessários" },
  { min: 70, max: 89, label: "Estrutura", color: "text-success", bg: "bg-success", ring: "hsl(var(--success))", emoji: "🟢", desc: "Disciplina consistente e visão clara" },
  { min: 90, max: 100, label: "Estratégico", color: "text-info", bg: "bg-info", ring: "hsl(var(--info))", emoji: "🔵", desc: "Tomada de decisão consciente e sustentável" },
];

function calcStrategicScore(receita: number, despesa: number, economia: number): number {
  if (receita <= 0) return 0;
  const margem = (receita - despesa) / receita;
  const poupanca = economia / receita;
  const score = Math.round(
    Math.min(margem * 40, 40) +
    Math.min(poupanca * 40, 40) +
    (despesa < receita ? 20 : 0)
  );
  return Math.max(0, Math.min(100, score));
}

function getScoreBand(score: number) {
  return SCORE_BANDS.find(b => score >= b.min && score <= b.max) || SCORE_BANDS[0];
}

function getRecommendations(receita: number, despesa: number, economia: number) {
  const tips: { icon: string; text: string }[] = [];
  if (receita <= 0) return [{ icon: "📊", text: "Registre suas receitas para começar a análise estratégica." }];

  const margem = (receita - despesa) / receita;
  const poupanca = economia / receita;

  if (margem < 0.10) tips.push({ icon: "🔴", text: "Reduza despesas ou aumente renda para criar margem mínima de 10%." });
  else if (margem < 0.20) tips.push({ icon: "🟡", text: "Sua margem está razoável. Tente chegar a 20% para conforto financeiro." });

  if (poupanca < 0.05) tips.push({ icon: "🐷", text: "Defina uma meta de aporte mensal — comece com pelo menos 5% da receita." });
  else if (poupanca < 0.15) tips.push({ icon: "📈", text: "Aumente seus aportes gradualmente até 15% para construir patrimônio." });

  if (despesa >= receita) tips.push({ icon: "⚠️", text: "Suas despesas superam a receita. Priorize cortar gastos variáveis." });

  if (tips.length === 0) tips.push({ icon: "✅", text: "Excelente! Mantenha a disciplina e diversifique investimentos." });

  return tips.slice(0, 3);
}

const ModoEstrategico = ({ receitaMedia3m, despesaMedia3m, economiaMedia3m, metaValor, metaAcumulado }: ModoEstrategicoProps) => {
  const [showModal, setShowModal] = useState(false);
  const { fmt, isPrivate } = usePrivacyFmt();

  const saldoMedio = receitaMedia3m - despesaMedia3m;
  const economia5pct = receitaMedia3m * 0.05;
  const score = calcStrategicScore(receitaMedia3m, despesaMedia3m, economiaMedia3m);
  const band = getScoreBand(score);
  const riscoFuturo = saldoMedio < 0;

  const mesesParaMeta = metaValor && metaAcumulado !== undefined && economiaMedia3m > 0
    ? Math.ceil((metaValor - metaAcumulado) / economiaMedia3m) : null;

  // Gauge ring
  const circumference = 2 * Math.PI * 40;
  const dashArray = `${(score / 100) * circumference} ${circumference}`;

  // Component scores for modal
  const margemPct = receitaMedia3m > 0 ? ((receitaMedia3m - despesaMedia3m) / receitaMedia3m) * 100 : 0;
  const poupancaPct = receitaMedia3m > 0 ? (economiaMedia3m / receitaMedia3m) * 100 : 0;
  const componentScores = [
    { ...STRATEGIC_WEIGHTS[0], score: Math.min(margemPct / 20 * 100, 100) },
    { ...STRATEGIC_WEIGHTS[1], score: Math.min(poupancaPct / 20 * 100, 100) },
    { ...STRATEGIC_WEIGHTS[2], score: despesaMedia3m < receitaMedia3m ? 100 : 0 },
  ];

  const recommendations = getRecommendations(receitaMedia3m, despesaMedia3m, economiaMedia3m);

  return (
    <>
      <Card className="shadow-soft border-border/50 border-l-4 border-l-accent">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-accent" />
              <h3 className="text-lg font-heading font-bold">Modo Estratégico</h3>
              <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-heading font-bold uppercase tracking-wider">Projeção</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowModal(true)}>
              <Info className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6">
            {/* Gauge */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-24 h-24">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={band.ring} strokeWidth="8"
                    strokeDasharray={dashArray}
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-heading font-extrabold">{isPrivate ? "••" : score}</span>
                  <span className={`text-[9px] font-heading font-bold ${band.color}`}>{band.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-[10px]">
                {saldoMedio >= 0
                  ? <><TrendingUp className="h-3 w-3 text-success" /><span className="text-success font-medium">Tendência positiva</span></>
                  : <><TrendingDown className="h-3 w-3 text-destructive" /><span className="text-destructive font-medium">Tendência negativa</span></>
                }
              </div>
            </div>

            {/* Stats */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[11px] text-muted-foreground font-body">Receita média (3m)</p>
                  <p className="text-lg font-heading font-bold text-success"><MoneyValue value={receitaMedia3m} /></p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[11px] text-muted-foreground font-body">Despesa média (3m) · inclui dívida</p>
                  <p className="text-lg font-heading font-bold text-destructive"><MoneyValue value={despesaMedia3m} /></p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[11px] text-muted-foreground font-body">Saldo médio</p>
                  <p className={`text-lg font-heading font-bold ${saldoMedio >= 0 ? "text-success" : "text-destructive"}`}>
                    <MoneyValue value={saldoMedio} />
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-[11px] text-muted-foreground font-body">Se economizar +5%</p>
                  <p className="text-lg font-heading font-bold text-info">+<MoneyValue value={economia5pct} />/mês</p>
                </div>
              </div>

              {/* Alerts */}
              <div className="space-y-2">
                {riscoFuturo && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-sm font-body text-destructive">Alerta: tendência de saldo negativo nos próximos meses. Revise despesas recorrentes.</p>
                  </div>
                )}
                {mesesParaMeta && mesesParaMeta > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
                    <TrendingUp className="h-4 w-4 text-info mt-0.5" />
                    <p className="text-sm font-body text-info">Mantendo o ritmo atual, sua meta será atingida em ~{mesesParaMeta} meses.</p>
                  </div>
                )}
                {!riscoFuturo && saldoMedio > 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
                    <TrendingUp className="h-4 w-4 text-success mt-0.5" />
                    <p className="text-sm font-body text-success">Projeção positiva: em 6 meses, saldo acumulado estimado de <MoneyValue value={saldoMedio * 6} />.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground/60 font-body mt-4">
            Projeções baseadas na média dos últimos 3 meses. Resultados reais podem variar.
          </p>
        </CardContent>
      </Card>

      {/* ═══ MODAL PREMIUM ═══ */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-accent/10">
                <Zap className="h-5 w-5 text-accent" />
              </div>
              <div>
                <DialogTitle className="font-heading text-lg">Modo Estratégico</DialogTitle>
                <DialogDescription className="text-sm">
                  Esse indicador resume o quão preparada sua vida financeira está para o futuro.
                </DialogDescription>
              </div>
              <Badge className={`ml-auto ${band.bg} text-white text-sm px-3 py-1`}>
                {isPrivate ? "••" : score}
              </Badge>
            </div>
          </DialogHeader>

          <div className="space-y-6 mt-2">
            {/* ── Barra de Interpretação ── */}
            <div>
              <p className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3">Barra de Interpretação</p>
              <div className="relative">
                {/* Segmented bar */}
                <div className="flex h-4 rounded-full overflow-hidden">
                  {SCORE_BANDS.map((b, i) => {
                    const width = ((b.max - b.min + 1) / 101) * 100;
                    return (
                      <div
                        key={b.label}
                        className={`${b.bg} transition-all relative`}
                        style={{ width: `${width}%` }}
                      />
                    );
                  })}
                </div>
                {/* Pin marker */}
                <div
                  className="absolute -top-1 transition-all duration-500"
                  style={{ left: `${score}%`, transform: "translateX(-50%)" }}
                >
                  <div className="flex flex-col items-center">
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-foreground" />
                    <div className="mt-1 px-2 py-0.5 rounded-md bg-foreground text-background text-[10px] font-heading font-bold whitespace-nowrap">
                      {isPrivate ? "••" : score} — Você está aqui
                    </div>
                  </div>
                </div>
                {/* Labels */}
                <div className="flex mt-6">
                  {SCORE_BANDS.map(b => {
                    const width = ((b.max - b.min + 1) / 101) * 100;
                    return (
                      <div key={b.label} className="text-center" style={{ width: `${width}%` }}>
                        <p className={`text-[9px] font-heading font-bold ${b.color}`}>{b.label}</p>
                        <p className="text-[8px] text-muted-foreground">{b.min}–{b.max}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── O que compõe o indicador ── */}
            <div>
              <p className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3">O que compõe o indicador</p>
              <div className="space-y-3">
                {componentScores.map(comp => (
                  <div key={comp.key} className="p-3 rounded-xl border border-border/50 bg-card">
                    <div className="flex items-center gap-3">
                      <EmojiIcon emoji={comp.icon} className="h-5 w-5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-heading font-semibold">{comp.label}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] font-mono">{comp.weight}%</Badge>
                            <span className={`text-xs font-heading font-bold ${comp.score >= 70 ? "text-success" : comp.score >= 40 ? "text-warning" : "text-destructive"}`}>
                              {isPrivate ? "••" : `${comp.score.toFixed(0)}pts`}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{comp.desc}</p>
                      </div>
                    </div>
                    {/* Mini progress */}
                    <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden mt-2">
                      <div
                        className={`h-full rounded-full transition-all ${comp.score >= 70 ? "bg-success" : comp.score >= 40 ? "bg-warning" : "bg-destructive"}`}
                        style={{ width: `${comp.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Como melhorar ── */}
            <div>
              <p className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5" /> Como melhorar seu score
              </p>
              <div className="space-y-2">
                {recommendations.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 border border-border/30">
                    <EmojiIcon emoji={tip.icon} className="h-4 w-4 mt-0.5" />
                    <p className="text-sm text-foreground leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Faixas de referência ── */}
            <div className="border-t border-border pt-4">
              <p className="text-xs font-heading font-bold text-muted-foreground uppercase tracking-wider mb-3">Faixas de referência</p>
              <div className="grid grid-cols-2 gap-2">
                {SCORE_BANDS.map(b => (
                  <div key={b.label} className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/30">
                    <div className={`w-3 h-3 rounded-full ${b.bg} flex-shrink-0`} />
                    <div>
                      <p className="text-[11px] font-heading font-semibold">{b.min}–{b.max} {b.label}</p>
                      <p className="text-[10px] text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default memo(ModoEstrategico);
