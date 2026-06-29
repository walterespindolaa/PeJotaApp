// PeJota — Webhook PlugNotas: atualiza status/PDF/XML da NFS-e quando concluída.
// Configure a URL no painel PlugNotas. Identifica a nota pelo id (provider_id).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const evt = await req.json();
    // PlugNotas envia o documento (ou lista). Normaliza:
    const docs = Array.isArray(evt) ? evt : (evt?.documents || evt?.data || [evt]);
    for (const doc of docs) {
      const providerId = doc?.id || doc?.idIntegracao;
      if (!providerId) continue;
      const situacao = (doc?.situacao || doc?.status || "").toString().toUpperCase();
      const concluido = ["CONCLUIDO", "AUTORIZADO", "EMITIDO"].some(s => situacao.includes(s));
      const erro = ["REJEITADO", "ERRO"].some(s => situacao.includes(s));
      const cancelado = situacao.includes("CANCELAD");
      await admin.from("business_invoices").update({
        status: cancelado ? "cancelado" : concluido ? "concluido" : erro ? "erro" : "processando",
        numero: doc?.numeroNfse || doc?.numero || null,
        pdf_url: doc?.pdf || doc?.linkPdf || null,
        xml_url: doc?.xml || doc?.linkXml || null,
        erro: erro ? (doc?.mensagem || doc?.motivo || "Rejeitada") : null,
        updated_at: new Date().toISOString(),
      }).eq("provider_id", providerId);
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500 });
  }
});
