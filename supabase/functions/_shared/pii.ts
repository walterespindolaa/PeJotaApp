// Hash determinístico de PII para uso em audit_logs (LGPD).
// Os hashes são write-only, servem apenas para correlação — nunca para
// recuperar o valor original. Use no lugar de e-mail/telefone/nome brutos.
export async function hashPii(value: string): Promise<string> {
  const enc = new TextEncoder().encode(value.toLowerCase().trim());
  const digest = await crypto.subtle.digest("SHA-256", enc);
  return "h_" + Array.from(new Uint8Array(digest)).slice(0, 8).map(b => b.toString(16).padStart(2, "0")).join("");
}
