import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { logError, logWarn } from "@/lib/log";

export interface ExpenseSkip {
  id: string;
  user_id: string;
  template_id: string;
  month_ref: string;
  reason: string | null;
  created_at: string;
}

interface SkipsContextValue {
  skips: ExpenseSkip[];
  loading: boolean;
  isSkipped: (templateId: string, monthRef: string) => boolean;
  skipMonth: (templateId: string, monthRef: string, reason?: string) => Promise<void>;
  unskipMonth: (templateId: string, monthRef: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const SkipsContext = createContext<SkipsContextValue | null>(null);

export function ExpenseSkipsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [skips, setSkips] = useState<ExpenseSkip[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSkips = useCallback(async () => {
    if (!user) { setSkips([]); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from("despesas_skip")
      .select("*")
      .eq("user_id", user.id);
    if (error) {
      logError("[ExpenseSkips] fetch error:", error.message);
    }
    setSkips((data || []) as ExpenseSkip[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchSkips(); }, [fetchSkips]);

  const isSkipped = useCallback((templateId: string, monthRef: string) => {
    return skips.some(s => s.template_id === templateId && s.month_ref === monthRef);
  }, [skips]);

  const skipMonth = useCallback(async (templateId: string, monthRef: string, reason?: string) => {
    if (!user) return;

    // Antes de pular: limpa pagamento daquele mês (se existia).
    // Pular significa "essa despesa não acontece este mês" — pagamento prévio fica inconsistente.
    const { error: pagError } = await supabase
      .from("pagamentos")
      .delete()
      .eq("user_id", user.id)
      .eq("ref_type", "despesa")
      .eq("ref_id", templateId)
      .eq("mes", monthRef);
    if (pagError) {
      logWarn("[ExpenseSkips] limpar pagamento warning:", pagError.message);
      // não bloqueia o skip — só warning
    }

    const { error } = await supabase
      .from("despesas_skip")
      .insert({ user_id: user.id, template_id: templateId, month_ref: monthRef, reason: reason || null } as any);
    if (error) {
      if (error.code === "23505") {
        toast({ title: "Já pulado", description: "Este mês já estava marcado como pulado." });
        return;
      }
      logError("[ExpenseSkips] skip error:", error.message);
      toast({ title: "Erro ao pular", variant: "destructive" });
      return;
    }
    toast({ title: "Pulado neste mês" });
    await fetchSkips();
  }, [user, fetchSkips, toast]);

  const unskipMonth = useCallback(async (templateId: string, monthRef: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("despesas_skip")
      .delete()
      .eq("user_id", user.id)
      .eq("template_id", templateId)
      .eq("month_ref", monthRef);
    if (error) {
      logError("[ExpenseSkips] unskip error:", error.message);
      toast({ title: "Erro ao desfazer", variant: "destructive" });
      return;
    }
    toast({ title: "Pulo desfeito" });
    await fetchSkips();
  }, [user, fetchSkips, toast]);

  return (
    <SkipsContext.Provider value={{ skips, loading, isSkipped, skipMonth, unskipMonth, refresh: fetchSkips }}>
      {children}
    </SkipsContext.Provider>
  );
}

export function useExpenseSkips(): SkipsContextValue {
  const ctx = useContext(SkipsContext);
  if (!ctx) {
    // Fallback silencioso pra casos onde o provider ainda não foi adicionado
    // (evita quebrar tela durante o rollout). Retorna estado vazio.
    return {
      skips: [],
      loading: false,
      isSkipped: () => false,
      skipMonth: async () => {},
      unskipMonth: async () => {},
      refresh: async () => {},
    };
  }
  return ctx;
}
