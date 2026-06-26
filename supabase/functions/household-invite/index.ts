import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { createInviteToken, generateThrowawayPassword, buildInviteEmailHtml } from "../_shared/invite-tokens.ts";
import { checkRateLimit, rateLimitResponse } from "../_shared/rate-limit.ts";

const PAST_DATE = "2000-01-01T00:00:00Z";

const normalizeEmail = (value: string) => value.trim().toLowerCase();

async function ensureInviteSubscriptionOrigin(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const now = new Date().toISOString();
  const { data: existingSub, error: subErr } = await supabaseAdmin
    .from("user_subscriptions")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (subErr) {
    console.error("[household-invite] Subscription fetch error:", subErr);
    return;
  }

  if (existingSub?.id) {
    await supabaseAdmin
      .from("user_subscriptions")
      .update({ origin: "household_invite", updated_at: now })
      .eq("id", existingSub.id);
    return;
  }

  await supabaseAdmin.from("user_subscriptions").insert({
    user_id: userId,
    plan_tier: "free",
    access_state: "awaiting_payment",
    origin: "household_invite",
    trial_expires_at: PAST_DATE,
    grace_finance_until: PAST_DATE,
    scheduled_deletion_at: PAST_DATE,
    updated_at: now,
  });
}

async function enforceFirstAccessProfile(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  displayName: string,
) {
  const now = new Date().toISOString();
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("user_id, full_name, tema_sidebar, tema_destaque, tema_modo")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile) {
    await supabaseAdmin.from("profiles").upsert({
      user_id: userId,
      full_name: displayName,
      must_change_password: false,
      tema_sidebar: "white",
      tema_destaque: "default",
      tema_modo: "light",
      updated_at: now,
    });
    return;
  }

  const patch: Record<string, unknown> = {
    must_change_password: false,
    updated_at: now,
  };

  if (!profile.full_name?.trim()) patch.full_name = displayName;
  if (!profile.tema_sidebar || profile.tema_sidebar === "default") patch.tema_sidebar = "white";
  if (!profile.tema_destaque) patch.tema_destaque = "default";
  if (!profile.tema_modo || profile.tema_modo === "system") patch.tema_modo = "light";

  await supabaseAdmin.from("profiles").update(patch).eq("user_id", userId);
}

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

    const rl = await checkRateLimit(userId, { scope: "household-invite", window: "hour", limit: 10 });
    if (!rl.allowed) return rateLimitResponse(rl, corsHeaders, "Muitos convites enviados. Aguarde antes de convidar mais membros.");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { action, household_id, email, display_name, member_id } = await req.json();

    const { data: household } = await supabaseAdmin
      .from("households")
      .select("id, owner_id")
      .eq("id", household_id)
      .single();

    if (!household || household.owner_id !== userId) {
      return new Response(JSON.stringify({ error: "Apenas o titular pode gerenciar membros" }), { status: 403, headers: corsHeaders });
    }

    if (action === "invite") {
      if (!email || !email.includes("@")) {
        return new Response(JSON.stringify({ error: "Email invalido" }), { status: 400, headers: corsHeaders });
      }

      const normalizedEmail = normalizeEmail(email);
      const memberDisplayName = (display_name || normalizedEmail.split("@")[0]).trim();

      const { data: existing } = await supabaseAdmin
        .from("household_members")
        .select("id, status")
        .eq("household_id", household_id)
        .eq("invited_email", normalizedEmail)
        .maybeSingle();

      if (existing && existing.status === "active") {
        return new Response(JSON.stringify({ error: "Este email ja e membro ativo" }), { status: 409, headers: corsHeaders });
      }

      const throwawayPassword = generateThrowawayPassword();

      const { data: existingUserId, error: findUserErr } = await supabaseAdmin.rpc("find_user_id_by_email", {
        _email: normalizedEmail,
      });

      if (findUserErr) {
        console.error("[household-invite] find_user_id_by_email error:", findUserErr);
        return new Response(JSON.stringify({ error: "Erro ao reconciliar identidade do convite" }), { status: 500, headers: corsHeaders });
      }

      // Checagem de existencia (antes feita no frontend via find_user_id_by_email,
      // que era um oraculo email->user_id acessivel por anon key). Agora vive aqui:
      // se o e-mail ja tem conta, NAO convida e devolve status estruturado, sem
      // expor o user_id ao cliente. UX no frontend permanece identica.
      if (existingUserId) {
        return new Response(JSON.stringify({ status: "email_already_exists" }), { headers: corsHeaders });
      }

      const isNewUser = true;

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: normalizedEmail,
        password: throwawayPassword,
        email_confirm: true,
        user_metadata: {
          full_name: memberDisplayName,
          signup_source: "household_invite",
          must_change_password: true,
        },
      });

      if (createError || !newUser?.user?.id) {
        console.error("[household-invite] Create user error:", createError);
        return new Response(JSON.stringify({ error: "Erro ao criar usuario" }), { status: 500, headers: corsHeaders });
      }

      const invitedUserId = newUser.user.id;

      await enforceFirstAccessProfile(supabaseAdmin, invitedUserId, memberDisplayName);

      if (existing) {
        await supabaseAdmin
          .from("household_members")
          .update({
            status: "invited",
            user_id: invitedUserId,
            display_name: memberDisplayName,
            invited_email: normalizedEmail,
            invited_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin
          .from("household_members")
          .insert({
            household_id,
            user_id: invitedUserId,
            role: "member",
            status: "invited",
            invited_email: normalizedEmail,
            display_name: memberDisplayName,
            invited_at: new Date().toISOString(),
          });
      }

      await ensureInviteSubscriptionOrigin(supabaseAdmin, invitedUserId);

      // Generate invite token + send branded email (no password disclosed)
      const { url: acceptUrl } = await createInviteToken(supabaseAdmin, {
        userId: invitedUserId,
        email: normalizedEmail,
        source: "household",
        createdBy: userId,
        metadata: { household_id, display_name: memberDisplayName },
      });

      let emailSendError: string | null = null;
      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Walter Espindola - Atlas <noreply@walterespindola.com.br>",
              to: normalizedEmail,
              reply_to: "suporte@walterespindola.com.br",
              subject: isNewUser ? "Convite para você usar o Atlas — vamos juntos?" : "Seu acesso ao Atlas foi atualizado",
              html: buildInviteEmailHtml({
                acceptUrl,
                recipientName: memberDisplayName,
                source: "household",
              }),
              headers: {
                "List-Unsubscribe": "<mailto:suporte@walterespindola.com.br?subject=Unsubscribe>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }),
          });
        }
      } catch (emailErr) {
        console.error("[household-invite] Email send error:", emailErr);
        emailSendError = String(emailErr);
      }

      console.log(`[household-invite] User ${userId} invited a member to household ${household_id}`);
      return new Response(JSON.stringify({
        success: true,
        member_user_id: invitedUserId,
        is_new_user: isNewUser,
        invite_link_sent: true,
        email_error: emailSendError,
      }), { headers: corsHeaders });
    }

    if (action === "remove") {
      if (!member_id) {
        return new Response(JSON.stringify({ error: "member_id obrigatorio" }), { status: 400, headers: corsHeaders });
      }

      const { data: member } = await supabaseAdmin
        .from("household_members")
        .select("role, user_id")
        .eq("id", member_id)
        .eq("household_id", household_id)
        .single();

      if (!member) {
        return new Response(JSON.stringify({ error: "Membro nao encontrado neste household" }), { status: 404, headers: corsHeaders });
      }

      if (member?.role === "owner") {
        return new Response(JSON.stringify({ error: "Nao e possivel remover o titular" }), { status: 400, headers: corsHeaders });
      }

      await supabaseAdmin
        .from("household_members")
        .update({ status: "removed", updated_at: new Date().toISOString() })
        .eq("id", member_id)
        .eq("household_id", household_id);

      if (member?.user_id) {
        await supabaseAdmin.auth.admin.signOut(member.user_id);
      }

      console.log(`[household-invite] User ${userId} removed member ${member_id} from household ${household_id}`);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    if (action === "resend") {
      if (!member_id) {
        return new Response(JSON.stringify({ error: "member_id obrigatorio" }), { status: 400, headers: corsHeaders });
      }

      const { data: member } = await supabaseAdmin
        .from("household_members")
        .select("invited_email, display_name, user_id")
        .eq("id", member_id)
        .eq("household_id", household_id)
        .single();

      if (!member) {
        return new Response(JSON.stringify({ error: "Membro nao encontrado neste household" }), { status: 404, headers: corsHeaders });
      }

      if (!member?.invited_email) {
        return new Response(JSON.stringify({ error: "Membro sem email de convite" }), { status: 400, headers: corsHeaders });
      }

      const normalizedEmail = normalizeEmail(member.invited_email);
      const throwawayPassword = generateThrowawayPassword();

      let resolvedUserId = member.user_id as string | null;
      if (!resolvedUserId) {
        const { data: existingUserId } = await supabaseAdmin.rpc("find_user_id_by_email", { _email: normalizedEmail });
        resolvedUserId = (existingUserId as string | null) || null;
      }

      if (!resolvedUserId) {
        return new Response(JSON.stringify({ error: "Conta do membro não encontrada para reenvio" }), { status: 404, headers: corsHeaders });
      }

      const { data: authUserData, error: authUserErr } = await supabaseAdmin.auth.admin.getUserById(resolvedUserId);
      if (authUserErr || !authUserData?.user) {
        return new Response(JSON.stringify({ error: "Conta do membro inválida para reenvio" }), { status: 404, headers: corsHeaders });
      }

      const displayName = (member.display_name || authUserData.user.user_metadata?.full_name || normalizedEmail.split("@")[0]).trim();

      // Rotate password (invalidates old credentials) + force re-onboard
      const { error: updatePasswordErr } = await supabaseAdmin.auth.admin.updateUserById(resolvedUserId, {
        password: throwawayPassword,
        user_metadata: {
          ...(authUserData.user.user_metadata || {}),
          full_name: displayName,
          signup_source: "household_invite",
          must_change_password: true,
        },
      });

      if (updatePasswordErr) {
        console.error("[household-invite] Resend update user error:", updatePasswordErr);
        return new Response(JSON.stringify({ error: "Erro ao atualizar credenciais para reenvio" }), { status: 500, headers: corsHeaders });
      }

      await supabaseAdmin.auth.admin.signOut(resolvedUserId);
      await enforceFirstAccessProfile(supabaseAdmin, resolvedUserId, displayName);
      await ensureInviteSubscriptionOrigin(supabaseAdmin, resolvedUserId);

      await supabaseAdmin
        .from("household_members")
        .update({
          user_id: resolvedUserId,
          invited_email: normalizedEmail,
          display_name: displayName,
          invited_at: new Date().toISOString(),
          status: "invited",
          updated_at: new Date().toISOString(),
        })
        .eq("id", member_id)
        .eq("household_id", household_id);

      const { url: acceptUrl } = await createInviteToken(supabaseAdmin, {
        userId: resolvedUserId,
        email: normalizedEmail,
        source: "household",
        createdBy: userId,
        metadata: { display_name: displayName, resend: true },
      });

      try {
        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Walter Espindola - Atlas <noreply@walterespindola.com.br>",
              to: normalizedEmail,
              reply_to: "suporte@walterespindola.com.br",
              subject: "Reenviei seu link de acesso ao Atlas",
              html: buildInviteEmailHtml({
                acceptUrl,
                recipientName: displayName,
                source: "household",
                customSubjectIntro: "Reenviamos seu link de acesso. Toque no botão abaixo para ativar seu acesso e criar sua senha.",
              }),
              headers: {
                "List-Unsubscribe": "<mailto:suporte@walterespindola.com.br?subject=Unsubscribe>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }),
          });
        }
      } catch (emailErr) {
        console.error("[household-invite] Resend email error:", emailErr);
      }

      console.log(`[household-invite] Resent invite for member ${member_id}`);
      return new Response(JSON.stringify({ success: true, invite_link_sent: true }), { headers: corsHeaders });
    }

    return new Response(JSON.stringify({ error: "Acao invalida" }), { status: 400, headers: corsHeaders });
  } catch (e: any) {
    console.error("[household-invite] Error:", e.message);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
