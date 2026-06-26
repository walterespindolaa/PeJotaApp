// Wrapper de fetch com timeout via AbortController para chamadas ao gateway de IA.
// O timer e cancelado assim que o fetch resolve (fase de conexao/headers), entao
// para respostas em streaming a leitura do body NAO e abortada — apenas a conexao
// inicial. Em caso de estouro do timeout, lanca AiTimeoutError para o chamador
// traduzir em 504.

export class AiTimeoutError extends Error {
  constructor() {
    super("ai_timeout");
    this.name = "AiTimeoutError";
  }
}

export async function aiFetch(
  url: string,
  init: RequestInit,
  timeoutMs = 30_000,
): Promise<Response> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw new AiTimeoutError();
    throw e;
  } finally {
    clearTimeout(t);
  }
}
