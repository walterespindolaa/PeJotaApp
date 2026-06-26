import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ATLAS_LEVELS, type AtlasLevelDef, type LevelRequirement } from "@/lib/atlasScore";
import { Check, X, ChevronDown, ChevronUp, Mountain, Flag, Compass, Tent, Footprints, Shield, Wallet, TrendingUp, PieChart, LineChart } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

// Ícone Lucide por requisito (substitui 🛡️💰📈🎲 — mapeado por chave, sem mexer no motor do Score).
const REQ_ICONS: Record<string, typeof Check> = {
  reserva: Shield,
  margem: Wallet,
  aportes: TrendingUp,
  diversificacao: PieChart,
  evolucao: LineChart,
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentScore: number;
  currentLevelIndex: number;
  requirements: LevelRequirement[];
  nextLevel: AtlasLevelDef | null;
}

// Phase descriptions and checklists for each level
const PHASE_DETAILS: Record<string, { meaning: string; whatItMeans: string; checklist: string[] }> = {
  "Sobrevivência": {
    meaning: "Você está no modo reativo — cobrindo o essencial, mas sem visão do futuro.",
    whatItMeans: "Nesta fase, o foco é sobreviver financeiramente. Não há reserva, controle é mínimo e qualquer imprevisto gera crise.",
    checklist: ["Ter receita > despesa por 1 mês", "Registrar todas as despesas", "Identificar as 3 maiores despesas", "Criar uma meta financeira"],
  },
  "Estabilização": {
    meaning: "Você começou a organizar suas finanças, mas ainda está vulnerável.",
    whatItMeans: "Há controle básico, mas a reserva ainda é insuficiente e a disciplina não é consistente. Imprevistos ainda causam impacto significativo.",
    checklist: ["Reserva de emergência ≥ 1 mês", "Margem positiva por 3 meses", "Começar aportes mensais", "Reduzir despesas desnecessárias"],
  },
  "Organização": {
    meaning: "Sua base está construída. Agora é hora de otimizar e diversificar.",
    whatItMeans: "Você tem controle, economiza regularmente e possui reserva parcial. O próximo passo é diversificar e aumentar a consistência.",
    checklist: ["Reserva de emergência ≥ 3 meses", "Investir em pelo menos 2 classes", "Margem financeira ≥ 15%", "Aportes consistentes por 6 meses"],
  },
  "Estrutura": {
    meaning: "Disciplina consistente e visão clara do futuro financeiro.",
    whatItMeans: "Sua vida financeira é sólida. Reserva completa, investimentos diversificados e planejamento de aposentadoria em andamento.",
    checklist: ["Reserva ≥ 6 meses de despesas", "3+ classes de investimento", "Plano de aposentadoria configurado", "Patrimônio em crescimento"],
  },
  "Estratégico": {
    meaning: "Tomada de decisão consciente e sustentável. Nível máximo.",
    whatItMeans: "Você tem autonomia financeira em construção. Patrimônio diversificado, aposentadoria planejada e risco controlado.",
    checklist: ["Reserva ≥ 8 meses", "4+ classes de investimento", "Aposentadoria com aportes consistentes", "Patrimônio líquido em crescimento"],
  },
};

// Lucide icon + theme per phase (ordered same as ATLAS_LEVELS index)
const LEVEL_ICONS = [
  { Icon: Footprints, iconColor: "text-red-500",     bgColor: "bg-red-500/15",     borderColor: "border-red-500/40",     lineColor: "bg-red-500/40"     },
  { Icon: Tent,       iconColor: "text-amber-500",   bgColor: "bg-amber-500/15",   borderColor: "border-amber-500/40",   lineColor: "bg-amber-500/40"   },
  { Icon: Compass,    iconColor: "text-yellow-500",  bgColor: "bg-yellow-500/15",  borderColor: "border-yellow-500/40",  lineColor: "bg-yellow-500/40"  },
  { Icon: Mountain,   iconColor: "text-emerald-500", bgColor: "bg-emerald-500/15", borderColor: "border-emerald-500/40", lineColor: "bg-emerald-500/40" },
  { Icon: Flag,       iconColor: "text-blue-500",    bgColor: "bg-blue-500/15",    borderColor: "border-blue-500/40",    lineColor: "bg-blue-500/40"    },
] as const;

// Helper to render the icon for a given level index in a specific size
function LevelIcon({ index, size = 4, className = "" }: { index: number; size?: number; className?: string }) {
  const { Icon } = LEVEL_ICONS[index];
  return <Icon className={cn(`h-${size} w-${size}`, className)} />;
}

const AtlasJourneyMap = ({ open, onOpenChange, currentScore, currentLevelIndex, requirements, nextLevel }: Props) => {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(currentLevelIndex);

  const currentLevel = ATLAS_LEVELS[currentLevelIndex];
  const nextLevelDef = currentLevelIndex < ATLAS_LEVELS.length - 1 ? ATLAS_LEVELS[currentLevelIndex + 1] : null;
  const progressToNext = nextLevelDef
    ? Math.min(100, ((currentScore - currentLevel.min) / (nextLevelDef.min - currentLevel.min)) * 100)
    : 100;
  const pointsToNext = nextLevelDef ? nextLevelDef.min - currentScore : 0;

  // Render levels from top (summit = Estratégico) to bottom (base = Sobrevivência)
  const levelsDescending = [...ATLAS_LEVELS].reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-full max-h-[80vh] rounded-3xl p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0 text-left">
          <DialogTitle className="font-heading text-lg flex items-center gap-2">
            <Mountain className="h-5 w-5 text-primary" />
            Jornada Atlas
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Sua evolução financeira em 5 níveis. Score atual: <span className="font-bold text-foreground">{currentScore}</span>
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="p-6 pt-3">

            {/* ── Progress to next level ── */}
            {nextLevelDef && (
              <div className="mb-5 p-4 rounded-xl bg-muted/30 border border-border/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-1.5 rounded-lg", LEVEL_ICONS[currentLevelIndex].bgColor)}>
                      <LevelIcon index={currentLevelIndex} size={4} className={LEVEL_ICONS[currentLevelIndex].iconColor} />
                    </div>
                    <span className="text-sm font-heading font-bold">{currentLevel.label}</span>
                    <span className="text-muted-foreground/50">→</span>
                    <div className={cn("p-1.5 rounded-lg", LEVEL_ICONS[currentLevelIndex + 1].bgColor)}>
                      <LevelIcon index={currentLevelIndex + 1} size={4} className={LEVEL_ICONS[currentLevelIndex + 1].iconColor} />
                    </div>
                    <span className="text-sm font-heading font-bold">{nextLevelDef.label}</span>
                  </div>
                  <span className="text-xs font-heading font-bold text-primary">{Math.round(progressToNext)}%</span>
                </div>
                <Progress value={progressToNext} className="h-2.5 mb-2" />
                <p className="text-[11px] text-muted-foreground">
                  Faltam <span className="font-bold text-foreground">{pointsToNext} pontos</span> para alcançar <span className="font-bold">{nextLevelDef.label}</span>.
                </p>
              </div>
            )}

            {nextLevelDef === null && (
              <div className="mb-5 p-4 rounded-xl bg-info/5 border border-info/20 text-center">
                <div className="flex justify-center mb-2">
                  <div className="p-3 rounded-full bg-blue-500/15">
                    <Flag className="h-7 w-7 text-blue-500" />
                  </div>
                </div>
                <p className="text-sm font-heading font-bold text-info mt-1">Nível máximo alcançado!</p>
                <p className="text-xs text-muted-foreground mt-1">Continue monitorando seus indicadores para manter a excelência.</p>
              </div>
            )}

            {/* ── Mountain trail timeline (summit at top) ── */}
            <div className="relative">
              {levelsDescending.map((level, visualIndex) => {
                // Real index in original ATLAS_LEVELS (0=Sobrevivência … 4=Estratégico)
                const realIndex = ATLAS_LEVELS.length - 1 - visualIndex;
                const isActive  = realIndex === currentLevelIndex;
                const isPast    = realIndex < currentLevelIndex;
                const isFuture  = realIndex > currentLevelIndex;
                const isExpanded = expandedLevel === realIndex;
                const details   = PHASE_DETAILS[level.label];
                const theme     = LEVEL_ICONS[realIndex];
                const isLast    = visualIndex === levelsDescending.length - 1;

                return (
                  <div key={level.label} className="flex gap-0">
                    {/* ── Left: trail line + node ── */}
                    <div className="flex flex-col items-center flex-shrink-0 w-10">
                      {/* Node circle */}
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all z-10 flex-shrink-0",
                        isActive && cn(theme.bgColor, theme.borderColor, "shadow-lg ring-2 ring-offset-2 ring-offset-background ring-primary/30 scale-110"),
                        isPast  && cn("bg-emerald-500/15 border-emerald-500/40"),
                        isFuture && "bg-muted/30 border-border/20 opacity-40",
                      )}>
                        {isPast
                          ? <Check className="h-4 w-4 text-emerald-500" />
                          : <theme.Icon className={cn("h-4 w-4", isActive ? theme.iconColor : isFuture ? "text-muted-foreground/50" : theme.iconColor)} />
                        }
                      </div>
                      {/* Connector line to next (lower) phase */}
                      {!isLast && (
                        <div className={cn(
                          "w-0.5 flex-1 min-h-[2rem] rounded-full my-0.5",
                          isPast ? theme.lineColor : "bg-border/20",
                        )} />
                      )}
                    </div>

                    {/* ── Right: label + expandable content ── */}
                    <div className="flex-1 min-w-0 pb-2 pl-3">
                      <button
                        className={cn(
                          "flex items-center gap-2 w-full text-left py-2.5 pr-2 rounded-xl hover:bg-muted/30 transition-colors group",
                          isFuture && "opacity-40",
                        )}
                        onClick={() => setExpandedLevel(isExpanded ? null : realIndex)}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "text-sm font-heading font-bold",
                              isActive ? theme.iconColor : isPast ? "text-muted-foreground" : "text-muted-foreground/50",
                            )}>
                              {level.label}
                            </span>
                            <span className="text-[9px] text-muted-foreground/40">{level.min}–{level.max} pts</span>
                            {isActive && (
                              <span className="text-[8px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold animate-pulse">
                                VOCÊ ESTÁ AQUI
                              </span>
                            )}
                          </div>
                          <p className={cn("text-[11px] mt-0.5", isFuture ? "text-muted-foreground/30" : "text-muted-foreground/60")}>
                            {level.description}
                          </p>
                        </div>
                        {isExpanded
                          ? <ChevronUp className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                        }
                      </button>

                      {/* Expanded details */}
                      {isExpanded && details && (
                        <div className="mb-3 mr-2 p-4 rounded-xl bg-card border border-border/30 animate-in slide-in-from-top-2 duration-200">
                          <div className="space-y-3">
                            <div>
                              <p className="text-xs font-heading font-bold text-foreground mb-1">O que significa</p>
                              <p className="text-xs text-muted-foreground">{details.meaning}</p>
                            </div>
                            <div>
                              <p className="text-xs font-heading font-bold text-foreground mb-1">Detalhes da fase</p>
                              <p className="text-xs text-muted-foreground">{details.whatItMeans}</p>
                            </div>
                            <div>
                              <p className="text-xs font-heading font-bold text-foreground mb-2">Checklist para evoluir</p>
                              <div className="space-y-1.5">
                                {details.checklist.map((item, ci) => {
                                  const isChecked = isPast || (isActive && ci < Math.floor(progressToNext / 25));
                                  return (
                                    <div key={ci} className="flex items-center gap-2">
                                      <div className={cn(
                                        "w-4 h-4 rounded flex items-center justify-center flex-shrink-0",
                                        isChecked ? "bg-success/20" : "bg-muted/50",
                                      )}>
                                        {isChecked
                                          ? <Check className="h-3 w-3 text-success" />
                                          : <div className="w-2 h-2 rounded-sm bg-border/40" />
                                        }
                                      </div>
                                      <span className={cn("text-xs", isChecked ? "text-muted-foreground line-through" : "text-foreground")}>
                                        {item}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Next level requirements (from score engine) ── */}
            {nextLevel && requirements.length > 0 && (
              <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("p-1.5 rounded-lg", LEVEL_ICONS[currentLevelIndex + 1]?.bgColor)}>
                    <LevelIcon index={currentLevelIndex + 1} size={4} className={LEVEL_ICONS[currentLevelIndex + 1]?.iconColor} />
                  </div>
                  <h4 className="text-sm font-heading font-bold">Requisitos calculados para {nextLevel.label}</h4>
                </div>
                <div className="space-y-2">
                  {requirements.map(req => { const ReqIcon = REQ_ICONS[req.key] ?? Flag; return (
                    <div key={req.key} className="flex items-center gap-3 py-1">
                      <div className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
                        req.met ? "bg-success/20" : "bg-destructive/10",
                      )}>
                        {req.met ? <Check className="h-3 w-3 text-success" /> : <X className="h-3 w-3 text-destructive/60" />}
                      </div>
                      <ReqIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <span className={cn("text-xs font-body", req.met ? "text-muted-foreground line-through" : "text-foreground")}>
                          {req.label} {req.target}
                        </span>
                        <span className={cn("text-[10px] ml-2", req.met ? "text-success" : "text-muted-foreground/60")}>
                          {req.progress}
                        </span>
                      </div>
                    </div>
                  ); })}
                </div>
              </div>
            )}

          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default AtlasJourneyMap;
