import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type QuotaResult = {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
  period?: string;
  resets_at?: string;
  is_admin?: boolean;
  reason?: string;
};

/**
 * Checa quota da feature e incrementa o contador atomicamente via RPC.
 * Chamar ANTES de invocar a LLM.
 * Fail-closed: em caso de erro na RPC, bloqueia.
 */
export async function checkAndIncrementQuota(
  authHeader: string,
  feature: "chat" | "report" | "simulator",
): Promise<QuotaResult> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data, error } = await supabase.rpc("check_and_increment_ai_quota", {
    _feature: feature,
  });

  if (error) {
    console.error("[quota-check] RPC error:", error);
    return {
      allowed: false,
      used: 0,
      limit: 0,
      remaining: 0,
      reason: "quota_check_failed",
    };
  }

  return data as QuotaResult;
}

export function quotaExceededResponse(
  result: QuotaResult,
  feature: string,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(
    JSON.stringify({
      error: "AI_QUOTA_EXCEEDED",
      feature,
      used: result.used,
      limit: result.limit,
      remaining: 0,
      period: result.period,
      resets_at: result.resets_at,
      message: `Você atingiu o limite de ${result.limit} usos ${result.period === "daily" ? "hoje" : "este mês"}. Faça upgrade do plano para continuar.`,
      upgrade_url: "/dashboard/planos",
    }),
    {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}
