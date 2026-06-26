import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, body, cta_label, cta_url, target_plan, send_email, expires_at } = await req.json();

    if (!title?.trim() || !body?.trim()) {
      return new Response(JSON.stringify({ error: "title and body required" }), { status: 400, headers: corsHeaders });
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "not authenticated" }), { status: 401, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "not authenticated" }), { status: 401, headers: corsHeaders });
    }

    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "admin only" }), { status: 403, headers: corsHeaders });
    }

    const { data: inserted, error } = await supabase
      .from("admin_recados")
      .insert({
        title: title.trim(),
        body: body.trim(),
        cta_label: cta_label?.trim() || null,
        cta_url: cta_url?.trim() || null,
        target_plan: target_plan || "all",
        send_email: !!send_email,
        created_by: user.id,
        expires_at: expires_at || null,
      })
      .select()
      .single();

    if (error || !inserted) {
      return new Response(JSON.stringify({ error: "failed to create recado", detail: error?.message }), { status: 500, headers: corsHeaders });
    }

    // Gambiarra temporária: user_subscriptions.plan_tier só tem "free"/"full" no schema atual.
    // Para segmentar por essencial/pro/elite, mapeamos para "full" (todo pagante).
    // TODO: granularizar plan_tier no schema futuramente.
    const normalizedTarget = target_plan || "all";
    const effectivePlan = ["essencial", "pro", "elite"].includes(normalizedTarget) ? "full" : normalizedTarget;

    const fetchTargetUserIds = async (): Promise<string[]> => {
      let userQuery = supabase.from("user_subscriptions").select("user_id");
      if (effectivePlan !== "all") {
        userQuery = userQuery.eq("plan_tier", effectivePlan);
      }
      const { data: subs } = await userQuery;
      return (subs ?? []).map((s: any) => s.user_id).filter(Boolean);
    };

    let emailsSent = 0;
    if (send_email) {
      const resendKey = Deno.env.get("RESEND_API_KEY");
      if (resendKey) {
        const userIds = await fetchTargetUserIds();

        const emails: string[] = [];
        for (const uid of userIds) {
          const { data: u } = await supabase.auth.admin.getUserById(uid);
          if (u?.user?.email) emails.push(u.user.email);
        }

        const safeTitle = String(title).replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const safeBody = String(body).replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
        const ctaHTML = cta_url && cta_label
          ? `<p style="margin:24px 0;"><a href="${cta_url}" style="background:#4A4035;color:#fff;padding:10px 20px;border-radius:10px;text-decoration:none;font-family:sans-serif;font-size:14px;">${String(cta_label).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</a></p>`
          : "";

        const html = `
          <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#2b2b2b;">
            <h2 style="font-family:sans-serif;color:#4A4035;margin:0 0 12px;">${safeTitle}</h2>
            <p style="font-size:15px;line-height:1.55;">${safeBody}</p>
            ${ctaHTML}
            <hr style="border:none;border-top:1px solid #e5e1d8;margin:24px 0;" />
            <p style="font-size:12px;color:#8a8579;">Equipe Atlas · useatlasapp.com</p>
          </div>
        `;

        for (let i = 0; i < emails.length; i += 50) {
          const batch = emails.slice(i, i + 50);
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Atlas <noreply@walterespindola.com.br>",
              to: ["no-reply@useatlasapp.com"],
              bcc: batch,
              subject: title,
              html,
            }),
          });
          emailsSent += batch.length;
        }
      }
    }

    let push_sent = 0;
    let push_failed = 0;

    try {
      const userIds = await fetchTargetUserIds();

      if (userIds.length > 0) {
        const pushResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": authHeader,
          },
          body: JSON.stringify({
            mode: "user_ids",
            user_ids: userIds,
            title: inserted.title,
            message: inserted.body,
            url: inserted.cta_url || "/dashboard",
            tag: `recado-${inserted.id}`,
          }),
        });

        if (pushResponse.ok) {
          const pushData = await pushResponse.json();
          push_sent = pushData.sent ?? 0;
          push_failed = pushData.failed ?? 0;
        }
      }
    } catch (pushErr) {
      console.error("[send-recado] push dispatch failed:", pushErr);
    }

    return new Response(JSON.stringify({
      recado: inserted,
      emails_sent: emailsSent,
      push_sent,
      push_failed,
    }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "unknown" }), { status: 500, headers: corsHeaders });
  }
});
