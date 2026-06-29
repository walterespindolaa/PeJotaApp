// PeJota — Emite NFS-e pelo PlugNotas (e sincroniza status/PDF/XML).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { plug, corsHeaders } from "../_shared/plugnotas.ts";

Deno.serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: cErr } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const userId = claims.claims.sub as string;

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { company_id, action, tomador, valor, descricao, bill_id } = await req.json();
    if (!company_id) return new Response(JSON.stringify({ error: "company_id obrigatório" }), { status: 400, headers });

    const { data: member } = await admin.from("company_members").select("role").eq("company_id", company_id).eq("user_id", userId).maybeSingle();
    const { data: company } = await admin.from("companies").select("user_id, name, cnpj, email").eq("id", company_id).single();
    const allowed = company?.user_id === userId || (member && ["owner", "editor"].includes(member.role));
    if (!allowed) return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers });

    const { data: integ } = await admin.from("company_integrations").select("plugnotas_token, plugnotas_env, nfse_settings, nfse_emitente_ok").eq("company_id", company_id).maybeSingle();
    if (!integ?.plugnotas_token) return new Response(JSON.stringify({ error: "nfse_nao_configurado" }), { status: 400, headers });
    const token = integ.plugnotas_token as string;
    const env = (integ.plugnotas_env as string) || "sandbox";
    const cfg = integ.nfse_settings || {};

    // ── Sincroniza notas em processamento ──
    if (action === "sync") {
      const { data: pend } = await admin.from("business_invoices").select("id, provider_id").eq("company_id", company_id).eq("status", "processando").not("provider_id", "is", null).limit(50);
      for (const n of pend || []) {
        try {
          const r = await plug(`/nfse/${n.provider_id}`, token, env);
          const doc = r?.data || r;
          const situacao = (doc?.situacao || doc?.status || "").toString().toUpperCase();
          const concluido = ["CONCLUIDO", "AUTORIZADO", "EMITIDO"].some(s => situacao.includes(s));
          const erro = ["REJEITADO", "ERRO", "CANCELADO"].some(s => situacao.includes(s));
          await admin.from("business_invoices").update({
            status: concluido ? "concluido" : erro ? "erro" : "processando",
            numero: doc?.numeroNfse || doc?.numero || null,
            pdf_url: doc?.pdf || doc?.linkPdf || null,
            xml_url: doc?.xml || doc?.linkXml || null,
            erro: erro ? (doc?.mensagem || doc?.motivo || "Rejeitada") : null,
            updated_at: new Date().toISOString(),
          }).eq("id", n.id);
        } catch (_) { /* segue */ }
      }
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    // ── Emite ──
    if (!integ.nfse_emitente_ok) return new Response(JSON.stringify({ error: "Emitente não ativado (envie o certificado A1)." }), { status: 400, headers });
    if (!tomador?.nome || !tomador?.cpfCnpj || !valor) return new Response(JSON.stringify({ error: "Tomador e valor obrigatórios" }), { status: 400, headers });

    const cpfCnpjPrestador = (cfg.cnpj || (company?.cnpj || "")).replace(/\D/g, "");
    const idIntegracao = crypto.randomUUID();
    const payload = [{
      idIntegracao,
      prestador: { cpfCnpj: cpfCnpjPrestador },
      tomador: { cpfCnpj: String(tomador.cpfCnpj).replace(/\D/g, ""), razaoSocial: tomador.nome },
      servico: [{
        codigoTributacaoMunicipio: cfg.item || undefined,
        itemListaServico: cfg.item || undefined,
        cnae: cfg.cnae || undefined,
        discriminacao: descricao || cfg.descricao || "Prestação de serviço",
        iss: { aliquota: cfg.aliquota ?? undefined, tipoTributacao: 6 },
        valor: { servico: Number(valor) },
      }],
    }];

    const r = await plug("/nfse", token, env, { method: "POST", body: JSON.stringify(payload) });
    const providerId = r?.documents?.[0]?.id || r?.data?.[0]?.id || r?.id || null;

    const { data: { user } } = await supabaseUser.auth.getUser();
    await admin.from("business_invoices").insert({
      company_id, user_id: user?.id, bill_id: bill_id || null, provider: "plugnotas",
      provider_id: providerId, status: "processando", valor: Number(valor),
      tomador_nome: tomador.nome, tomador_doc: String(tomador.cpfCnpj).replace(/\D/g, ""),
      descricao: descricao || cfg.descricao || null,
    });

    return new Response(JSON.stringify({ ok: true, provider_id: providerId }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers });
  }
});
