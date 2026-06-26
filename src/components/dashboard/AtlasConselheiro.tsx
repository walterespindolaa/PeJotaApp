import { Card, CardContent } from "@/components/ui/card";
import { type Recommendation } from "@/lib/atlasIntelligence";
import { Brain } from "lucide-react";
import { EmojiIcon } from "@/components/EmojiIcon";

const typeStyles: Record<string, string> = {
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-destructive/10 text-destructive border-destructive/20",
  info: "bg-info/10 text-info border-info/20",
};

interface Props {
  recommendations: Recommendation[];
}

const AtlasConselheiro = ({ recommendations }: Props) => {
  if (recommendations.length === 0) return null;

  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground/50 font-heading font-semibold mb-3 px-1 flex items-center gap-1.5">
        <Brain className="h-3.5 w-3.5" />Recomendações do PeJota
      </p>
      <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl">
        <CardContent className="p-5">
          <div className="space-y-2.5">
            {recommendations.map((rec, i) => (
              <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${typeStyles[rec.type]}`}>
                <EmojiIcon emoji={rec.icon} className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p className="text-sm font-body leading-relaxed">{rec.text}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-4 font-body">
            Recomendações baseadas nos seus dados reais. Atualizado automaticamente.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AtlasConselheiro;
