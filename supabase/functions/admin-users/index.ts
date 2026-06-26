import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeadersWithContentType } from "../_shared/cors.ts";
import { createInviteToken, generateThrowawayPassword, buildInviteEmailHtml } from "../_shared/invite-tokens.ts";

function respond(body: Record<string, unknown>, status = 200, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function generateRandomPassword(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => chars[b % chars.length]).join("");
}

const PAST_DATE = "2000-01-01T00:00:00Z";

/** Build the canonical FULL subscription update payload */
function buildFullPayload(durationDays: number) {
  const now = new Date();
  const exp = new Date(now);
  exp.setDate(exp.getDate() + durationDays);
  return {
    plan_tier: "full",
    access_state: "active",
    full_expires_at: exp.toISOString(),
    full_expire_action: "restrict",
    trial_expires_at: PAST_DATE,
    grace_finance_until: PAST_DATE,
    scheduled_deletion_at: PAST_DATE,
    restricted_at: null,
    deleted_at: null,
    updated_at: now.toISOString(),
  };
}

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) return null;

  const serviceClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: roleData } = await serviceClient
    .from("user_roles")
    .select("role")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleData) return null;
  return { userId: data.user.id, serviceClient };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeadersWithContentType(req);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = await verifyAdmin(req);
  if (!admin) return respond({ error: "Unauthorized" }, 401, corsHeaders);

  const { serviceClient: supabase, userId: adminId } = admin;

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    // ========== LIST USERS ==========
    if (action === "list") {
      const search = (body.search || "").toLowerCase();

      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const users = authData?.users || [];
      const userIds = users.map((u: any) => u.id);

      const [profilesRes, rolesRes, userSubsRes, householdMembersRes] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", userIds),
        supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
        supabase.from("user_subscriptions").select("*").in("user_id", userIds),
        supabase
          .from("household_members")
          .select("user_id, household_id, status, role")
          .in("user_id", userIds)
          .eq("role", "member")
          .in("status", ["active", "invited"]),
      ]);

      const profilesMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.user_id, p]));
      const rolesMap = Object.fromEntries((rolesRes.data || []).map((r: any) => [r.user_id, r.role]));
      const userSubsMap = Object.fromEntries((userSubsRes.data || []).map((s: any) => [s.user_id, s]));

      const householdMembers = householdMembersRes.data || [];
      const householdIds = [...new Set(householdMembers.map((m: any) => m.household_id).filter(Boolean))];

      let ownerByHousehold: Record<string, string> = {};
      let ownerSubsMap: Record<string, any> = {};
      let ownerNamesMap: Record<string, string> = {};

      if (householdIds.length > 0) {
        const { data: householdsData } = await supabase
          .from("households")
          .select("id, owner_id")
          .in("id", householdIds);

        ownerByHousehold = Object.fromEntries((householdsData || []).map((h: any) => [h.id, h.owner_id]));

        const ownerIds = [...new Set((householdsData || []).map((h: any) => h.owner_id).filter(Boolean))];
        if (ownerIds.length > 0) {
          const [ownerSubsRes, ownerProfilesRes] = await Promise.all([
            supabase.from("user_subscriptions").select("*").in("user_id", ownerIds),
            supabase.from("profiles").select("user_id, full_name").in("user_id", ownerIds),
          ]);
          ownerSubsMap = Object.fromEntries((ownerSubsRes.data || []).map((s: any) => [s.user_id, s]));
          ownerNamesMap = Object.fromEntries((ownerProfilesRes.data || []).map((p: any) => [p.user_id, p.full_name || "Titular"]));
        }
      }

      const householdMemberByUser = Object.fromEntries(householdMembers.map((m: any) => [m.user_id, m]));

      let enriched = users.map((u: any) => {
        const member = householdMemberByUser[u.id];
        const ownerId = member ? ownerByHousehold[member.household_id] : null;
        const inheritedSub = ownerId ? ownerSubsMap[ownerId] : null;
        const directSub = userSubsMap[u.id] || null;
        const effectiveSub = inheritedSub ? { ...inheritedSub, origin: "household_inherited" } : directSub;

        return {
          id: u.id,
          email: u.email || "—",
          full_name: profilesMap[u.id]?.full_name || u.user_metadata?.full_name || "—",
          role: rolesMap[u.id] || "user",
          user_subscription: effectiveSub,
          household_inheritance: inheritedSub
            ? {
                owner_id: ownerId,
                owner_name: ownerId ? ownerNamesMap[ownerId] || "Titular" : "Titular",
                member_status: member?.status || "active",
              }
            : null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
        };
      });

      if (search) {
        enriched = enriched.filter((u: any) =>
          u.email.toLowerCase().includes(search) || u.full_name.toLowerCase().includes(search)
        );
      }

      return respond({ users: enriched, total: users.length }, 200, corsHeaders);
    }

    // ========== METRICS ==========
    if (action === "metrics") {
      const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
      const totalUsers = authData?.users?.length || 0;
      const userIds = (authData?.users || []).map((u: any) => u.id);

      const { data: subs } = await supabase.from("user_subscriptions").select("plan_tier, access_state, origin, created_at").in("user_id", userIds);
      const subsList = subs || [];

      const active = subsList.filter((s: any) => s.plan_tier === "full" && s.access_state === "active").length;
      const trial = subsList.filter((s: any) => s.access_state === "trial").length;
      const grace = subsList.filter((s: any) => s.access_state === "grace").length;
      const blocked = subsList.filter((s: any) => s.access_state === "restricted").length;

      const now = new Date();
      const d7 = new Date(now); d7.setDate(d7.getDate() - 7);
      const d30 = new Date(now); d30.setDate(d30.getDate() - 30);
      const newLast7 = (authData?.users || []).filter((u: any) => new Date(u.created_at) >= d7).length;
      const newLast30 = (authData?.users || []).filter((u: any) => new Date(u.created_at) >= d30).length;

      const bySource: Record<string, number> = {};
      subsList.forEach((s: any) => { bySource[s.origin] = (bySource[s.origin] || 0) + 1; });

      return respond({ totalUsers, active, expired: 0, grace, blocked, trial, newLast7, newLast30, bySource }, 200, corsHeaders);
    }

    // ========== REVENUE DATA ==========
    if (action === "revenue_data") {
      const { data: subsData } = await supabase.from("user_subscriptions").select("plan_tier, access_state, origin, created_at, full_expires_at");
      return respond({ subs: subsData || [] }, 200, corsHeaders);
    }

    // ========== AUDIT LOGS ==========
    if (action === "logs") {
      const limit = body.limit || 200;
      const filterAction = body.filterAction || "";
      const filterUser = body.filterUser || "";

      let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit);
      if (filterAction) query = query.eq("action", filterAction);
      if (filterUser) query = query.eq("target_user_id", filterUser);

      const { data, error } = await query;
      if (error) return respond({ error: error.message }, 500, corsHeaders);
      return respond({ logs: data || [] }, 200, corsHeaders);
    }

    // ========== GET SUBSCRIPTION ==========
    if (action === "get_subscription") {
      const { targetUserId } = body;
      if (!targetUserId) return respond({ error: "Missing targetUserId" }, 400, corsHeaders);
      const { data } = await supabase.from("user_subscriptions").select("*").eq("user_id", targetUserId).maybeSingle();
      return respond({ subscription: data }, 200, corsHeaders);
    }

    // ========== ADMIN ACTIONS ==========
    const { targetUserId, actionType, payload } = body;
    if (!targetUserId || !actionType) return respond({ error: "Missing targetUserId or actionType" }, 400, corsHeaders);

    if (actionType === "activate") {
      const { data: curSub } = await supabase.from("user_subscriptions").select("*").eq("user_id", targetUserId).maybeSingle();
      const now = new Date();
      let fullExpiresAt: string;
      let auditAction = "admin_full_activated";

      if (curSub?.plan_tier === "full" && curSub?.full_expires_at) {
        const cur = new Date(curSub.full_expires_at);
        const base = cur > now ? cur : now;
        base.setDate(base.getDate() + 365);
        fullExpiresAt = base.toISOString();
        auditAction = "admin_full_renewed";
      } else {
        const exp = new Date(now); exp.setDate(exp.getDate() + 365);
        fullExpiresAt = exp.toISOString();
      }

      const activateData: Record<string, any> = {
        plan_tier: "full",
        access_state: "active",
        full_expires_at: fullExpiresAt,
        full_expire_action: "restrict",
        restricted_at: null,
        deleted_at: null,
        scheduled_deletion_at: PAST_DATE,
        trial_expires_at: PAST_DATE,
        grace_finance_until: PAST_DATE,
        updated_at: now.toISOString(),
      };

      if (curSub) {
        await supabase.from("user_subscriptions").update(activateData).eq("user_id", targetUserId);
      } else {
        await supabase.from("user_subscriptions").insert({ user_id: targetUserId, origin: "manual", ...activateData });
      }

      await supabase.from("audit_logs").insert({
        admin_id: adminId, action: auditAction, target_user_id: targetUserId,
        payload: {
          full_expires_at: fullExpiresAt,
          previous_state: curSub ? { plan_tier: curSub.plan_tier, access_state: curSub.access_state } : null,
        },
      });
      return respond({ success: true }, 200, corsHeaders);
    }

    if (actionType === "block") {
      await supabase.from("user_subscriptions").update({
        plan_tier: "free", access_state: "restricted",
        restricted_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }).eq("user_id", targetUserId);
      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_block", target_user_id: targetUserId, payload: {} });
      return respond({ success: true }, 200, corsHeaders);
    }

    if (actionType === "bonus") {
      const days = parseInt(payload?.days || "0");
      if (days <= 0) return respond({ error: "Invalid days" }, 400, corsHeaders);
      const { data: sub } = await supabase.from("user_subscriptions").select("*").eq("user_id", targetUserId).maybeSingle();
      if (!sub) return respond({ error: "No subscription found" }, 404, corsHeaders);

      if (sub.plan_tier === "full" && sub.full_expires_at) {
        const newEnd = new Date(sub.full_expires_at);
        newEnd.setDate(newEnd.getDate() + days);
        await supabase.from("user_subscriptions").update({
          full_expires_at: newEnd.toISOString(),
          bonus_days_full: (sub.bonus_days_full || 0) + days,
          updated_at: new Date().toISOString(),
        }).eq("user_id", targetUserId);
      } else if (sub.grace_finance_until) {
        const newGrace = new Date(sub.grace_finance_until);
        newGrace.setDate(newGrace.getDate() + days);
        await supabase.from("user_subscriptions").update({
          grace_finance_until: newGrace.toISOString(),
          bonus_days_grace: (sub.bonus_days_grace || 0) + days,
          updated_at: new Date().toISOString(),
        }).eq("user_id", targetUserId);
      }

      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_bonus", target_user_id: targetUserId, payload: { days } });
      return respond({ success: true }, 200, corsHeaders);
    }

    if (actionType === "reset_password") {
      const { data: userData } = await supabase.auth.admin.getUserById(targetUserId);
      if (!userData?.user?.email) return respond({ error: "User not found" }, 404, corsHeaders);
      const { error } = await supabase.auth.admin.generateLink({ type: "recovery", email: userData.user.email, options: { redirectTo: "https://app.useatlasapp.com/reset-password" } });
      if (error) return respond({ error: error.message }, 500, corsHeaders);
      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_reset_password", target_user_id: targetUserId, payload: {} });
      return respond({ success: true }, 200, corsHeaders);
    }

    if (actionType === "delete_user") {
      if (targetUserId === adminId) {
        return respond({ error: "Você não pode excluir sua própria conta de admin." }, 400, corsHeaders);
      }

      const userScopedTables = [
        "despesas", "receitas", "economias", "objetivos", "aportes_objetivos", "investimentos_financeiros",
        "aportes_investimentos", "investimentos_nao_financeiros", "aposentadoria", "cartoes_credito",
        "fechamentos_mensais", "meses_iniciados", "orcamentos_categorias", "pagamentos", "portfolio_snapshots",
        "profiles", "user_plans", "subscriptions", "user_subscriptions", "user_roles",
      ];

      const { data: targetAuthData, error: targetAuthErr } = await supabase.auth.admin.getUserById(targetUserId);
      if (targetAuthErr || !targetAuthData?.user) {
        return respond({ error: "Usuário não encontrado no Auth" }, 404, corsHeaders);
      }

      const targetEmail = targetAuthData.user.email?.toLowerCase() || null;

      const { data: ownedHouseholds } = await supabase
        .from("households")
        .select("id")
        .eq("owner_id", targetUserId);

      const ownedHouseholdIds = (ownedHouseholds || []).map((h: any) => h.id);

      // Invalidate active sessions (best effort — some Supabase versions don't support this)
      try {
        await supabase.auth.admin.signOut(targetUserId);
      } catch (_signOutErr) {
        console.warn("[delete_user] signOut skipped:", (_signOutErr as Error)?.message);
      }

      // Remove household memberships directly linked to this user
      const { error: memberDeleteErr } = await supabase
        .from("household_members")
        .delete()
        .eq("user_id", targetUserId);

      if (memberDeleteErr) {
        return respond({ error: `Falha ao limpar vínculos familiares: ${memberDeleteErr.message}` }, 500, corsHeaders);
      }

      // Invalidate pending invites by email to avoid stale reuse
      if (targetEmail) {
        const { error: inviteCleanupErr } = await supabase
          .from("household_members")
          .update({ status: "removed", updated_at: new Date().toISOString() })
          .eq("invited_email", targetEmail)
          .in("status", ["invited", "active"])
          .eq("role", "member");

        if (inviteCleanupErr) {
          return respond({ error: `Falha ao invalidar convites antigos: ${inviteCleanupErr.message}` }, 500, corsHeaders);
        }
      }

      // If user owns household(s), remove members and household records to prevent hybrid identity leftovers
      if (ownedHouseholdIds.length > 0) {
        const { error: ownedMembersErr } = await supabase
          .from("household_members")
          .delete()
          .in("household_id", ownedHouseholdIds);

        if (ownedMembersErr) {
          return respond({ error: `Falha ao limpar membros do household do usuário: ${ownedMembersErr.message}` }, 500, corsHeaders);
        }

        const { error: householdsDeleteErr } = await supabase
          .from("households")
          .delete()
          .in("id", ownedHouseholdIds);

        if (householdsDeleteErr) {
          return respond({ error: `Falha ao remover household do usuário: ${householdsDeleteErr.message}` }, 500, corsHeaders);
        }
      }

      for (const table of userScopedTables) {
        const { error: tableDeleteErr } = await supabase.from(table).delete().eq("user_id", targetUserId);
        if (tableDeleteErr) {
          console.warn(`[delete_user] Falha ao limpar ${table}: ${tableDeleteErr.message}`);
          // Continue cleanup — don't block on non-critical table errors
        }
      }

      const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(targetUserId);
      if (authDeleteErr) {
        return respond({ error: `Falha ao excluir usuário no Auth: ${authDeleteErr.message}` }, 500, corsHeaders);
      }

      await supabase.from("audit_logs").insert({
        admin_id: adminId,
        action: "admin_delete_user_lgpd",
        target_user_id: targetUserId,
        payload: {
          purged: true,
          removed_owned_households: ownedHouseholdIds.length,
        },
      });

      return respond({ success: true }, 200, corsHeaders);
    }

    if (actionType === "create_user") {
      const { email, full_name, phone, plan_type, duration_days, is_admin, signup_source } = payload || {};
      if (!email || !full_name) return respond({ error: "Email e nome são obrigatórios" }, 400, corsHeaders);

      console.log("[create_user] Starting:", { plan_type, duration_days, is_admin, signup_source });

      // Check existing user
      const { data: existingId, error: rpcError } = await supabase.rpc("find_user_id_by_email", { _email: email });
      if (rpcError) {
        console.error("[create_user] RPC error:", rpcError);
        return respond({ error: `Erro ao verificar email: ${rpcError.message}` }, 500, corsHeaders);
      }
      if (existingId) return respond({ error: "Já existe um usuário com este email." }, 409, corsHeaders);

      const throwawayPassword = generateThrowawayPassword();

      // Step 1: Create auth user
      console.log("[create_user] Creating auth user...");
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email,
        password: throwawayPassword,
        email_confirm: true,
        user_metadata: { full_name, phone: phone || "", must_change_password: true },
      });

      if (createError) {
        console.error("[create_user] Auth createUser error:", createError);
        return respond({ error: `Não foi possível criar o usuário: ${createError.message}` }, 500, corsHeaders);
      }

      if (!newUser?.user?.id) {
        console.error("[create_user] No user ID returned from createUser");
        return respond({ error: "Erro inesperado: auth não retornou o ID do usuário." }, 500, corsHeaders);
      }

      const userId = newUser.user.id;
      console.log("[create_user] Auth user created:", userId);

      try {
        // Step 2: Update profile (trigger already created it)
        const { error: profileErr } = await supabase.from("profiles").update({ full_name, phone: phone || "", must_change_password: true }).eq("user_id", userId);
        if (profileErr) console.warn("[create_user] Profile update warning:", profileErr.message);

        // Step 3: Update subscription based on plan_type
        const effectiveOrigin = signup_source || "manual";
        const now = new Date();
        const effectivePlanType = plan_type || "full";

        let subUpdate: Record<string, any> = { origin: effectiveOrigin, updated_at: now.toISOString() };

        if (effectivePlanType === "full") {
          const days = parseInt(duration_days || "365") || 365;
          subUpdate = { ...buildFullPayload(days), origin: effectiveOrigin };
        } else if (effectivePlanType === "trial") {
          // Keep defaults from trigger (trial state)
          subUpdate.access_state = "trial";
        } else if (effectivePlanType === "grace") {
          const graceEnd = new Date(now); graceEnd.setDate(graceEnd.getDate() + 21);
          subUpdate = {
            plan_tier: "free", access_state: "grace",
            trial_expires_at: PAST_DATE, grace_finance_until: graceEnd.toISOString(),
            origin: effectiveOrigin, updated_at: now.toISOString(),
          };
        } else if (effectivePlanType === "restricted") {
          subUpdate = {
            plan_tier: "free", access_state: "restricted",
            trial_expires_at: PAST_DATE, grace_finance_until: PAST_DATE,
            restricted_at: now.toISOString(), origin: effectiveOrigin, updated_at: now.toISOString(),
          };
        }

        const { error: subErr } = await supabase.from("user_subscriptions").update(subUpdate).eq("user_id", userId);
        if (subErr) console.warn("[create_user] Subscription update warning:", subErr.message);

        // Step 4: Handle admin role
        if (is_admin) {
          const { error: roleErr } = await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
          if (roleErr) console.warn("[create_user] Admin role insert warning:", roleErr.message);
        }
      } catch (postErr) {
        console.error("[create_user] Post-auth setup error:", postErr);
        // Auth user exists but auxiliary tables may be incomplete - don't delete, log for manual fix
      }

      await supabase.from("audit_logs").insert({
        admin_id: adminId,
        action: "admin_create_user",
        target_user_id: userId,
        payload: { plan_type: plan_type || "full", duration_days: duration_days || 365, is_admin: !!is_admin, signup_source: signup_source || "manual" },
      });

      // Generate invite token + send onboarding email
      let inviteUrl: string | null = null;
      let inviteEmailError: string | null = null;
      try {
        const tokenResult = await createInviteToken(supabase, {
          userId,
          email,
          source: "admin",
          createdBy: adminId,
          metadata: { full_name, plan_type, signup_source: signup_source || "admin_create" },
        });
        inviteUrl = tokenResult.url;

        const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "Walter Espindola - Atlas <noreply@walterespindola.com.br>",
              to: email,
              reply_to: "suporte@walterespindola.com.br",
              subject: `Convite para você usar o Atlas, ${full_name || email.split("@")[0]}`,
              html: buildInviteEmailHtml({
                acceptUrl: tokenResult.url,
                recipientName: full_name || email.split("@")[0],
                source: "admin",
              }),
              headers: {
                "List-Unsubscribe": "<mailto:suporte@walterespindola.com.br?subject=Unsubscribe>",
                "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
              },
            }),
          });
        }
      } catch (e) {
        console.error("[create_user] Invite email error:", e);
        inviteEmailError = e instanceof Error ? e.message : String(e);
      }

      console.log("[create_user] Success:", userId);
      return respond(
        {
          success: true,
          userId,
          invite_link: inviteUrl,
          invite_email_error: inviteEmailError,
          message: "Usuário criado. Email de ativação enviado — link válido por 72 horas.",
        },
        200,
        corsHeaders,
      );
    }

    // ========== UPDATE SUBSCRIPTION ==========
    if (actionType === "update_subscription") {
      const { plan_tier, access_state, trial_expires_at, grace_finance_until, scheduled_deletion_at, origin: newOrigin, full_expires_at, full_expire_action } = payload || {};

      const { data: currentSub } = await supabase.from("user_subscriptions").select("*").eq("user_id", targetUserId).maybeSingle();

      const updateData: any = { updated_at: new Date().toISOString() };
      if (plan_tier !== undefined) updateData.plan_tier = plan_tier;
      if (access_state !== undefined) updateData.access_state = access_state;
      if (trial_expires_at !== undefined) updateData.trial_expires_at = trial_expires_at || PAST_DATE;
      if (grace_finance_until !== undefined) updateData.grace_finance_until = grace_finance_until || PAST_DATE;
      if (scheduled_deletion_at !== undefined) updateData.scheduled_deletion_at = scheduled_deletion_at || PAST_DATE;
      if (newOrigin !== undefined) updateData.origin = newOrigin;
      if (full_expires_at !== undefined) updateData.full_expires_at = full_expires_at;
      if (full_expire_action !== undefined) updateData.full_expire_action = full_expire_action;

      // When switching to FULL, clear trial/grace fields
      if (plan_tier === "full" && access_state === "active") {
        updateData.trial_expires_at = updateData.trial_expires_at || PAST_DATE;
        updateData.grace_finance_until = updateData.grace_finance_until || PAST_DATE;
        updateData.scheduled_deletion_at = PAST_DATE;
        updateData.restricted_at = null;
        updateData.deleted_at = null;
      }

      if (currentSub) {
        await supabase.from("user_subscriptions").update(updateData).eq("user_id", targetUserId);
      } else {
        await supabase.from("user_subscriptions").insert({ user_id: targetUserId, ...updateData });
      }

      const auditAction = (full_expires_at && currentSub?.full_expires_at && full_expires_at !== currentSub.full_expires_at)
        ? "admin_full_date_updated"
        : "admin_update_subscription";

      await supabase.from("audit_logs").insert({
        admin_id: adminId,
        action: auditAction,
        target_user_id: targetUserId,
        payload: { before: currentSub ? { plan_tier: currentSub.plan_tier, access_state: currentSub.access_state, full_expires_at: currentSub.full_expires_at } : null, after: updateData },
      });

      return respond({ success: true }, 200, corsHeaders);
    }

    // ========== QUICK ACTIONS ==========
    if (actionType === "quick_trial") {
      const now = new Date();
      const trialEnd = new Date(now); trialEnd.setDate(trialEnd.getDate() + 7);
      const graceEnd = new Date(now); graceEnd.setDate(graceEnd.getDate() + 28);
      const deletionAt = new Date(now); deletionAt.setDate(deletionAt.getDate() + 88);

      const updateData = {
        plan_tier: "free",
        access_state: "trial",
        trial_started_at: now.toISOString(),
        trial_expires_at: trialEnd.toISOString(),
        grace_finance_until: graceEnd.toISOString(),
        scheduled_deletion_at: deletionAt.toISOString(),
        full_expires_at: null,
        updated_at: now.toISOString(),
      };

      const { data: exists } = await supabase.from("user_subscriptions").select("id").eq("user_id", targetUserId).maybeSingle();
      if (exists) {
        await supabase.from("user_subscriptions").update(updateData).eq("user_id", targetUserId);
      } else {
        await supabase.from("user_subscriptions").insert({ user_id: targetUserId, origin: "manual", ...updateData });
      }

      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_quick_trial", target_user_id: targetUserId, payload: updateData });
      return respond({ success: true }, 200, corsHeaders);
    }

    if (actionType === "quick_grace") {
      const now = new Date();
      const graceEnd = new Date(now); graceEnd.setDate(graceEnd.getDate() + 21);
      const deletionAt = new Date(now); deletionAt.setDate(deletionAt.getDate() + 81);

      const updateData = {
        plan_tier: "free",
        access_state: "grace",
        trial_expires_at: PAST_DATE,
        grace_finance_until: graceEnd.toISOString(),
        scheduled_deletion_at: deletionAt.toISOString(),
        full_expires_at: null,
        updated_at: now.toISOString(),
      };

      const { data: exists } = await supabase.from("user_subscriptions").select("id").eq("user_id", targetUserId).maybeSingle();
      if (exists) {
        await supabase.from("user_subscriptions").update(updateData).eq("user_id", targetUserId);
      } else {
        await supabase.from("user_subscriptions").insert({ user_id: targetUserId, origin: "manual", ...updateData });
      }

      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_quick_grace", target_user_id: targetUserId, payload: updateData });
      return respond({ success: true }, 200, corsHeaders);
    }

    if (actionType === "quick_restrict") {
      const now = new Date();
      const deletionAt = new Date(now); deletionAt.setDate(deletionAt.getDate() + 60);

      const updateData = {
        plan_tier: "free",
        access_state: "restricted",
        trial_expires_at: PAST_DATE,
        grace_finance_until: PAST_DATE,
        restricted_at: now.toISOString(),
        scheduled_deletion_at: deletionAt.toISOString(),
        full_expires_at: null,
        updated_at: now.toISOString(),
      };

      const { data: exists } = await supabase.from("user_subscriptions").select("id").eq("user_id", targetUserId).maybeSingle();
      if (exists) {
        await supabase.from("user_subscriptions").update(updateData).eq("user_id", targetUserId);
      } else {
        await supabase.from("user_subscriptions").insert({ user_id: targetUserId, origin: "manual", ...updateData });
      }

      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_quick_restrict", target_user_id: targetUserId, payload: updateData });
      return respond({ success: true }, 200, corsHeaders);
    }

    // ========== FORCE SIGNOUT ==========
    if (actionType === "force_signout") {
      const { error } = await supabase.auth.admin.signOut(targetUserId);
      if (error) return respond({ error: error.message }, 500, corsHeaders);
      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_force_signout", target_user_id: targetUserId, payload: {} });
      return respond({ success: true }, 200, corsHeaders);
    }

    // ========== SET TEMP PASSWORD ==========
    if (actionType === "set_temp_password") {
      const newPassword = generateRandomPassword(16);
      const { data: authUserData, error: getUserErr } = await supabase.auth.admin.getUserById(targetUserId);
      if (getUserErr || !authUserData?.user) return respond({ error: "User not found" }, 404, corsHeaders);

      const { error } = await supabase.auth.admin.updateUserById(targetUserId, {
        password: newPassword,
        user_metadata: {
          ...(authUserData.user.user_metadata || {}),
          must_change_password: true,
          signup_source: authUserData.user.user_metadata?.signup_source || "manual",
        },
      });
      if (error) return respond({ error: error.message }, 500, corsHeaders);

      await supabase.from("profiles").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("user_id", targetUserId);
      await supabase.from("user_subscriptions").update({ must_change_password: true, updated_at: new Date().toISOString() }).eq("user_id", targetUserId);

      // Force logout so old password/session cannot continue in parallel
      await supabase.auth.admin.signOut(targetUserId);

      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_set_temp_password", target_user_id: targetUserId, payload: {} });
      return respond({ success: true, message: "Senha temporária definida. O usuário deverá trocá-la no próximo login." }, 200, corsHeaders);
    }

    // ========== TOGGLE ADMIN ROLE ==========
    if (actionType === "toggle_admin") {
      // Prevent self-demotion
      if (targetUserId === adminId) {
        return respond({ error: "Você não pode remover seu próprio acesso de admin." }, 400, corsHeaders);
      }

      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id, role")
        .eq("user_id", targetUserId)
        .eq("role", "admin")
        .maybeSingle();

      if (existingRole) {
        // Check if there's at least 1 other admin remaining
        const { count } = await supabase
          .from("user_roles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin");

        if ((count || 0) <= 1) {
          return respond({ error: "É necessário pelo menos 1 admin no sistema." }, 400, corsHeaders);
        }

        // Remove admin role
        await supabase.from("user_roles").delete().eq("id", existingRole.id);
        await supabase.from("audit_logs").insert({
          admin_id: adminId, action: "admin_revoke_admin", target_user_id: targetUserId, payload: {},
        });
        return respond({ success: true, newRole: "user" }, 200, corsHeaders);
      } else {
        // Add admin role
        await supabase.from("user_roles").insert({ user_id: targetUserId, role: "admin" });
        await supabase.from("audit_logs").insert({
          admin_id: adminId, action: "admin_grant_admin", target_user_id: targetUserId, payload: {},
        });
        return respond({ success: true, newRole: "admin" }, 200, corsHeaders);
      }
    }

    // ========== UPDATE SIGNUP SOURCE ==========
    if (actionType === "update_signup_source") {
      const { signup_source } = payload || {};
      if (!signup_source) return respond({ error: "Missing signup_source" }, 400, corsHeaders);
      
      await supabase.from("user_subscriptions").update({ origin: signup_source, updated_at: new Date().toISOString() }).eq("user_id", targetUserId);
      await supabase.from("audit_logs").insert({ admin_id: adminId, action: "admin_update_signup_source", target_user_id: targetUserId, payload: { signup_source } });
      return respond({ success: true }, 200, corsHeaders);
    }

    // ========== GET USER PLAN ==========
    if (actionType === "get_user_plan") {
      const { data: up } = await supabase.from("user_plans").select("id, plan_id, assigned_by_admin, assigned_at, expires_at").eq("user_id", targetUserId).eq("active", true).maybeSingle();
      const { data: plans } = await supabase.from("plans").select("id, name, slug");
      return respond({ userPlan: up, plans: plans || [] }, 200, corsHeaders);
    }

    // ========== UPDATE USER PLAN ==========
    if (actionType === "update_user_plan") {
      const { plan_id, expires_at: planExpiresAt } = payload || {};
      if (!plan_id) return respond({ error: "Missing plan_id" }, 400, corsHeaders);

      const { data: existing } = await supabase.from("user_plans").select("id").eq("user_id", targetUserId).eq("active", true).maybeSingle();

      const planData = {
        plan_id,
        assigned_by_admin: true,
        assigned_at: new Date().toISOString(),
        expires_at: planExpiresAt || null,
      };

      if (existing) {
        await supabase.from("user_plans").update(planData).eq("id", existing.id);
      } else {
        await supabase.from("user_plans").insert({ user_id: targetUserId, tier: "organiza_2026", active: true, ...planData });
      }

      await supabase.from("audit_logs").insert({
        admin_id: adminId, action: "admin_update_user_plan", target_user_id: targetUserId,
        payload: { plan_id, expires_at: planExpiresAt || null },
      });
      return respond({ success: true }, 200, corsHeaders);
    }

    return respond({ error: "Unknown action" }, 400, corsHeaders);
  } catch (e: any) {
    console.error("[admin-users] Error:", e?.message);
    return respond({ error: "Internal server error" }, 500, corsHeaders);
  }
});
