import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logError } from "@/lib/log";

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string | null;
  role: "owner" | "member";
  status: "active" | "invited" | "removed";
  invited_email: string | null;
  display_name: string | null;
  invited_at: string | null;
  joined_at: string | null;
}

export interface Household {
  id: string;
  name: string;
  owner_id: string;
}

export interface InviteResult {
  success?: boolean;
  status?: "email_already_exists";
  member_user_id?: string;
  is_new_user?: boolean;
  invite_link_sent?: boolean;
  email_error?: string | null;
  error?: string;
}

export const useHousehold = () => {
  const { user, session } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [members, setMembers] = useState<HouseholdMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [membershipStatus, setMembershipStatus] = useState<"active" | "invited" | null>(null);

  const loadMembers = useCallback(async (householdId: string) => {
    const { data: membersData } = await supabase
      .from("household_members")
      .select("*")
      .eq("household_id", householdId)
      .neq("status", "removed")
      .order("role", { ascending: true })
      .order("created_at", { ascending: true });

    setMembers((membersData as any[]) || []);
  }, []);

  const fetchHousehold = useCallback(async () => {
    if (!user) {
      setHousehold(null);
      setMembers([]);
      setMembershipStatus(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Keep membership status fresh and auto-activate invited member on first authenticated access
    const { error: resolveErr } = await supabase.rpc("resolve_effective_plan_user_id");
    if (resolveErr) {
      logError("[useHousehold] resolve_effective_plan_user_id error:", resolveErr.message);
    }

    // IMPORTANT: prioritize invited/member context over owned context to avoid hybrid identity
    const { data: membership } = await supabase
      .from("household_members")
      .select("household_id, status")
      .eq("user_id", user.id)
      .eq("role", "member")
      .in("status", ["active", "invited"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if ((membership as any)?.household_id) {
      setMembershipStatus(((membership as any).status || "active") as "active" | "invited");

      const { data: h } = await supabase
        .from("households")
        .select("*")
        .eq("id", (membership as any).household_id)
        .maybeSingle();

      if (h) {
        setHousehold(h as any);
        await loadMembers((h as any).id);
        setLoading(false);
        return;
      }
    }

    setMembershipStatus(null);

    // Fallback: household owned by user
    const { data: owned } = await supabase
      .from("households")
      .select("*")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (owned) {
      setHousehold(owned as any);
      await loadMembers((owned as any).id);
    } else {
      setHousehold(null);
      setMembers([]);
    }

    setLoading(false);
  }, [user, loadMembers]);

  useEffect(() => {
    fetchHousehold();
  }, [fetchHousehold]);

  const createHousehold = useCallback(async (name: string) => {
    if (!user) return;

    // Prevent creating a standalone household when user is currently a member in another household
    const { data: existingMembership } = await supabase
      .from("household_members")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "member")
      .in("status", ["active", "invited"])
      .maybeSingle();

    if (existingMembership) {
      throw new Error("Usuário convidado não pode criar household próprio enquanto estiver vinculado como membro.");
    }

    const { data, error } = await supabase
      .from("households")
      .insert({ owner_id: user.id, name } as any)
      .select()
      .single();

    if (error) throw error;

    // Add self as owner member
    await supabase.from("household_members").insert({
      household_id: (data as any).id,
      user_id: user.id,
      role: "owner",
      status: "active",
      display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Titular",
      joined_at: new Date().toISOString(),
    } as any);

    await fetchHousehold();
    return data;
  }, [user, fetchHousehold]);

  const inviteMember = useCallback(async (email: string, displayName: string): Promise<InviteResult> => {
    if (!household || !session) throw new Error("Sem household ou sessão");

    const res = await supabase.functions.invoke<InviteResult>("household-invite", {
      body: {
        action: "invite",
        household_id: household.id,
        email,
        display_name: displayName,
      },
    });

    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error);

    await fetchHousehold();
    return res.data ?? {};
  }, [household, session, fetchHousehold]);

  const removeMember = useCallback(async (memberId: string) => {
    if (!household || !session) throw new Error("Sem household ou sessão");

    const res = await supabase.functions.invoke("household-invite", {
      body: {
        action: "remove",
        household_id: household.id,
        member_id: memberId,
      },
    });

    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error);

    await fetchHousehold();
  }, [household, session, fetchHousehold]);

  const resendInvite = useCallback(async (memberId: string) => {
    if (!household || !session) throw new Error("Sem household ou sessão");

    const res = await supabase.functions.invoke("household-invite", {
      body: {
        action: "resend",
        household_id: household.id,
        member_id: memberId,
      },
    });

    if (res.error) throw new Error(res.error.message);
    if (res.data?.error) throw new Error(res.data.error);

    await fetchHousehold();
  }, [household, session, fetchHousehold]);

  const isOwner = household?.owner_id === user?.id;
  const isMember = !!membershipStatus;

  return {
    household,
    members,
    loading,
    isOwner,
    isMember,
    membershipStatus,
    createHousehold,
    inviteMember,
    removeMember,
    resendInvite,
    refetch: fetchHousehold,
  };
};
