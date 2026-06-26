import { useState, useMemo, memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Eye, Map,
  Footprints, Tent, Compass, Mountain, Flag,
} from "lucide-react";
import AtlasScoreBreakdown from "./AtlasScoreBreakdown";
import AtlasJourneyMap from "./AtlasJourneyMap";
import { getNextLevel, getNextLevelRequirements, type AtlasScoreResult, type AtlasScoreInputs, type LevelRequirement } from "@/lib/atlasScore";
import type { Achievement } from "@/lib/atlasIntelligence";
import type { Recommendation } from "@/lib/atlasIntelligence";
import InfoTooltip, { INFO_CONFIGS } from "./InfoTooltip";
import { cn } from "@/lib/utils";

// Level icon at top of score ring (matches AtlasJourneyMap order)
const LEVEL_RING_ICONS = [
  { Icon: Footprints, color: "text-red-500"     },
  { Icon: Tent,       color: "text-amber-500"   },
  { Icon: Compass,    color: "text-yellow-500"  },
  { Icon: Mountain,   color: "text-emerald-500" },
  { Icon: Flag,       color: "text-blue-500"    },
] as const;

interface AtlasScoreProps {
  result: AtlasScoreResult;
  loading?: boolean;
  recommendations?: Recommendation[];
  achievements?: Achievement[];
  scoreInputs?: AtlasScoreInputs;
  evolution3m?: number | null; // score change vs 3 months ago
}

const AtlasScore = ({ result, loading, recommendations = [], achievements = [], scoreInputs, evolution3m }: AtlasScoreProps) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showJourney, setShowJourney] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const { score, label, color, ringColor, levelIndex } = result;
  const nextLevel = getNextLevel(score);

  const { nextLevel: nextLevelDef, requirements } = useMemo(() => {
    if (!scoreInputs) return { nextLevel: null, requirements: [] as LevelRequirement[] };
    return getNextLevelRequirements(score, result.pillars, scoreInputs);
  }, [score, result.pillars, scoreInputs]);

  // Larger ring: r=64, viewBox 180
  const circumference = 2 * Math.PI * 64;
  const dashArray = `${(score / 100) * circumference} ${circumference}`;

  return (
    <>
      <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-center gap-4 lg:gap-6 text-center lg:text-left">
            {/* Title — mobile (topo) */}
            <div className="lg:hidden">
              <h3 className="text-base font-heading font-bold">PeJota Score</h3>
              <p className="text-[11px] text-muted-foreground/60 font-body">
                Reserva, margem, disciplina, futuro e patrimônio.
              </p>
            </div>

            {/* Progress Ring — clickable for explanation */}
            <div className="relative cursor-pointer flex-shrink-0" onClick={() => setShowInfo(true)} title="Ver explicação do PeJota Score">
              {!loading && (() => {
                const lvl = LEVEL_RING_ICONS[levelIndex] ?? LEVEL_RING_ICONS[0];
                return (
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center bg-background border border-border/60 shadow-sm z-10">
                    <lvl.Icon className={cn("h-3 w-3", lvl.color)} />
                  </div>
                );
              })()}
              <svg width="176" height="176" viewBox="0 0 176 176">
                <defs>
                  <filter id="scoreGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <circle cx="88" cy="88" r="64" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <circle
                  cx="88" cy="88" r="64"
                  fill="none"
                  stroke={ringColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                  transform="rotate(-90 88 88)"
                  className="transition-all duration-1000 ease-out"
                  filter="url(#scoreGlow)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-heading font-extrabold leading-none">{loading ? "..." : score}</span>
                <span className={`text-xs font-heading font-bold mt-1 ${color}`}>{label}</span>
              </div>
            </div>

            {/* Detalhes — coluna à direita no desktop */}
            <div className="flex flex-col items-center lg:items-start gap-3 w-full lg:flex-1">
              {/* Title — desktop */}
              <div className="hidden lg:block">
                <h3 className="text-base font-heading font-bold">PeJota Score</h3>
                <p className="text-[11px] text-muted-foreground/60 font-body">
                  Reserva, margem, disciplina, futuro e patrimônio.
                </p>
              </div>

              {/* Evolution 3m */}
              {evolution3m !== null && evolution3m !== undefined && (
                <div className="flex items-center gap-1.5 text-[10px] font-body">
                  <span className="text-muted-foreground/50">Últimos 3m:</span>
                  <span className={`font-heading font-bold ${evolution3m > 0 ? "text-success" : evolution3m < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                    {evolution3m > 0 ? "+" : ""}{evolution3m} pts
                  </span>
                </div>
              )}

              {/* Progress to next level */}
              {nextLevel && (
                <div className="w-full max-w-[240px] lg:max-w-[320px]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] text-muted-foreground/50 font-body">Próximo nível</span>
                    <span className="text-[9px] font-heading font-bold text-muted-foreground">{nextLevel.label}</span>
                  </div>
                  <Progress value={score} className="h-1.5" />
                  <p className="text-[9px] text-muted-foreground/50 mt-1 font-body">
                    Faltam <span className="font-bold text-foreground">{nextLevel.pointsNeeded}</span> pts
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] text-muted-foreground hover:text-foreground rounded-xl h-7 px-2"
                  onClick={() => setShowBreakdown(true)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Cálculo
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[10px] text-muted-foreground hover:text-foreground rounded-xl h-7 px-2"
                  onClick={() => setShowJourney(true)}
                >
                  <Map className="h-3 w-3 mr-1" />
                  Jornada
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <InfoTooltip config={INFO_CONFIGS.atlas_score} className="hidden" externalOpen={showInfo} onExternalClose={() => setShowInfo(false)} />
      <AtlasScoreBreakdown
        open={showBreakdown}
        onOpenChange={setShowBreakdown}
        result={result}
        recommendations={recommendations}
        achievements={achievements}
        nextLevelDef={nextLevelDef}
        requirements={requirements}
      />
      <AtlasJourneyMap
        open={showJourney}
        onOpenChange={setShowJourney}
        currentScore={score}
        currentLevelIndex={levelIndex}
        requirements={requirements}
        nextLevel={nextLevelDef}
      />
    </>
  );
};

export default memo(AtlasScore);
