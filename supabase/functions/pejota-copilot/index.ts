// PeJota — Copiloto: chat com IA usando os dados REAIS da empresa selecionada.
// Reusa OPENAI_API_KEY (mesmo secret do atlas-chat). Valida membro da empresa.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const MODEL = "gpt-4o-mini";
function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const ym = (d: string) => (d || "").slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: cErr } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const userId = claims.claims.sub as string;

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "ia_nao_configurada" }), { status: 400, headers });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { company_id, messages } = await req.json();
    if (!company_id || !Array.isArray(messages)) return new Response(JSON.stringify({ error: "company_id e messages obrigatórios" }), { status: 400, headers });

    // Permissão (membro ou dono)
    const { data: member } = await admin.from("company_members").select("role").eq("company_id", company_id).eq("user_id", userId).maybeSingle();
    const { data: company } = await admin.from("companies").select("name, user_id").eq("id", company_id).single();
    if (!company || (company.user_id !== userId && !member)) return new Response(JSON.stringify({ error: "Sem acesso a esta empresa" }), { status: 403, headers });

    // ── Contexto real da empresa ──
    const mesAtual = today().slice(0, 7);
    const [txRes, billRes] = await Promise.all([
      admin.from("business_transactions").select("date, amount, direction").eq("company_id", company_id).limit(5000),
      admin.from("business_bills").select("kind, amount, status, due_date, description").eq("company_id", company_id).eq("status", "pendente").limit(500),
    ]);
    const txs = txRes.data || [];
    const bills = billRes.data || [];
    const sum = (arr: any[], dir: string) => arr.filter(t => t.direction === dir).reduce((s, t) => s + Number(t.amount || 0), 0);
    const saldoCaixa = sum(txs, "in") - sum(txs, "out");
    const mes = txs.filter(t => ym(t.date) === mesAtual);
    const receitaMes = sum(mes, "in"), despesaMes = sum(mes, "out");
    const aReceber = bills.filter(b => b.kind === "receber").reduce((s, b) => s + Number(b.amount || 0), 0);
    const aPagar = bills.filter(b => b.kind === "pagar").reduce((s, b) => s + Number(b.amount || 0), 0);
    const atrasadas = bills.filter(b => b.due_date && b.due_date < today());
    const proximas = bills.filter(b => b.due_date).sort((a, b) => (a.due_date < b.due_date ? -1 : 1)).slice(0, 8)
      .map(b => `- ${b.kind === "receber" ? "Receber" : "Pagar"} ${brl(Number(b.amount || 0))} "${b.description}" vence ${b.due_date}`).join("\n");

    const contexto = `EMPRESA: ${company.name}
Data de hoje: ${today()}
Saldo em caixa: ${brl(saldoCaixa)}
Mês atual (${mesAtual}) — Receita: ${brl(receitaMes)} | Despesa: ${brl(despesaMes)} | Resultado: ${brl(receitaMes - despesaMes)}
Contas a receber (pendentes): ${brl(aReceber)}
Contas a pagar (pendentes): ${brl(aPagar)}
Contas atrasadas: ${atrasadas.length}
Próximos vencimentos:
${proximas || "(nenhum)"}`;

    const system = `Você é o Copiloto do PeJota, um ERP financeiro para PJ, MEI e pequenos negócios no Brasil.
Responda em português do Brasil, de forma curta, prática e amigável — o usuário pode ser um operador seguindo um processo.
Use SOMENTE os dados reais da empresa fornecidos abaixo; nunca invente números. Se faltar informação, explique como registrá-la no sistema (ex.: lançar no Caixa, criar conta em Contas a receber).
Quando fizer contas, mostre o raciocínio de forma simples. Não dê recomendação de investimento; foque em gestão do negócio.

DADOS DA EMPRESA:
${contexto}`;

    const clean = messages.filter((m: any) => m.role === "user" || m.role === "assistant").slice(-20)
      .map((m: any) => ({ role: m.role, content: String(m.content || "").slice(0, 4000) }));

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: system }, ...clean], temperature: 0.3, max_tokens: 700 }),
    });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `IA: ${resp.status}`, detail: t.slice(0, 300) }), { status: 502, headers });
    }
    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content || "Não consegui responder agora.";
    return new Response(JSON.stringify({ reply }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers });
  }
});
