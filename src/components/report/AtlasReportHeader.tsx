import { Card, CardContent } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

interface Props {
  title: string;
  userName?: string;
}

/**
 * Standard Atlas report cover card (in-app, not the PDF cover image).
 */
export default function AtlasReportHeader({ title, userName }: Props) {
  const today = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <Card className="shadow-card rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border-primary/10 mb-6">
      <CardContent className="py-10 text-center">
        <img src="/logo.png" alt="Atlas" className="w-14 h-14 mx-auto mb-3 rounded-2xl object-contain" />
        <h2 className="text-2xl font-heading font-bold text-foreground mb-1">{title}</h2>
        {userName && <p className="text-lg text-foreground/70 font-medium">{userName}</p>}
        <p className="text-sm text-muted-foreground mt-1">{today}</p>
        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
          <Sparkles className="h-3 w-3" /> Gerado por IA · Atlas
        </div>
      </CardContent>
    </Card>
  );
}
