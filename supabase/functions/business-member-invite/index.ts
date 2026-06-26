import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { createInviteToken, generateThrowawayPassword, buildInviteEmailHtml } from "../_shared/invite-tokens.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const PAST_DATE = "2000-01-01T00:00:00Z";
const normalizeEmail = (v: string) => v.trim().toLowerCase();

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const userId = claimsData.claims.sub as string;

    const rl = await checkRateLimit(userId, { scope: "business-member-invite", window: "hour", limit: 20 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders, "Muitos convites. Aguarde um pouco.");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { company_id, email, name, restrict = true } = await req.json();

    // Verifica que o solicitante é o dono da empresa
    const { data: company } = await admin.from("companies").select("id, user_id, name, paid_seats").eq("id", company_id).single();
    if (!company || company.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Apenas o dono pode convidar" }), { status: 403, headers: corsHeaders });
    }
    if (!email || !String(email).includes("@")) {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), { status: 400, headers: corsHeaders });
    }

    // Teto de 10 (1 dono + 9 membros)
    const { count } = await admin.from("company_members").select("id", { count: "exact", head: true }).eq("company_id", company_id);
    if ((count || 0) >= 9) {
      return new Response(JSON.stringify({ error: "Limite de 10 usuários atingido" }), { status: 400, headers: corsHeaders });
    }
    // Trava de assentos pagos: precisa de assento livre pra convidar
    if ((count || 0) >= (company.paid_seats || 0)) {
      return new Response(JSON.stringify({ error: "no_seats" }), { status: 402, headers: corsHeaders });
    }

    const normalizedEmail = normalizeEmail(email);
    const displayName = (name || normalizedEmail.split("@")[0]).trim();

    const { data: existingUserId } = await admin.rpc("find_user_id_by_email", { _email: normalizedEmail });

    let targetUid: string;
    let isNew = false;

    if (existingUserId) {
      if (existingUserId === userId) {
        return new Response(JSON.stringify({ error: "Você já é o dono desta empresa" }), { status: 400, headers: corsHeaders });
      }
      // Conta já existe → só vincula como membro (não mexe no acesso da conta real)
      targetUid = existingUserId as string;
    } else {
      // Cria a conta do convidado
      isNew = true;
      const pwd = generateThrowawayPassword();
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password: pwd,
        email_confirm: true,
        user_metadata: { full_name: displayName, signup_source: "business_invite", must_change_password: true },
      });
      if (createErr || !newUser?.user?.id) {
        console.error("[business-member-invite] createUser error:", createErr);
        return new Response(JSON.stringify({ error: "Erro ao criar usuário" }), { status: 500, headers: corsHeaders });
      }
      targetUid = newUser.user.id;

      await admin.from("profiles").upsert({
        user_id: targetUid, full_name: displayName, must_change_password: true,
        tema_sidebar: "white", tema_destaque: "default", tema_modo: "light",
        onboarding_completed: true, onboarding_completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      await admin.from("user_subscriptions").upsert({
        user_id: targetUid, plan_tier: "free", access_state: "awaiting_payment", origin: "business_invite",
        trial_expires_at: PAST_DATE, grace_finance_until: PAST_DATE, scheduled_deletion_at: PAST_DATE, updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

      // Acesso restrito só pra contas novas (criadas como colaborador) e quando pedido
      if (restrict) {
        await admin.from("profiles").update({ access_scope: "negocios", updated_at: new Date().toISOString() }).eq("user_id", targetUid);
      }
    }

    // Vincula como membro
    await admin.from("company_members").upsert({ company_id, user_id: targetUid, role: "editor" }, { onConflict: "company_id,user_id" });

    // Conta nova → envia e-mail "crie sua senha"
    if (isNew) {
      const { url: acceptUrl } = await createInviteToken(admin, {
        userId: targetUid, email: normalizedEmail, source: "business", createdBy: userId,
        metadata: { company_id, display_name: displayName },
      });
      let emailError: string | null = null;
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Walter Espindola - Atlas <noreply@walterespindola.com.br>",
              to: normalizedEmail,
              reply_to: "suporte@walterespindola.com.br",
              subject: `Você foi convidado para o ${company.name} no Atlas`,
              html: buildInviteEmailHtml({
                acceptUrl, recipientName: displayName, source: "business",
                customSubjectIntro: `Você foi convidado para acessar o ${company.name} no Atlas Negócios. O link abaixo te leva para criar sua senha e começar.`,
              }),
              headers: {
                "List-Unsubscribe": "<mailto:suporte@walterespindola.com.br?subject=Unsubscribe>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }),
          });
        }
      } catch (e) { emailError = String(e); console.error("[business-member-invite] email error:", e); }
      return new Response(JSON.stringify({ success: true, is_new_user: true, email_error: emailError, accept_url: acceptUrl, name: displayName }), { headers: corsHeaders });
    }

    // Conta existente → vinculada, sem e-mail de senha
    return new Response(JSON.stringify({ success: true, is_new_user: false, existing: true }), { headers: corsHeaders });
  } catch (e) {
    console.error("[business-member-invite] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
