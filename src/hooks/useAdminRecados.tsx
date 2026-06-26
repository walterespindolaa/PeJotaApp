import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePlan } from "@/hooks/usePlan";
import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/log";

export type AdminRecado = {
  id: string;
  title: string;
  body: string;
  cta_label: string | null;
  cta_url: string | null;
  target_plan: string;
  created_at: string;
  expires_at: string | null;
  read_at: string | null;
  dismissed_at: string | null;
};

export function useAdminRecados() {
  const { user } = useAuth();
  const { planTier, loading: planLoading } = usePlan();
  const [recados, setRecados] = useState<AdminRecado[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecados = useCallback(async () => {
    if (!user || planLoading) return;
    setLoading(true);

    // Busca TODOS os recados recentes e filtra em memória
    // (evita bugs de sintaxe com .or() encadeado)
    const { data, error } = await (supabase as any)
      .from("admin_recados")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      logError("[useAdminRecados] fetch error:", error);
      setRecados([]);
      setLoading(false);
      return;
    }

    if (!data || data.length === 0) {
      setRecados([]);
      setLoading(false);
      return;
    }

    // Filtros em memória
    const now = Date.now();
    const planTierNorm = planTier || "free";

    const filtered = data.filter((r: any) => {
      // Filtro de plano
      if (r.target_plan !== "all" && r.target_plan !== planTierNorm) {
        // Gambiarra: essencial/pro/elite caem em "full"
        if (["essencial", "pro", "elite"].includes(r.target_plan) && (planTierNorm as string) === "full") {
          // passa
        } else {
          return false;
        }
      }
      // Filtro de expiração
      if (r.expires_at && new Date(r.expires_at).getTime() <= now) {
        return false;
      }
      // Conta nova não vê recados criados antes de ela entrar (evita recados antigos/de teste)
      if (user.created_at && new Date(r.created_at).getTime() < new Date(user.created_at).getTime()) {
        return false;
      }
      return true;
    }).slice(0, 20);

    if (filtered.length === 0) {
      setRecados([]);
      setLoading(false);
      return;
    }

    const ids = filtered.map((r: any) => r.id);
    const { data: reads } = await (supabase as any)
      .from("user_recado_reads")
      .select("recado_id, read_at, dismissed_at")
      .eq("user_id", user.id)
      .in("recado_id", ids);

    const readMap = new Map<string, { read_at: string | null; dismissed_at: string | null }>();
    (reads ?? []).forEach((r: any) => {
      readMap.set(r.recado_id, { read_at: r.read_at, dismissed_at: r.dismissed_at });
    });

    const merged: AdminRecado[] = filtered
      .map((r: any) => ({
        ...r,
        read_at: readMap.get(r.id)?.read_at ?? null,
        dismissed_at: readMap.get(r.id)?.dismissed_at ?? null,
      }))
      .filter((r: AdminRecado) => !r.dismissed_at);

    setRecados(merged);
    setLoading(false);
  }, [user, planTier, planLoading]);

  useEffect(() => { fetchRecados(); }, [fetchRecados]);

  const markAsRead = async (recadoId: string) => {
    if (!user) return;
    const readAt = new Date().toISOString();
    await (supabase as any)
      .from("user_recado_reads")
      .upsert({ user_id: user.id, recado_id: recadoId, read_at: readAt }, { onConflict: "user_id,recado_id" });
    setRecados(prev => prev.map(r => r.id === recadoId ? { ...r, read_at: readAt } : r));
  };

  const dismiss = async (recadoId: string) => {
    if (!user) return;
    const dismissedAt = new Date().toISOString();
    await (supabase as any)
      .from("user_recado_reads")
      .upsert({ user_id: user.id, recado_id: recadoId, dismissed_at: dismissedAt }, { onConflict: "user_id,recado_id" });
    setRecados(prev => prev.filter(r => r.id !== recadoId));
  };

  const dismissAll = async () => {
    if (!user || recados.length === 0) return;
    const dismissedAt = new Date().toISOString();
    const rows = recados.map(r => ({ user_id: user.id, recado_id: r.id, dismissed_at: dismissedAt }));
    await (supabase as any)
      .from("user_recado_reads")
      .upsert(rows, { onConflict: "user_id,recado_id" });
    setRecados([]);
  };

  const unreadCount = recados.filter(r => !r.read_at).length;

  return { recados, loading, unreadCount, markAsRead, dismiss, dismissAll, refetch: fetchRecados };
}
