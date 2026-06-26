import { memo } from "react";
import { type Achievement } from "@/lib/atlasIntelligence";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Lock } from "lucide-react";
import { EmojiIcon } from "@/components/EmojiIcon";

interface Props {
  achievements: Achievement[];
}

const AtlasAchievements = ({ achievements }: Props) => {
  const unlocked = achievements.filter(a => a.unlocked);
  const locked = achievements.filter(a => !a.unlocked);

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1">
        Conquistas ({unlocked.length}/{achievements.length})
      </p>
      <div className="flex flex-wrap gap-2">
        <TooltipProvider delayDuration={200}>
          {achievements.map(a => (
            <Tooltip key={a.id}>
              <TooltipTrigger asChild>
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ${
                  a.unlocked
                    ? "bg-card border-primary/20 shadow-sm"
                    : "bg-muted/20 border-border/20 opacity-40 grayscale"
                }`}>
                  <EmojiIcon emoji={a.icon} className="h-5 w-5" />
                  <span className={`font-heading font-bold text-xs ${a.unlocked ? "" : "text-muted-foreground/50"}`}>
                    {a.title}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                <p className="font-bold">{a.title}</p>
                <p className="text-muted-foreground">{a.description}</p>
                {!a.unlocked && <p className="text-warning mt-1 flex items-center gap-1.5"><Lock className="h-3 w-3" />Ainda não desbloqueada</p>}
              </TooltipContent>
            </Tooltip>
          ))}
        </TooltipProvider>
      </div>
    </div>
  );
};

export default memo(AtlasAchievements);
