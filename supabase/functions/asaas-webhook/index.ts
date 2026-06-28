// PeJota — Webhook Asaas: confirma pagamento e lança no caixa automaticamente.
// Cada empresa cadastra no painel Asaas a URL desta função + o token gerado
// (get_asaas_status.webhook_token). O Asaas envia o header `asaas-access-token`;
// achamos a empresa por esse token e atualizamos a conta correspondente.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RECEBIDO = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED_IN_CASH"]);
const ESTORNO = new Set(["PAYMENT_REFUNDED", "PAYMENT_DELETED", "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_REVERSED"]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("asaas-access-token") || "";
    const evt = await req.json();
    const event = evt?.event as string;
    const payment = evt?.payment;
    if (!event || !payment) return new Response(JSON.stringify({ ok: true }), { status: 200 });

    // Identifica a empresa pelo token do webhook (segredo por empresa)
    const { data: integ } = await admin.from("company_integrations").select("company_id, asaas_webhook_token").eq("asaas_webhook_token", token).maybeSingle();
    if (!integ?.company_id || !token) return new Response(JSON.stringify({ error: "token inválido" }), { status: 401 });

    // Acha a conta pela cobrança (externalReference = bill_id, ou pelo id da cobrança)
    const billId = payment.externalReference as string | undefined;
    let q = admin.from("business_bills").select("*").eq("company_id", integ.company_id);
    const { data: bill } = await (billId ? q.eq("id", billId) : q.eq("asaas_charge_id", payment.id)).maybeSingle();
    if (!bill) return new Response(JSON.stringify({ ok: true, note: "conta não encontrada" }), { status: 200 });

    if (RECEBIDO.has(event)) {
      if (bill.status !== "liquidado") {
        const { data: tx } = await admin.from("business_transactions").insert({
          company_id: bill.company_id, user_id: bill.user_id, date: new Date().toISOString().slice(0, 10),
          description: `Recebimento (Asaas): ${bill.description}`, amount: bill.amount, direction: "in", source: "asaas",
        }).select("id").single();
        await admin.from("business_bills").update({ status: "liquidado", paid_date: new Date().toISOString().slice(0, 10), asaas_status: payment.status, tx_id: tx?.id }).eq("id", bill.id);
      }
    } else if (ESTORNO.has(event)) {
      if (bill.tx_id) await admin.from("business_transactions").delete().eq("id", bill.tx_id);
      await admin.from("business_bills").update({ status: "pendente", paid_date: null, tx_id: null, asaas_status: payment.status }).eq("id", bill.id);
    } else {
      await admin.from("business_bills").update({ asaas_status: payment.status }).eq("id", bill.id);
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500 });
  }
});
