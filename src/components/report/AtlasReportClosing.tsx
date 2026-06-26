import { Card, CardContent } from "@/components/ui/card";
import { useAtlasQuote, QuoteCategory } from "@/hooks/useAtlasQuote";

interface AtlasReportClosingProps {
  category?: QuoteCategory;
  proximoMovimento?: string;
}

/**
 * Standard PeJota closing card for all reports.
 * Shows institutional quote (dynamic) + logo + optional "Próximo Movimento".
 */
export default function AtlasReportClosing({ category = "general", proximoMovimento }: AtlasReportClosingProps) {
  const { quote } = useAtlasQuote(category);

  return (
    <Card className="shadow-card rounded-2xl bg-gradient-to-br from-[hsl(var(--primary)/0.05)] to-[hsl(var(--accent)/0.08)] border-primary/10 mt-6">
      <CardContent className={`py-10 px-8 ${proximoMovimento ? "space-y-5" : ""}`}>
        <div className="flex items-center gap-6">
          <img src="/logo.png" alt="PeJota" className="w-14 h-14 rounded-2xl object-contain shrink-0" />
          <div>
            <p className="text-base italic text-foreground/80 font-medium leading-relaxed">
              "{quote.text}"
            </p>
            <p className="text-xs text-muted-foreground mt-3 font-semibold uppercase tracking-wider">
              — {quote.author}
            </p>
          </div>
        </div>
        {proximoMovimento && (
          <div className="border-t border-border/30 pt-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 font-semibold mb-1">Próximo Movimento</p>
            <p className="text-sm text-foreground/80 font-medium">{proximoMovimento}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
