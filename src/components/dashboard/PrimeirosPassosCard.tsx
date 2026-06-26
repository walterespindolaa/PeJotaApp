import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/contexts/I18nContext";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Check, ArrowRight, Sparkles, Wallet, Receipt, Shield, Target,
  PlayCircle, BarChart3, X, Trophy, type LucideIcon,
} from "lucide-react";

interface Props {
  hasReceita: boolean;
  hasDespesa: boolean;
  hasReserva: boolean;
  hasObjetivo: boolean;
  /** chave única por usuário — lembra que o card foi dispensado */
  storageKey: string;
  /** chave única por usuário — guarda os passos de exploração já visitados */
  visitKey: string;
}

type Kind = "data" | "visit";
interface Passo {
  key: string;
  label: string;
  done: boolean;
  to: string;
  Icon: LucideIcon;
  kind: Kind;
}

/**
 * Checklist de ativação dos primeiros minutos.
 * - Passos "data": marcam sozinhos quando o usuário tem o dado (renda, gastos, reserva, objetivo).
 * - Passos "visit": marcam quando o usuário clica/visita (tutorial, relatórios).
 * Some quando tudo é concluído (mostra parabéns) ou quando dispensado.
 */
export default function PrimeirosPassosCard({ hasReceita, hasDespesa, hasReserva, hasObjetivo, storageKey, visitKey }: Props) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try { return localStorage.getItem(storageKey) === "1"; } catch { return false; }
  });
  const [visited, setVisited] = useState<string[]>(() => {
    try { const raw = localStorage.getItem(visitKey); return raw ? JSON.parse(raw) : []; } catch { return []; }
  });

  const markVisited = useCallback((key: string, to: string) => {
    setVisited(prev => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      try { localStorage.setItem(visitKey, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    navigate(to);
  }, [navigate, visitKey]);

  const dismiss = () => {
    try { localStorage.setItem(storageKey, "1"); } catch { /* ignore */ }
    setDismissed(true);
  };

  const passos: Passo[] = [
    { key: "renda", label: t("pp.s_renda"), done: hasReceita, to: "/dashboard/renda-despesas/ganhos", Icon: Wallet, kind: "data" },
    { key: "gasto", label: t("pp.s_gasto"), done: hasDespesa, to: "/dashboard/renda-despesas/fixas", Icon: Receipt, kind: "data" },
    { key: "reserva", label: t("pp.s_reserva"), done: hasReserva, to: "/dashboard/investimentos/visao-geral", Icon: Shield, kind: "data" },
    { key: "objetivo", label: t("pp.s_objetivo"), done: hasObjetivo, to: "/dashboard/objetivos-de-vida", Icon: Target, kind: "data" },
    { key: "tutorial", label: t("pp.s_tutorial"), done: visited.includes("tutorial"), to: "/dashboard/comecar", Icon: PlayCircle, kind: "visit" },
    { key: "relatorios", label: t("pp.s_relatorio"), done: visited.includes("relatorios"), to: "/dashboard/basedamontanha", Icon: BarChart3, kind: "visit" },
  ];

  const total = passos.length;
  const doneCount = passos.filter(p => p.done).length;
  const pct = Math.round((doneCount / total) * 100);

  if (dismissed) return null;

  // Estado de conclusão — reforço positivo
  if (doneCount === total) {
    return (
      <Card className="border-success/30 bg-success/5 rounded-2xl shadow-none">
        <CardContent className="p-5 flex items-center gap-4">
          <span className="flex items-center justify-center h-10 w-10 rounded-xl bg-success/15 text-success flex-shrink-0">
            <Trophy className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-heading font-bold">{t("pp.done_titulo")}</p>
            <p className="text-xs text-muted-foreground">{t("pp.done_sub")}</p>
          </div>
          <button type="button" onClick={dismiss} className="text-xs font-heading font-semibold text-primary hover:underline flex-shrink-0">
            {t("pp.fechar")}
          </button>
        </CardContent>
      </Card>
    );
  }

  const onClickStep = (p: Passo) => {
    if (p.done) return;
    if (p.kind === "visit") markVisited(p.key, p.to);
    else navigate(p.to);
  };

  return (
    <Card className="border-primary/20 bg-primary/5 rounded-2xl shadow-none">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 text-primary flex-shrink-0">
              <Sparkles className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-heading font-bold">{t("pp.titulo")}</p>
              <p className="text-xs text-muted-foreground">
                {doneCount}/{total} {t("pp.concluidos")} · {t("pp.complete")}
              </p>
            </div>
          </div>
          <button type="button" onClick={dismiss} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0" aria-label={t("pp.dispensar")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <Progress value={pct} className="h-1.5 mb-4" />

        <div className="grid gap-2 sm:grid-cols-2">
          {passos.map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => onClickStep(p)}
              disabled={p.done}
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                p.done
                  ? "border-success/30 bg-success/5 cursor-default"
                  : "border-border/40 bg-card hover:border-primary/40 hover:bg-card/80"
              }`}
            >
              <span className={`flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0 ${p.done ? "bg-success/15 text-success" : "bg-primary/10 text-primary"}`}>
                {p.done ? <Check className="h-4 w-4" /> : <p.Icon className="h-4 w-4" />}
              </span>
              <span className={`text-sm flex-1 min-w-0 truncate ${p.done ? "text-muted-foreground line-through" : "font-medium"}`}>{p.label}</span>
              {!p.done && <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
