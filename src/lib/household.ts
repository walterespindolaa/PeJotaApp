import { supabase } from "@/integrations/supabase/client";

/**
 * Returns all user_ids that belong to the same household as the given user.
 * Includes the owner and all active/invited members.
 * Returns [userId] if the user has no household (solo user).
 *
 * Mirror do helper supabase/functions/_shared/household.ts (Deno-side).
 * Mantenha as 2 implementações em sync.
 */
export async function getHouseholdUserIds(userId: string): Promise<string[]> {
  // Try to find household via membership first
  const { data: membership } = await supabase
    .from("household_members")
    .select("household_id")
    .eq("user_id", userId)
    .in("status", ["active", "invited"])
    .maybeSingle();

  let householdId: string | null = (membership as any)?.household_id || null;

  // Fallback: user might be the owner directly
  if (!householdId) {
    const { data: owned } = await supabase
      .from("households")
      .select("id")
      .eq("owner_id", userId)
      .maybeSingle();
    householdId = (owned as any)?.id || null;
  }

  if (!householdId) return [userId];

  const ids = new Set<string>([userId]);

  const { data: members } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .in("status", ["active", "invited"]);
  (members || []).forEach((m: any) => {
    if (m.user_id) ids.add(m.user_id);
  });

  const { data: hh } = await supabase
    .from("households")
    .select("owner_id")
    .eq("id", householdId)
    .maybeSingle();
  if ((hh as any)?.owner_id) ids.add((hh as any).owner_id);

  return Array.from(ids);
}
