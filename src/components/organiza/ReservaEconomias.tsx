import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, ExternalLink, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivacyFmt } from "@/components/PrivacyValue";

interface ReservaAtivo {
  id: string;
  nome: string;
  valor_atual: number;
  liquidez: string | null;
}

interface Props {
  /** Average monthly expenses from useOrganiza */
  mediaDespesas: number;
  /** Average monthly savings from last 3 months (economias table) */
  mediaEconomiasMensal: number;
}

const ReservaEconomias = ({ mediaDespesas, mediaEconomiasMensal }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { fmt, pct, isPrivate } = usePrivacyFmt();
  const [ativos, setAtivos] = useState<ReservaAtivo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("investimentos_financeiros")
        .select("id, nome, valor_atual, liquidez")
        .eq("user_id", user.id)
        .eq("is_reserva_emergencia", true);
      setAtivos((data as ReservaAtivo[]) || []);
      setLoading(false);
    };
    fetch();
  }, [user]);

  const reservaIdeal = mediaDespesas * 8;
  const reservaAtual = ativos.reduce((s, a) => s + Number(a.valor_atual || 0), 0);
  const reservaPct = reservaIdeal > 0 ? Math.min((reservaAtual / reservaIdeal) * 100, 100) : 0;
  const mesesCobertura = mediaDespesas > 0 ? reservaAtual / mediaDespesas : 0;

  // Status badge
  const statusConfig = useMemo(() => {
    if (mesesCobertura < 3) return { label: "Frágil", className: "bg-destructive/10 text-destructive border-destructive/20" };
    if (mesesCobertura < 8) return { label: "Em construção", className: "bg-warning/10 text-warning border-warning/20" };
    return { label: "Protegido", className: "bg-success/10 text-success border-success/20" };
  }, [mesesCobertura]);

  // Strategic subtitle
  const subtexto = useMemo(() => {
    if (ativos.length === 0) return null;
    const m = mesesCobertura.toFixed(1);
    if (mesesCobertura < 3) return `Sua reserva cobre apenas ${m} meses. Sua segurança ainda está frágil.`;
    if (mesesCobertura < 8) return `Você já construiu ${m} meses de proteção. Continue fortalecendo.`;
    return `Sua reserva cobre ${m} meses. Você está protegido.`;
  }, [mesesCobertura, ativos.length]);

  // Months to goal estimate
  const mesesParaMeta = useMemo(() => {
    if (reservaPct >= 100) return null;
    const falta = reservaIdeal - reservaAtual;
    if (falta <= 0) return null;
    if (mediaEconomiasMensal <= 0) return -1; // no data
    return Math.ceil(falta / mediaEconomiasMensal);
  }, [reservaIdeal, reservaAtual, reservaPct, mediaEconomiasMensal]);

  if (loading) return null;

  return (
    <Card className="shadow-soft rounded-2xl border-border/60">
      {/* Strategic header */}
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-warning" />
            <div>
              <CardTitle className="font-heading text-base">Sua Segurança Financeira</CardTitle>
              {subtexto && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtexto}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-[10px] font-semibold ${statusConfig.className}`}>
              {statusConfig.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs gap-1 h-7"
              onClick={() => navigate("/dashboard/investimentos")}
            >
              Gerenciar em Investimentos <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {ativos.length === 0 ? (
          /* Empty state */
          <div className="text-center py-6 space-y-3">
            <p className="text-sm text-muted-foreground">Nenhum ativo marcado como Reserva de Emergência.</p>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => navigate("/dashboard/investimentos")}
            >
              Marcar ativos <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* KPI grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Meta Ideal (8 meses)</p>
                <p className="text-base sm:text-lg font-bold font-heading">{fmt(reservaIdeal)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Acumulado</p>
                <p className="text-base sm:text-lg font-bold font-heading">{fmt(reservaAtual)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">% Atingido</p>
                <p className="text-base sm:text-lg font-bold font-heading">{pct(reservaPct)}</p>
              </div>
            </div>

            {/* Progress bar */}
            <Progress value={reservaPct} className="h-2 rounded-full" />

            {/* Mini insight */}
            <p className="text-xs text-muted-foreground">
              {mesesParaMeta === null
                ? "Parabéns! Sua meta de reserva foi atingida."
                : mesesParaMeta === -1
                  ? "Continue registrando suas economias para estimar sua evolução."
                  : `No seu ritmo atual, você atinge a meta em aproximadamente ${mesesParaMeta} meses.`}
            </p>

            {/* Asset list */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Ativos que compõem a reserva:</p>
              {ativos.map(inv => (
                <div key={inv.id} className="flex items-center gap-2 text-xs">
                  <span className="text-base">🐷</span>
                  <span className="font-medium">{inv.nome}</span>
                  <span className="text-muted-foreground">— {fmt(Number(inv.valor_atual))}</span>
                  <Badge variant="outline" className="text-[9px]">{inv.liquidez || "—"}</Badge>
                </div>
              ))}
            </div>

            {/* Micro CTA */}
            {reservaPct < 100 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs w-full sm:w-auto"
                onClick={() => navigate("/dashboard/investimentos")}
              >
                Fortalecer Reserva <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ReservaEconomias;
