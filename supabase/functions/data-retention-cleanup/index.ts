import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

/**
 * Data retention cleanup job (LGPD compliance)
 * Requires service_role key authentication (cron/internal only)
 *
 * Retention policy:
 *  - ai_inference_cache:          12 months  (+ LRU 500/user via trigger)
 *  - fatura_import_logs:          12 months
 *  - credit_card_audit_events:    24 months
 *  - atlas_score_snapshots:       24 months
 *  - portfolio_snapshots:         36 months
 *  - credit_card_statements:      file_path nulled after 24 months (record kept)
 */

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Auth: require service_role key ---
    const authHeader = req.headers.get("Authorization") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!isServiceRole) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey
    );

    const results: Record<string, number | string> = {};

    // ── 1. AI inference cache: 12 months via DB function ──
    const { data: cacheResult } = await supabase.rpc("purge_old_import_logs", { months_to_keep: 12 }) as any;
    results.import_logs_purged = cacheResult ?? 0;

    // ── 2. AI inference cache raw cleanup (direct, service role bypasses RLS) ──
    const months12Ago = new Date();
    months12Ago.setMonth(months12Ago.getMonth() - 12);

    const { count: cacheCount } = await supabase
      .from("ai_inference_cache")
      .delete({ count: "exact" })
      .lt("created_at", months12Ago.toISOString());
    results.ai_cache_deleted = cacheCount ?? 0;

    // ── 3. Atlas score snapshots: 24 months ──
    const { data: scoreResult } = await supabase.rpc("purge_old_score_snapshots", { months_to_keep: 24 }) as any;
    results.score_snapshots_purged = scoreResult ?? 0;

    // ── 4. Portfolio snapshots: 36 months ──
    const { data: portfolioResult } = await supabase.rpc("purge_old_portfolio_snapshots", { months_to_keep: 36 }) as any;
    results.portfolio_snapshots_purged = portfolioResult ?? 0;

    // ── 5. Credit card audit events: 24 months ──
    const { data: auditResult } = await supabase.rpc("purge_old_audit_events", { months_to_keep: 24 }) as any;
    results.audit_events_purged = auditResult ?? 0;

    // ── 6. Storage: null out file_path for statements older than 24 months ──
    const months24Ago = new Date();
    months24Ago.setMonth(months24Ago.getMonth() - 24);

    const { data: oldStatements } = await supabase
      .from("credit_card_statements")
      .select("id,file_path")
      .lt("created_at", months24Ago.toISOString())
      .not("file_path", "is", null)
      .limit(500);

    if (oldStatements?.length) {
      const paths = oldStatements
        .filter((s: any) => s.file_path)
        .map((s: any) => s.file_path);

      if (paths.length > 0) {
        await supabase.storage.from("faturas").remove(paths);
      }

      const ids = oldStatements.map((s: any) => s.id);
      await supabase
        .from("credit_card_statements")
        .update({ file_path: null })
        .in("id", ids);

      results.storage_files_cleaned = paths.length;
    } else {
      results.storage_files_cleaned = 0;
    }

    console.log("[data-retention] Cleanup completed:", results);

    // ── 7. Log cleanup run (use sentinel UUID that won't violate FK) ──
    // Skip audit log insert to avoid FK issues with sentinel UUIDs
    // The console log above provides sufficient observability.

    return new Response(JSON.stringify({ ok: true, results }), { status: 200, headers: corsHeaders });
  } catch (e: any) {
    console.error("[data-retention] Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
