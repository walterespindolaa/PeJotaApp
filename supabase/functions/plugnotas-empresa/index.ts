// PeJota — Cadastra/ativa o emitente (empresa) no PlugNotas com o certificado A1.
// O .pfx vai direto pro PlugNotas; não é guardado no nosso banco.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { plug, plugBase, corsHeaders } from "../_shared/plugnotas.ts";

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
    const { company_id, certificado, senha, settings } = await req.json();
    if (!company_id || !certificado || !senha) return new Response(JSON.stringify({ error: "Dados incompletos" }), { status: 400, headers });

    // permissão
    const { data: member } = await admin.from("company_members").select("role").eq("company_id", company_id).eq("user_id", userId).maybeSingle();
    const { data: company } = await admin.from("companies").select("*").eq("id", company_id).single();
    const allowed = company?.user_id === userId || (member && ["owner", "editor"].includes(member.role));
    if (!allowed) return new Response(JSON.stringify({ error: "Sem permissão" }), { status: 403, headers });

    const { data: integ } = await admin.from("company_integrations").select("plugnotas_token, plugnotas_env, nfse_settings").eq("company_id", company_id).maybeSingle();
    if (!integ?.plugnotas_token) return new Response(JSON.stringify({ error: "Salve o token PlugNotas antes." }), { status: 400, headers });
    const token = integ.plugnotas_token as string;
    const env = (integ.plugnotas_env as string) || "sandbox";
    const cfg = { ...(integ.nfse_settings || {}), ...(settings || {}) };

    // 1) Upload do certificado (multipart) → retorna id
    const bin = Uint8Array.from(atob(certificado), (c) => c.charCodeAt(0));
    const fd = new FormData();
    fd.append("arquivo", new Blob([bin], { type: "application/x-pkcs12" }), "cert.pfx");
    fd.append("senha", senha);
    const certRes = await fetch(`${plugBase(env)}/certificado`, { method: "POST", headers: { "X-API-KEY": token }, body: fd });
    const certBody = await certRes.json().catch(() => ({}));
    if (!certRes.ok) return new Response(JSON.stringify({ error: certBody?.error?.message || certBody?.message || "Falha no certificado" }), { status: 400, headers });
    const certId = certBody?.data?.id || certBody?.id;

    // 2) Cria/atualiza a empresa (emitente) no PlugNotas
    const empresa = {
      cpfCnpj: cfg.cnpj || (company?.cnpj || "").replace(/\D/g, ""),
      razaoSocial: company?.name, nomeFantasia: company?.name,
      inscricaoMunicipal: cfg.im || undefined,
      regimeTributario: cfg.regime || "simplesNacional",
      certificado: certId,
      email: company?.email || undefined,
      endereco: cfg.municipioId ? { codigoCidade: String(cfg.municipioId), estado: cfg.uf } : undefined,
      nfse: {
        ativo: true,
        tipoContrato: 0,
        config: {
          producao: env === "prod",
          rps: { serie: "1", numero: 1, lote: 1 },
          prefeitura: cfg.im ? { login: undefined } : undefined,
          itemListaServico: cfg.item || undefined,
          cnae: cfg.cnae || undefined,
          aliquotaIss: cfg.aliquota ?? undefined,
        },
      },
    };
    try {
      await plug("/empresa", token, env, { method: "POST", body: JSON.stringify(empresa) });
    } catch (e) {
      // se já existe, tenta atualizar
      await plug(`/empresa/${empresa.cpfCnpj}`, token, env, { method: "PATCH", body: JSON.stringify(empresa) }).catch(() => { throw e; });
    }

    await admin.from("company_integrations").update({ nfse_emitente_ok: true, nfse_settings: cfg, updated_at: new Date().toISOString() }).eq("company_id", company_id);
    return new Response(JSON.stringify({ ok: true }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers });
  }
});
