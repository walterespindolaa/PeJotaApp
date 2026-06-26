import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { LifeEvent } from "@/lib/financial_engine/life_projection";

interface Objetivo {
  id: string;
  nome: string;
  valor_objetivo: number;
  data_objetivo: string | null;
}

const OBJETIVO_EMOJI_MAP: Record<string, string> = {
  viagem: "✈️", compra_imovel: "🏠", troca_carro: "🚗", compra_carro: "🚗",
  faculdade: "🎓", casamento: "💒", filho: "👶", bebê: "👶", bebe: "👶", nascimento: "👶",
  intercambio: "🌍", sabatico: "🏖️", emergencia: "🛡️", reforma: "🔨",
};

interface Props {
  enabledIds: Set<string>;
  onToggle: (id: string, enabled: boolean, event: LifeEvent) => void;
}

export default function ObjetivosIntegration({ enabledIds, onToggle }: Props) {
  const { user } = useAuth();
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("objetivos").select("id, nome, valor_objetivo, data_objetivo")
      .eq("user_id", user.id)
      .order("created_at")
      .then(({ data }) => setObjetivos((data as Objetivo[]) || []));
  }, [user]);

  if (objetivos.length === 0) return null;

  const anoAtual = new Date().getFullYear();

  return (
    <Card className="border-border/40 bg-card/80 backdrop-blur-sm animate-fade-in" style={{ animationDelay: "300ms" }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-heading flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          Objetivos de Vida
        </CardTitle>
        <p className="text-[10px] text-muted-foreground">Ative para incluir no gráfico de projeção.</p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {objetivos.map(obj => {
          const anoEstimado = obj.data_objetivo
            ? new Date(obj.data_objetivo).getFullYear()
            : anoAtual + 3;
          const emoji = Object.entries(OBJETIVO_EMOJI_MAP).find(([k]) =>
            obj.nome.toLowerCase().includes(k)
          )?.[1] || "🎯";
          const enabled = enabledIds.has(obj.id);
          const fmtVal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(obj.valor_objetivo);

          const lifeEvent: LifeEvent = {
            id: `obj-${obj.id}`,
            name: obj.nome,
            emoji,
            year: anoEstimado,
            impactValue: obj.valor_objetivo,
            type: "outro",
          };

          return (
            <div key={obj.id} className="flex items-center justify-between py-2 px-3 rounded-lg border border-border/30 bg-muted/10 hover:bg-muted/20 transition-colors">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-lg">{emoji}</span>
                <div className="min-w-0">
                  <div className="text-xs font-medium truncate">{obj.nome}</div>
                  <div className="text-[10px] text-muted-foreground">{anoEstimado} · {fmtVal}</div>
                </div>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) => onToggle(obj.id, checked, lifeEvent)}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
