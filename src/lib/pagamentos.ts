import { supabase } from "@/integrations/supabase/client";
import { logError } from "@/lib/log";

/**
 * Upsert na tabela "pagamentos" — fonte de verdade do status mensal
 * de receitas/despesas/parcelas. Espelha status nas tabelas-fonte
 * (receitas/despesas) quando aplicável.
 *
 * Usado por useOrganiza e Calendario pra manter consistência.
 */
export async function upsertPagamentoMensal(params: {
  userId: string;
  refType: "ganho" | "despesa" | "parcela";
  refId: string;        // pode ser virtual_xxx
  mesAno: string;       // YYYY-MM
  status: string;       // "pago" | "a_pagar" | "recebido" | "a_receber"
}): Promise<{ error: Error | null }> {
  const { userId, refType, refId, mesAno, status } = params;

  // Sempre usar UUID real, nunca virtual
  const realId = refId.startsWith("virtual_")
    ? refId.replace(/^virtual_(parc_)?/, "").split("_").filter((part) => {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(part);
      })[0] || refId
    : refId;

  const pagoEm = (status === "pago" || status === "recebido")
    ? new Date().toISOString().split("T")[0]
    : null;

  const { error: pagError } = await supabase.from("pagamentos").upsert(
    {
      user_id: userId,
      ref_type: refType,
      ref_id: realId,
      mes: mesAno,
      status,
      pago_em: pagoEm,
    } as any,
    { onConflict: "user_id,ref_type,ref_id,mes" }
  );

  if (pagError) {
    logError("[upsertPagamentoMensal] pagamentos upsert failed:", pagError, { refType, realId, mesAno });
    return { error: pagError as any };
  }

  // Espelhar status na tabela-fonte (exceto parcelas — têm fonte própria)
  if (!refId.startsWith("virtual_") && refType !== "parcela") {
    if (refType === "ganho") {
      await supabase.from("receitas").update({ status } as any).eq("id", realId);
    } else if (refType === "despesa") {
      await supabase.from("despesas").update({ status } as any).eq("id", realId);
    }
  }

  return { error: null };
}
