/* PeJota — geração das contas recorrentes do mês (idempotente).
   Para cada modelo ativo do tipo, gera a conta do mês atual se ainda não existir
   (dedup por recurring_id + vencimento dentro do mês). Não duplica entre devices. */
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;
const pad = (n: number) => String(n).padStart(2, "0");

export async function ensureRecurringBills(companyId: string, kind: "receber" | "pagar"): Promise<number> {
  const now = new Date();
  const ym = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const { data: temps } = await db
    .from("business_recurring_bills").select("*")
    .eq("company_id", companyId).eq("kind", kind).eq("active", true);
  if (!temps || temps.length === 0) return 0;

  const ids = temps.map((t: any) => t.id);
  const { data: existing } = await db
    .from("business_bills").select("recurring_id")
    .eq("company_id", companyId).in("recurring_id", ids)
    .gte("due_date", `${ym}-01`).lte("due_date", `${ym}-31`);
  const done = new Set((existing || []).map((b: any) => b.recurring_id));

  const toInsert = temps
    .filter((t: any) => !done.has(t.id))
    .map((t: any) => ({
      company_id: companyId, user_id: t.user_id, kind,
      description: t.description, amount: t.amount,
      due_date: `${ym}-${pad(Math.min(28, Math.max(1, t.day_of_month || 5)))}`,
      status: "pendente", payer_name: t.payer_name || null, recurring_id: t.id,
    }));
  if (toInsert.length) await db.from("business_bills").insert(toInsert);
  return toInsert.length;
}
