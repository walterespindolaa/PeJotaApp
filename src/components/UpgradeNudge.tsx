import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Sparkles, X } from "lucide-react";

/* ─── trigger definitions with exact copies ─── */

interface TriggerDef {
  key: string;
  planTarget: "atlas_pro" | "atlas_elite";
  emoji: string;
  blocks: string[];          // paragraphs / bullet-list blocks (markdown-like)
  buttonLabel: string;
  footnote: string;
  maxShows: number;
  cooldownDays: number;
}

const TRIGGERS: TriggerDef[] = [
  {
    key: "patrimonio_50k",
    planTarget: "atlas_pro",
    emoji: "📈",
    blocks: [
      "Você já deu um passo que a maioria das pessoas nunca dá.",
      "Registrar e acompanhar seu patrimônio já coloca você à frente de grande parte da população que simplesmente não sabe quanto realmente tem.",
      "Agora é hora de subir um novo degrau.",
      "Começar a olhar para o futuro:\npara sua aposentadoria, seus objetivos de vida e para onde você quer chegar financeiramente.",
      "O módulo **Evolução Patrimonial e Planejamento Financeiro** do PeJota Pro mostra exatamente isso:\ncomo seu patrimônio está crescendo e o caminho até sua independência financeira.",
    ],
    buttonLabel: "Desbloquear PeJota Pro",
    footnote: "Essa diferença custa menos que um refrigerante por mês.",
    maxShows: 3,
    cooldownDays: 21,
  },
  {
    key: "lancamentos_20",
    planTarget: "atlas_pro",
    emoji: "💡",
    blocks: [
      "A maioria das pessoas vive no escuro financeiro.",
      "Você já está fazendo algo que poucos fazem:\nregistrar e acompanhar suas movimentações.",
      "Mas controle é apenas o primeiro passo.",
      "O próximo nível é transformar organização em estratégia.",
      "O **Planejamento Financeiro completo do PeJota Pro** conecta suas receitas, despesas e patrimônio para mostrar:",
      "• quanto você pode investir\n• quanto precisa acumular\n• quando poderá atingir seus objetivos",
    ],
    buttonLabel: "Conhecer PeJota Pro",
    footnote: "Menos que o custo de um refrigerante por mês.",
    maxShows: 3,
    cooldownDays: 21,
  },
  {
    key: "primeiro_investimento",
    planTarget: "atlas_pro",
    emoji: "📊",
    blocks: [
      "Você começou a investir.",
      "Esse é um passo importante.",
      "Mas investir sem acompanhar sua estratégia pode fazer você perder oportunidades ou assumir riscos desnecessários.",
      "O módulo **Carteira de Investimentos do PeJota Pro** permite:",
      "• acompanhar sua alocação de ativos\n• visualizar evolução do patrimônio\n• consolidar toda sua carteira em um único lugar",
      "Transforme seus investimentos em uma estratégia clara de crescimento patrimonial.",
    ],
    buttonLabel: "Ativar PeJota Pro",
    footnote: "O custo é menor que um refrigerante por mês.",
    maxShows: 3,
    cooldownDays: 21,
  },
];

/* ─── component ─── */

const UpgradeNudge = () => {
  const { user } = useAuth();
  const { userPlan, loading: featureLoading } = useFeatureAccess();
  const navigate = useNavigate();

  const [activeTrigger, setActiveTrigger] = useState<TriggerDef | null>(null);
  const [open, setOpen] = useState(false);
  const [triggerLogs, setTriggerLogs] = useState<Record<string, { shown_count: number; last_shown_at: string }>>({});
  const [dataLoaded, setDataLoaded] = useState(false);

  // Data signals
  const [patrimonio, setPatrimonio] = useState(0);
  const [lancamentosCount, setLancamentosCount] = useState(0);
  const [hasInvestimentos, setHasInvestimentos] = useState(false);

  // Don't show for Pro or Elite users
  const isPremium = useMemo(() => {
    if (!userPlan) return false;
    return userPlan.slug === "atlas_pro" || userPlan.slug === "atlas_elite" || userPlan.slug === "admin";
  }, [userPlan]);

  // Load data and trigger logs
  useEffect(() => {
    if (!user || featureLoading || isPremium) return;

    const load = async () => {
      const [invFin, invNFin, despesas, receitas, invCount, logs] = await Promise.all([
        supabase.from("investimentos_financeiros").select("valor_atual").eq("user_id", user.id),
        supabase.from("investimentos_nao_financeiros").select("valor").eq("user_id", user.id),
        supabase.from("despesas").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("cashflow_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("investimentos_financeiros").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("upgrade_triggers_log").select("trigger_key, shown_count, last_shown_at").eq("user_id", user.id),
      ]);

      const totalFin = (invFin.data || []).reduce((s, i) => s + (i.valor_atual || 0), 0);
      const totalNFin = (invNFin.data || []).reduce((s, i) => s + (i.valor || 0), 0);
      setPatrimonio(totalFin + totalNFin);
      setLancamentosCount((despesas.count || 0) + (receitas.count || 0));
      setHasInvestimentos((invCount.count || 0) > 0);

      const logsMap: Record<string, { shown_count: number; last_shown_at: string }> = {};
      for (const l of logs.data || []) {
        logsMap[l.trigger_key] = { shown_count: l.shown_count, last_shown_at: l.last_shown_at };
      }
      setTriggerLogs(logsMap);
      setDataLoaded(true);
    };

    load();
  }, [user, featureLoading, isPremium]);

  // Determine which trigger to fire
  useEffect(() => {
    if (!dataLoaded || isPremium) return;

    const now = Date.now();

    const canShow = (key: string, def: TriggerDef): boolean => {
      const log = triggerLogs[key];
      if (!log) return true; // never shown
      if (log.shown_count >= def.maxShows) return false;
      const daysSince = (now - new Date(log.last_shown_at).getTime()) / 86400000;
      return daysSince >= def.cooldownDays;
    };

    // Check conditions in priority order
    if (patrimonio >= 50000 && canShow("patrimonio_50k", TRIGGERS[0])) {
      setActiveTrigger(TRIGGERS[0]);
      setOpen(true);
      return;
    }

    if (lancamentosCount >= 20 && canShow("lancamentos_20", TRIGGERS[1])) {
      setActiveTrigger(TRIGGERS[1]);
      setOpen(true);
      return;
    }

    if (hasInvestimentos && canShow("primeiro_investimento", TRIGGERS[2])) {
      setActiveTrigger(TRIGGERS[2]);
      setOpen(true);
      return;
    }
  }, [dataLoaded, isPremium, patrimonio, lancamentosCount, hasInvestimentos, triggerLogs]);

  // Record impression
  const recordImpression = useCallback(async (key: string) => {
    if (!user) return;
    const existing = triggerLogs[key];

    if (existing) {
      await supabase
        .from("upgrade_triggers_log")
        .update({ shown_count: existing.shown_count + 1, last_shown_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("trigger_key", key);
    } else {
      await supabase
        .from("upgrade_triggers_log")
        .insert({ user_id: user.id, trigger_key: key, shown_count: 1, last_shown_at: new Date().toISOString() });
    }
  }, [user, triggerLogs]);

  // On open, record impression
  useEffect(() => {
    if (open && activeTrigger) {
      recordImpression(activeTrigger.key);
    }
  }, [open, activeTrigger]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = () => {
    setOpen(false);
    setActiveTrigger(null);
  };

  const handleUpgrade = () => {
    setOpen(false);
    navigate("/dashboard/planos");
  };

  if (!activeTrigger || isPremium) return null;

  const renderBlock = (text: string, idx: number) => {
    // Handle bold markers
    const parts = text.split(/\*\*(.*?)\*\*/g);
    const rendered = parts.map((part, i) =>
      i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
    );

    // Bullet list
    if (text.startsWith("•")) {
      const lines = text.split("\n");
      return (
        <ul key={idx} className="space-y-1.5 my-2">
          {lines.map((line, li) => (
            <li key={li} className="flex items-start gap-2 text-sm text-muted-foreground">
              <span className="text-primary mt-0.5">•</span>
              <span>{line.replace(/^•\s*/, "")}</span>
            </li>
          ))}
        </ul>
      );
    }

    // Multi-line paragraph
    if (text.includes("\n")) {
      return (
        <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
          {text.split("\n").map((line, li) => (
            <span key={li}>
              {line.split(/\*\*(.*?)\*\*/g).map((part, i) =>
                i % 2 === 1 ? <strong key={i} className="text-foreground">{part}</strong> : part
              )}
              {li < text.split("\n").length - 1 && <br />}
            </span>
          ))}
        </p>
      );
    }

    return (
      <p key={idx} className="text-sm text-muted-foreground leading-relaxed">
        {rendered}
      </p>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden border-primary/20">
        {/* Header accent bar */}
        <div className="h-1.5 bg-gradient-to-r from-primary to-primary/60" />

        <div className="p-6 space-y-4">
          {/* Emoji + close */}
          <div className="flex items-start justify-between">
            <span className="text-3xl">{activeTrigger.emoji}</span>
            <button onClick={handleDismiss} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Copy blocks */}
          <div className="space-y-3">
            {activeTrigger.blocks.map((block, i) => renderBlock(block, i))}
          </div>

          {/* CTA */}
          <div className="pt-2 space-y-2">
            <Button className="w-full rounded-xl gap-2 h-11" onClick={handleUpgrade}>
              <Sparkles className="h-4 w-4" />
              {activeTrigger.buttonLabel}
            </Button>
            <p className="text-[11px] text-muted-foreground/60 text-center">
              {activeTrigger.footnote}
            </p>
          </div>

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            className="w-full text-center text-xs text-muted-foreground/40 hover:text-muted-foreground transition-colors pt-1"
          >
            Agora não
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeNudge;
