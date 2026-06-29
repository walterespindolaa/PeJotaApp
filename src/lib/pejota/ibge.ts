/* PeJota — UF e municípios de todo o Brasil via API pública do IBGE.
   Retorna o código IBGE (usado na NFS-e). Cacheia em memória por sessão. */

export interface UF { id: number; sigla: string; nome: string; }
export interface Municipio { id: number; nome: string; }  // id = código IBGE (7 dígitos)

const IBGE = "https://servicodados.ibge.gov.br/api/v1/localidades";
let ufCache: UF[] | null = null;
const munCache: Record<string, Municipio[]> = {};

export async function listarUFs(): Promise<UF[]> {
  if (ufCache) return ufCache;
  const res = await fetch(`${IBGE}/estados?orderBy=nome`);
  const data = (await res.json()) as UF[];
  ufCache = data;
  return data;
}

export async function listarMunicipios(uf: string): Promise<Municipio[]> {
  if (!uf) return [];
  if (munCache[uf]) return munCache[uf];
  const res = await fetch(`${IBGE}/estados/${uf}/municipios`);
  const data = (await res.json()) as Municipio[];
  data.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  munCache[uf] = data;
  return data;
}
