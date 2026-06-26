import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";

function respond(body: Record<string, unknown>, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function urgentFeedbackHTML(fb: Record<string, any>, attachmentsHTML = ""): string {
  const safeTitle = String(fb.title ?? "").replace(/[<>]/g, "");
  const safeDescription = String(fb.description ?? "").replace(/[<>]/g, "");
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#F4F1EC;font-family:'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EC;padding:40px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(74,64,53,0.08);">
  <tr><td style="background:${fb.urgency === "urgente" ? "#B91C1C" : "#4A4035"};padding:32px 40px;text-align:center;">
    <h1 style="margin:0;color:#F4F1EC;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
      Atlas — ${fb.urgency === "urgente" ? "Feedback URGENTE" : "Feedback de Cobrança"}
    </h1>
  </td></tr>
  <tr><td style="padding:32px 40px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:6px 0;color:#6B5E50;font-size:13px;width:120px;"><strong>Usuário:</strong></td>
          <td style="padding:6px 0;color:#4A4035;font-size:13px;">${fb.user_name ?? "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#6B5E50;font-size:13px;"><strong>Email:</strong></td>
          <td style="padding:6px 0;color:#4A4035;font-size:13px;">${fb.user_email ?? "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#6B5E50;font-size:13px;"><strong>Plano:</strong></td>
          <td style="padding:6px 0;color:#4A4035;font-size:13px;">${fb.user_plan ?? "—"}</td></tr>
      <tr><td style="padding:6px 0;color:#6B5E50;font-size:13px;"><strong>Categoria:</strong></td>
          <td style="padding:6px 0;color:#4A4035;font-size:13px;">${fb.category}</td></tr>
      <tr><td style="padding:6px 0;color:#6B5E50;font-size:13px;"><strong>Urgência:</strong></td>
          <td style="padding:6px 0;color:#4A4035;font-size:13px;font-weight:700;">${fb.urgency}</td></tr>
      <tr><td style="padding:6px 0;color:#6B5E50;font-size:13px;"><strong>Página:</strong></td>
          <td style="padding:6px 0;color:#4A4035;font-size:13px;">${fb.page_url ?? "—"}</td></tr>
    </table>
    <div style="background:#F9F7F4;border-radius:10px;padding:20px;border:1px solid #EDE8DF;margin-bottom:16px;">
      <h2 style="margin:0 0 12px;color:#4A4035;font-size:17px;font-weight:700;">${safeTitle}</h2>
      <p style="margin:0;color:#4A4035;font-size:14px;line-height:1.6;white-space:pre-wrap;">${safeDescription}</p>
    </div>
    <p style="margin:0;color:#8B7D6B;font-size:11px;line-height:1.5;">
      Feedback ID: ${fb.id}<br>
      Recebido em: ${new Date(fb.created_at).toLocaleString("pt-BR")}
    </p>
    ${attachmentsHTML}
  </td></tr>
  <tr><td style="background:#F9F7F4;padding:20px 40px;text-align:center;border-top:1px solid #EDE8DF;">
    <p style="margin:0;color:#A09472;font-size:12px;">© ${new Date().getFullYear()} Atlas · Painel Admin</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405, corsHeaders);

  let payload: { feedback_id?: string };
  try {
    payload = await req.json();
  } catch {
    return respond({ error: "Invalid JSON" }, 400, corsHeaders);
  }

  const feedbackId = payload.feedback_id;
  if (!feedbackId) {
    return respond({ error: "feedback_id required" }, 400, corsHeaders);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth check: require authenticated user or service_role
  const authHeader = req.headers.get("Authorization") || "";
  const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

  if (!isServiceRole) {
    // Validate user JWT
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return respond({ error: "Unauthorized" }, 401, corsHeaders);
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: fb, error } = await supabase
    .from("user_feedback")
    .select("*")
    .eq("id", feedbackId)
    .single();

  if (error || !fb) {
    return respond({ error: "feedback not found" }, 404, corsHeaders);
  }

  const shouldNotify = fb.urgency === "urgente" || fb.category === "cobrança";
  if (!shouldNotify) {
    return respond({ notified: false, reason: "not urgent" }, 200, corsHeaders);
  }

  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    return respond({ error: "RESEND_API_KEY missing" }, 500, corsHeaders);
  }

  let attachmentsHTML = "";
  if (Array.isArray(fb.attachments) && fb.attachments.length > 0) {
    const signedUrls: string[] = [];
    for (const path of fb.attachments) {
      const { data } = await supabase.storage
        .from("feedback-attachments")
        .createSignedUrl(path, 60 * 60 * 24 * 7);
      if (data?.signedUrl) signedUrls.push(data.signedUrl);
    }
    if (signedUrls.length > 0) {
      attachmentsHTML = `
        <hr style="border:none;border-top:1px solid #EDE8DF;margin:20px 0;">
        <p style="margin:0 0 8px;color:#4A4035;font-size:13px;font-weight:700;">Anexos:</p>
        <div>${signedUrls
          .map(
            (u, i) =>
              `<a href="${u}" target="_blank" style="display:inline-block;margin:0 8px 8px 0;"><img src="${u}" style="max-width:200px;max-height:200px;border:1px solid #EDE8DF;border-radius:6px;" alt="Anexo ${i + 1}"></a>`,
          )
          .join("")}</div>`;
    }
  }

  const subject = `[Atlas ${String(fb.urgency).toUpperCase()}] ${fb.category} — ${fb.title}`;
  const html = urgentFeedbackHTML(fb, attachmentsHTML);

  const emailRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Atlas <suporte@walterespindola.com.br>",
      to: ["suporte.metodoatlas@gmail.com"],
      reply_to: fb.user_email ?? undefined,
      subject,
      html,
    }),
  });

  if (!emailRes.ok) {
    const errText = await emailRes.text();
    console.error("[notify-urgent-feedback] Provider error");
    return respond({ error: "email send failed", detail: errText }, 500, corsHeaders);
  }

  return respond({ notified: true }, 200, corsHeaders);
});
