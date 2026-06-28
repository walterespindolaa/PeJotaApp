// PeJota — Gera cobrança Asaas (boleto/PIX) usando a conta da PRÓPRIA empresa.
// A chave Asaas nunca chega ao navegador: é lida aqui (service_role) a partir
// de company_integrations. O usuário precisa ser membro (owner/editor) da empresa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

const asaasBase = (env: string) =>
  env === "prod" ? "https://api.asaas.com/v3" : "https://api-sandbox.asaas.com/v3";

async function asaas(path: string, key: string, env: string, init?: RequestInit) {
  const res = await fetch(`${asaasBase(env)}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", access_token: key, ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.errors?.[0]?.description || body?.message || `Asaas ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabaseUser.auth.getClaims(token);
    if (cErr || !claims?.claims?.sub) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { bill_id, billingType = "UNDEFINED", payer } = await req.json();
    if (!bill_id) return new Response(JSON.stringify({ error: "bill_id obrigatório" }), { status: 400, headers });

    // 1) Carrega a conta e a empresa
    const { data: bill } = await admin.from("business_bills").select("*").eq("id", bill_id).single();
    if (!bill) return new Response(JSON.stringify({ error: "Conta não encontrada" }), { status: 404, headers });
    if (bill.kind !== "receber") return new Response(JSON.stringify({ error: "Só geramos cobrança para contas a receber" }), { status: 400, headers });

    // 2) Verifica que o usuário pode gerenciar a empresa
    const { data: canManage } = await admin.rpc("can_manage_company", { p_company_id: bill.company_id });
    // can_manage_company usa auth.uid(); via service_role auth.uid() é null, então checamos manualmente:
    const { data: member } = await admin.from("company_members").select("role").eq("company_id", bill.company_id).eq("user_id", userId).maybeSingle();
    const { data: company } = await admin.from("companies").select("user_id").eq("id", bill.company_id).single();
    const allowed = company?.user_id === userId || (member && ["owner", "editor"].includes(member.role));
    if (!allowed && !canManage) return new Response(JSON.stringify({ error: "Sem permissão nesta empresa" }), { status: 403, headers });

    // 3) Credenciais Asaas da empresa
    const { data: integ } = await admin.from("company_integrations").select("asaas_api_key, asaas_env").eq("company_id", bill.company_id).maybeSingle();
    if (!integ?.asaas_api_key) return new Response(JSON.stringify({ error: "asaas_nao_configurado" }), { status: 400, headers });
    const key = integ.asaas_api_key as string;
    const env = (integ.asaas_env as string) || "sandbox";

    // 4) Garante o cliente Asaas
    const name = payer?.name || bill.payer_name;
    const cpfCnpj = (payer?.cpfCnpj || bill.payer_doc || "").replace(/\D/g, "");
    if (!name || !cpfCnpj) return new Response(JSON.stringify({ error: "Informe nome e CPF/CNPJ do pagador" }), { status: 400, headers });

    let customerId = bill.asaas_customer_id as string | null;
    if (!customerId) {
      const cust = await asaas("/customers", key, env, {
        method: "POST",
        body: JSON.stringify({ name, cpfCnpj, email: payer?.email || bill.payer_email || undefined, mobilePhone: (payer?.phone || bill.payer_phone || "").replace(/\D/g, "") || undefined }),
      });
      customerId = cust.id;
    }

    // 5) Cria a cobrança
    const dueDate = bill.due_date || new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
    const charge = await asaas("/payments", key, env, {
      method: "POST",
      body: JSON.stringify({
        customer: customerId,
        billingType, // BOLETO | PIX | UNDEFINED | CREDIT_CARD
        value: Number(bill.amount),
        dueDate,
        description: bill.description,
        externalReference: bill_id,
      }),
    });

    // 6) Se PIX, busca o copia-e-cola + QR
    let pixPayload: string | null = null, pixImage: string | null = null;
    if (billingType === "PIX" || billingType === "UNDEFINED") {
      try {
        const pix = await asaas(`/payments/${charge.id}/pixQrCode`, key, env);
        pixPayload = pix.payload ?? null;
        pixImage = pix.encodedImage ?? null;
      } catch (_) { /* boleto-only não tem PIX */ }
    }

    // 7) Persiste na conta
    await admin.from("business_bills").update({
      payer_name: name, payer_doc: cpfCnpj, payer_email: payer?.email || bill.payer_email, payer_phone: payer?.phone || bill.payer_phone,
      asaas_customer_id: customerId, asaas_charge_id: charge.id,
      asaas_invoice_url: charge.invoiceUrl ?? null, asaas_bank_slip_url: charge.bankSlipUrl ?? null,
      asaas_pix_payload: pixPayload, asaas_pix_image: pixImage, asaas_status: charge.status ?? "PENDING",
      updated_at: new Date().toISOString(),
    }).eq("id", bill_id);

    return new Response(JSON.stringify({
      ok: true, chargeId: charge.id, status: charge.status,
      invoiceUrl: charge.invoiceUrl, bankSlipUrl: charge.bankSlipUrl, pixPayload, pixImage,
    }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers });
  }
});
