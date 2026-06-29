// PeJota — helpers compartilhados PlugNotas
// NOTE: confirmar payloads exatos na doc oficial (docs.plugnotas.com.br) ao ativar.
export const plugBase = (env: string) =>
  env === "prod" ? "https://api.plugnotas.com.br" : "https://api.sandbox.plugnotas.com.br";

export async function plug(path: string, token: string, env: string, init?: RequestInit) {
  const res = await fetch(`${plugBase(env)}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-API-KEY": token, ...(init?.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || (Array.isArray(body?.error) ? body.error[0]?.message : null) || `PlugNotas ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return body;
}

export function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}
