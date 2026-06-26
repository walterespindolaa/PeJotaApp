import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  ShieldCheck, TrendingUp, TrendingDown, BarChart3, PieChart, Sunset, LineChart, Briefcase,
  Check, X, Flame, Sparkles, Trophy, Shield, AlertTriangle, CheckCircle2, Lightbulb,
} from "lucide-react";
import type { AtlasScoreResult, PillarResult, AtlasLevelDef, LevelRequirement } from "@/lib/atlasScore";
import type { Achievement, Recommendation } from "@/lib/atlasIntelligence";
import { cn } from "@/lib/utils";
import { EmojiIcon } from "@/components/EmojiIcon";

const PILLAR_ICONS: Record<string, { Icon: React.ElementType; color: string; bg: string }> = {
  reserva:       { Icon: ShieldCheck, color: "text-blue-500",    bg: "bg-blue-500/10"    },
  margem:        { Icon: TrendingUp,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
  disciplina:    { Icon: BarChart3,   color: "text-violet-500",  bg: "bg-violet-500/10"  },
  alocacao:      { Icon: PieChart,    color: "text-amber-500",   bg: "bg-amber-500/10"   },
  aposentadoria: { Icon: Sunset,      color: "text-orange-500",  bg: "bg-orange-500/10"  },
  evolucao:      { Icon: LineChart,   color: "text-cyan-500",    bg: "bg-cyan-500/10"    },
  empresa:       { Icon: Briefcase,   color: "text-primary",     bg: "bg-primary/10"     },
};

const ACHIEVEMENT_ICONS: Record<string, { Icon: React.ElementType; color: string }> = {
  reserva_completa:  { Icon: Shield,    color: "text-blue-500"    },
  controle_6m:       { Icon: Flame,     color: "text-orange-500"  },
  aposentadoria:     { Icon: Sparkles,  color: "text-purple-500"  },
  sem_negativo:      { Icon: Trophy,    color: "text-yellow-500"  },
  empresa_saudavel:  { Icon: Briefcase, color: "text-emerald-500" },
};

const REC_ICONS: Record<string, { Icon: React.ElementType; color: string }> = {
  danger:  { Icon: AlertTriangle,  color: "text-destructive"  },
  warning: { Icon: AlertTriangle,  color: "text-amber-500"    },
  success: { Icon: CheckCircle2,   color: "text-emerald-500"  },
  info:    { Icon: Lightbulb,      color: "text-blue-500"     },
};

const typeStyles: Record<string, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  result: AtlasScoreResult;
  recommendations?: Recommendation[];
  achievements?: Achievement[];
  nextLevelDef?: AtlasLevelDef | null;
  requirements?: LevelRequirement[];
}

function getPillarColor(score: number) {
  if (score >= 80) return { label: "Excelente", color: "text-success", bg: "bg-success" };
  if (score >= 60) return { label: "Bom", color: "text-info", bg: "bg-info" };
  if (score >= 40) return { label: "Regular", color: "text-warning", bg: "bg-warning" };
  return { label: "Atenção", color: "text-destructive", bg: "bg-destructive" };
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3">
      {children}
    </p>
  );
}

const AtlasScoreBreakdown = ({ open, onOpenChange, result, recommendations = [], achievements = [], nextLevelDef = null, requirements = [] }: Props) => {
  const { score, label, color, pillars, driversUp, driversDown } = result;
  const unlocked = achievements.filter(a => a.unlocked);

  const renderDriver = (d: { key: string; icon?: string; label: string; score: number }) => {
    const pi = PILLAR_ICONS[d.key];
    return (
      <div key={d.key} className="flex items-center gap-2 mb-1">
        {pi
          ? <div className={cn("w-5 h-5 rounded flex items-center justify-center flex-shrink-0", pi.bg)}><pi.Icon className={cn("h-3 w-3", pi.color)} /></div>
          : <EmojiIcon emoji={d.icon} className="h-3.5 w-3.5 text-muted-foreground" />
        }
        <span className="text-xs font-body text-muted-foreground truncate">{d.label}</span>
        <span className="text-xs font-heading font-bold ml-auto">{d.score}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-full rounded-3xl p-0 overflow-hidden">
        <div className="max-h-[80vh] overflow-y-auto overscroll-contain">
          <DialogHeader className="p-6 pb-4 text-left">
            <DialogTitle className="font-heading text-lg">Como calculamos o PeJota Score</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Score final = soma ponderada dos pilares. Pilares sem dados têm peso redistribuído.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-7">
            {/* ── Drivers ── */}
            {(driversUp.length > 0 || driversDown.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingUp className="h-3.5 w-3.5 text-success" />
                    <span className="text-[10px] font-heading font-bold text-success uppercase tracking-wider">Puxou pra cima</span>
                  </div>
                  {driversUp.map(renderDriver)}
                </div>
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                    <span className="text-[10px] font-heading font-bold text-destructive uppercase tracking-wider">Puxou pra baixo</span>
                  </div>
                  {driversDown.map(renderDriver)}
                </div>
              </div>
            )}

            {/* ── Checklist para o próximo nível ── */}
            {nextLevelDef && requirements.length > 0 && (
              <div className="border-t border-border/40 pt-6">
                <SectionLabel>Para alcançar {nextLevelDef.label}</SectionLabel>
                <div className="space-y-1.5">
                  {requirements.map(req => (
                    <div key={req.key} className="flex items-center gap-2 text-xs font-body">
                      {req.met
                        ? <Check className="h-3.5 w-3.5 text-success flex-shrink-0" />
                        : <X className="h-3.5 w-3.5 text-destructive/50 flex-shrink-0" />
                      }
                      <span className={req.met ? "text-muted-foreground line-through" : "text-foreground"}>
                        {req.label} {req.target}
                      </span>
                      {req.progress && (
                        <span className={cn("text-[10px] ml-auto", req.met ? "text-success" : "text-muted-foreground/60")}>{req.progress}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Recomendações ── */}
            {recommendations.length > 0 && (
              <div className="border-t border-border/40 pt-6">
                <SectionLabel>Recomendações</SectionLabel>
                <div className="space-y-2">
                  {recommendations.map((rec, i) => {
                    const ri = REC_ICONS[rec.type] ?? REC_ICONS.info;
                    return (
                      <div key={i} className={`flex items-start gap-2 px-3 py-2.5 rounded-xl border text-xs ${typeStyles[rec.type]}`}>
                        <ri.Icon className={cn("h-4 w-4 flex-shrink-0 mt-0.5", ri.color)} />
                        <p className="font-body leading-relaxed">{rec.text}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Conquistas ── */}
            {achievements.length > 0 && (
              <div className="border-t border-border/40 pt-6">
                <SectionLabel>Conquistas ({unlocked.length}/{achievements.length})</SectionLabel>
                <div className="flex flex-wrap gap-2">
                  <TooltipProvider delayDuration={200}>
                    {achievements.map(a => {
                      const ai = ACHIEVEMENT_ICONS[a.id];
                      return (
                        <Tooltip key={a.id}>
                          <TooltipTrigger asChild>
                            <div className={cn(
                              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs whitespace-nowrap transition-all",
                              a.unlocked ? "bg-card border-primary/20 shadow-sm" : "bg-muted/20 border-border/20 opacity-40",
                            )}>
                              {ai
                                ? <ai.Icon className={cn("h-3.5 w-3.5 flex-shrink-0", a.unlocked ? ai.color : "text-muted-foreground/40")} />
                                : <EmojiIcon emoji={a.icon} className="h-4 w-4 text-muted-foreground" />
                              }
                              <span className={cn("font-heading font-bold text-[11px]", a.unlocked ? "" : "text-muted-foreground/50")}>
                                {a.title}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                            <p className="font-bold">{a.title}</p>
                            <p className="text-muted-foreground">{a.description}</p>
                            {!a.unlocked && <p className="text-warning mt-1">Ainda não desbloqueada</p>}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </TooltipProvider>
                </div>
              </div>
            )}

            {/* ── Pilares ── */}
            <div className="border-t border-border/40 pt-6">
              <SectionLabel>Pilares</SectionLabel>
              <div className="space-y-4">
                {pillars.map((p: PillarResult) => {
                  const st = getPillarColor(p.score);
                  const pi = PILLAR_ICONS[p.key];
                  return (
                    <div key={p.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-body flex items-center gap-2">
                          {pi
                            ? <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0", pi.bg)}><pi.Icon className={cn("h-3.5 w-3.5", pi.color)} /></div>
                            : <EmojiIcon emoji={p.icon} className="h-4 w-4 text-muted-foreground" />
                          }
                          <span className="font-medium">{p.label}</span>
                          {p.status === "sem_dados" ? (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">Sem dados</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground/50">({(p.weight * 100).toFixed(0)}%)</span>
                          )}
                        </span>
                        <span className={`text-sm font-heading font-bold ${p.status === "sem_dados" ? "text-muted-foreground/40" : st.color}`}>
                          {p.status === "sem_dados" ? "—" : p.score}
                          {p.status !== "sem_dados" && <span className="font-normal text-muted-foreground/50 text-xs"> / 100</span>}
                        </span>
                      </div>

                      {p.status !== "sem_dados" && (
                        <Progress value={p.score} className="h-1.5" />
                      )}

                      <p className="text-[11px] text-muted-foreground/70 font-body leading-relaxed">
                        {p.tip}
                      </p>
                      <p className="text-[10px] text-muted-foreground/40 font-mono">
                        {p.formula}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Final score ── */}
            <div className="border-t border-border/40 pt-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-heading font-bold">Score Final</span>
                <span className={`text-3xl font-heading font-extrabold ${color}`}>{score}</span>
              </div>
              <p className={`text-xs font-heading font-bold mt-1 ${color}`}>{label}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-2 font-body">
                PeJota Score = Σ (peso_i × score_i). Pilares sem dados são excluídos e os pesos redistribuídos.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AtlasScoreBreakdown;
