import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Sparkles, Send, ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  onOpenChat: (question?: string) => void;
}

function useSmartSuggestions(userId?: string) {
  const [suggestions, setSuggestions] = useState([
    "Posso tirar pró-labore?",
    "Meu lucro está bom?",
    "Como separar impostos?",
    "Por que meu lucro caiu?",
  ]);

  useEffect(() => {
    if (!userId) return;
    const mesAtual = new Date().toISOString().slice(0, 7);
    Promise.all([
      supabase.from("receitas").select("valor").eq("user_id", userId).gte("data", `${mesAtual}-01`),
      supabase.from("despesas").select("valor").eq("user_id", userId).gte("data", `${mesAtual}-01`),
    ]).then(([r, d]) => {
      const totalR = (r.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
      const totalD = (d.data || []).reduce((s: number, x: any) => s + Number(x.valor), 0);
      const hasData = totalR > 0 || totalD > 0;
      const negative = totalR > 0 && totalR - totalD < 0;

      if (!hasData) {
        setSuggestions(["Como começar a organizar meu financeiro?", "O que devo registrar primeiro?", "O que é pró-labore?"]);
      } else if (negative) {
        setSuggestions(["Por que estou no vermelho?", "Como reduzir minhas despesas?", "Posso tirar pró-labore?"]);
      } else {
        setSuggestions(["Meu lucro está bom?", "Posso tirar pró-labore?", "Como separar impostos?", "O marketing está alto?"]);
      }
    });
  }, [userId]);

  return suggestions;
}

export default function AssistenteAtlasCard({ onOpenChat }: Props) {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const suggestions = useSmartSuggestions(user?.id);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      onOpenChat(q.trim());
      setQ("");
    }
  };

  return (
    <Card className="border-border/30 shadow-none bg-card/60 rounded-2xl overflow-hidden">
      <CardContent className="pt-4 pb-4 px-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-heading font-semibold">Assistente Atlas</span>
        </div>

        <p className="text-xs text-muted-foreground">
          Tire dúvidas sobre suas finanças usando seus dados reais. Respostas simples e diretas.
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Pergunte algo sobre suas finanças..."
            className="text-sm h-9 w-full"
          />
          <Button type="submit" size="icon" className="h-9 w-9 flex-shrink-0" disabled={!q.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </form>

        {/* Horizontal scrolling chips on mobile, wrap on desktop */}
        <ScrollArea className="w-full md:hidden">
          <div className="flex gap-1.5 pb-1">
            {suggestions.map(s => (
              <button
                key={s}
                onClick={() => onOpenChat(s)}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap flex-shrink-0"
              >
                {s}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="h-1" />
        </ScrollArea>
        <div className="hidden md:flex flex-wrap gap-1.5">
          {suggestions.map(s => (
            <button
              key={s}
              onClick={() => onOpenChat(s)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => onOpenChat()}>
          Abrir chat completo <ArrowRight className="h-3 w-3 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}
