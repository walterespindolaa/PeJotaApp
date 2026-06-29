// PeJota — Assistente de escrita (IA): gera/organiza textos (processos, descrição de serviço, etc).
// Reusa OPENAI_API_KEY. Requer usuário autenticado. Não acessa dados sensíveis da empresa.
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

const SISTEMA = `Você é um assistente de escrita do PeJota, um ERP para PJ, MEI e pequenos negócios no Brasil.
Gere APENAS o texto solicitado, claro, objetivo e em português do Brasil, sem comentários ou explicações extras.
Quando for um processo/manual, use passos numerados ou tópicos curtos. Tom profissional e direto para a equipe seguir.`;

Deno.serve(async (req) => {
  const headers = cors(req);
  if (req.method === "OPTIONS") return new Response(null, { headers });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });
    const supabaseUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims, error: cErr } = await supabaseUser.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (cErr || !claims?.claims?.sub) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers });

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return new Response(JSON.stringify({ error: "ia_nao_configurada" }), { status: 400, headers });

    const { instrucao, contexto } = await req.json();
    if (!instrucao) return new Response(JSON.stringify({ error: "instrucao obrigatória" }), { status: 400, headers });

    const user = `${String(instrucao).slice(0, 2000)}${contexto ? `\n\nContexto:\n${String(contexto).slice(0, 4000)}` : ""}`;
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: MODEL, messages: [{ role: "system", content: SISTEMA }, { role: "user", content: user }], temperature: 0.5, max_tokens: 800 }),
    });
    if (!resp.ok) { const t = await resp.text(); return new Response(JSON.stringify({ error: `IA: ${resp.status}`, detail: t.slice(0, 300) }), { status: 502, headers }); }
    const data = await resp.json();
    return new Response(JSON.stringify({ text: data?.choices?.[0]?.message?.content || "" }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers });
  }
});
