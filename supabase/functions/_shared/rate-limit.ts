import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type RateLimitWindow = "minute" | "hour" | "day";

export interface RateLimitOptions {
  scope: string;
  window: RateLimitWindow;
  limit: number;
}

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  limit: number;
}

// The RPC check_and_increment_rate_limit is granted to service_role only —
// granting to authenticated would let a malicious user spoof the _user_id
// param and burn another user's quota. So the helper instantiates its own
// service-role client; callers don't pass one in.
let cachedAdmin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient {
  if (!cachedAdmin) {
    cachedAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return cachedAdmin;
}

function buildWindowKey(window: RateLimitWindow): string {
  const now = new Date();
  switch (window) {
    case "minute":
      return now.toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    case "hour":
      return now.toISOString().slice(0, 13); // YYYY-MM-DDTHH
    case "day":
      return now.toISOString().slice(0, 10); // YYYY-MM-DD
  }
}

/**
 * Atomic check-and-increment. Returns { allowed: false } when the user has
 * exceeded the limit in the current window. The caller is responsible for
 * returning a 429 to the client.
 *
 * Usage:
 *   const rl = await checkRateLimit(userId, { scope: "advisor-report", window: "day", limit: 5 });
 *   if (!rl.allowed) return rateLimitResponse(rl, corsHeaders);
 */
export async function checkRateLimit(
  userId: string,
  options: RateLimitOptions,
): Promise<RateLimitResult> {
  const windowKey = buildWindowKey(options.window);
  const admin = getAdmin();

  const { data, error } = await admin.rpc("check_and_increment_rate_limit", {
    _user_id: userId,
    _scope: options.scope,
    _window_key: windowKey,
    _limit: options.limit,
  });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    // Failsafe: on DB error, ALLOW the request to avoid blocking everyone.
    // The error will surface in logs and Sentry — investigate but don't lock out users.
    console.error("[rate-limit] RPC error, failing open:", error?.message);
    return { allowed: true, count: 0, limit: options.limit };
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: row.allowed === true,
    count: row.current_count ?? 0,
    limit: row.limit ?? options.limit,
  };
}

/**
 * Builds a standardized 429 response.
 */
export function rateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
  message?: string,
): Response {
  return new Response(
    JSON.stringify({
      error: "rate_limited",
      message: message ?? "Você excedeu o limite de uso. Aguarde antes de tentar novamente.",
      limit: result.limit,
      count: result.count,
    }),
    { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}
