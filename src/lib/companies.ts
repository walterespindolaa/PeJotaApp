import { supabase } from "@/integrations/supabase/client";
import { getHouseholdUserIds } from "@/lib/household";

export type CompanyWithAggregatedTx = {
  id: string;
  name: string;
  business_type: string | null;
  currency: string | null;
  receita: number;
  despesa: number;
  resultado: number;
};

/**
 * Busca todas as empresas não-arquivadas do usuário + agrega
 * business_transactions do período em receita/despesa/resultado.
 * Substitui o pattern legado de .limit(1).maybeSingle() em companies.
 */
export async function fetchActiveCompaniesWithTx(
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<CompanyWithAggregatedTx[]> {
  const householdUserIds = await getHouseholdUserIds(userId);
  const { data: companiesData } = await supabase
    .from("companies")
    .select("id,name,business_type,currency")
    .in("user_id", householdUserIds)
    .eq("archived", false);

  const companies = (companiesData || []) as any[];
  if (companies.length === 0) return [];

  const companyIds = companies.map((c) => c.id);

  const { data: txData } = await supabase
    .from("business_transactions")
    .select("company_id,direction,amount,date")
    .in("company_id", companyIds)
    .gte("date", periodStart)
    .lte("date", periodEnd);

  const txs = (txData || []) as any[];

  return companies.map((c) => {
    const companyTx = txs.filter((t) => t.company_id === c.id);
    const receita = companyTx
      .filter((t) => t.direction === "in")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const despesa = companyTx
      .filter((t) => t.direction === "out")
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    return {
      id: c.id,
      name: c.name,
      business_type: c.business_type,
      currency: c.currency,
      receita,
      despesa,
      resultado: receita - despesa,
    };
  });
}

/**
 * Versão simplificada — só lista empresas ativas, sem agregação.
 */
export async function fetchActiveCompanies(userId: string) {
  const householdUserIds = await getHouseholdUserIds(userId);
  const { data } = await supabase
    .from("companies")
    .select("id,name,business_type,currency")
    .in("user_id", householdUserIds)
    .eq("archived", false);
  return (data || []) as Array<{
    id: string;
    name: string;
    business_type: string | null;
    currency: string | null;
  }>;
}

/**
 * Busca lista raw de business_transactions de TODAS as empresas
 * não-arquivadas do usuário, opcionalmente filtrada por período.
 *
 * Preserva granularidade dia-a-dia + contagem de transações.
 * Usado por useAtlasScore (que precisa de mesesNeg.size) e
 * DashboardHome (que tem gate length >= 10).
 *
 * Substitui o pattern legado de .limit(1) em companies.
 */
export async function fetchAllCompaniesTransactions(
  userId: string,
  periodStart?: string,
  periodEnd?: string
): Promise<Array<{
  direction: string;
  amount: number;
  date: string;
  company_id: string;
}>> {
  const householdUserIds = await getHouseholdUserIds(userId);
  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .in("user_id", householdUserIds)
    .eq("archived", false);

  const ids = (companies || []).map((c: any) => c.id);
  if (ids.length === 0) return [];

  let q = supabase
    .from("business_transactions")
    .select("direction,amount,date,company_id")
    .in("company_id", ids);

  if (periodStart) q = q.gte("date", periodStart);
  if (periodEnd) q = q.lte("date", periodEnd);

  const { data } = await q;
  return (data || []) as any;
}
