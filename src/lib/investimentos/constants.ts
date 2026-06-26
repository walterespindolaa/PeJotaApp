import type { Investimento } from "./types";

export const TIPOS = ["Renda Fixa", "Ação", "FII", "ETF", "Fundo", "Cripto", "Exterior", "Outro"];
export const CLASSES = ["Renda Fixa", "Variável", "Internacional", "Alternativo"];
// Top 7 mais comuns primeiro, depois alfabético, "Outros" no fim.
// "Bancos" mantido por compatibilidade com usuários antigos (não é mais
// exibido no Select de novos cadastros, mas valor existente continua válido).
export const INSTITUICOES = [
  // Top 7
  "XP",
  "BTG",
  "Itaú",
  "Inter",
  "NuInvest",
  "Santander",
  "Bradesco",
  // Alfabético
  "Avenue",
  "Banco do Brasil",
  "Binance",
  "Caixa",
  "Clear",
  "EQI",
  "Genial",
  "Mercado Bitcoin",
  "Modal",
  "Necton",
  "Nomad",
  "Órama",
  "Rico",
  "Safra",
  "Sicoob",
  "Sicredi",
  "Toro",
  // Compat
  "Bancos",
  // Fallback
  "Outros",
];
export const INDEXADORES = ["CDI", "IPCA+", "Prefixado", "Selic", ""];
export const CATEGORIAS_TITULO = ["Bancário", "Crédito Privado", "Tesouro Direto", "Fundo de Investimento", "Outro"];
export const RISCOS = ["Conservador", "Moderado", "Arrojado", "Agressivo"];
export const TIPOS_PROVENTO = ["Dividendo", "JCP", "Rendimento", "Outros"];

export const FREQ_PROVENTOS = [
  { value: "sem_proventos", label: "Não recebe" },
  { value: "mensal", label: "Mensal" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
];

export const PERIOD_OPTIONS = [
  { value: "mes", label: "Mês atual" },
  { value: "3m", label: "Últimos 3 meses" },
  { value: "6m", label: "Últimos 6 meses" },
  { value: "12m", label: "Últimos 12 meses" },
  { value: "ano", label: "No ano" },
  { value: "24m", label: "Últimos 24 meses" },
  { value: "all", label: "Desde o início" },
];

export const ALOCACAO_COLORS: Record<string, string> = {
  "Pós-fixado": "#1F3A5F",
  "Pré-fixado": "#3B82F6",
  "IPCA+": "#6366F1",
  "Renda Variável": "#16A34A",
  "Internacional": "#0EA5A4",
  "FIIs": "#F59E0B",
  "ETFs": "#8B5CF6",
  "Cripto": "#EC4899",
  "Outro": "#94A3B8",
};

export const INST_COLORS = [
  "#1F3A5F", "#3B82F6", "#6366F1", "#16A34A", "#F59E0B",
  "#EC4899", "#0EA5A4", "#8B5CF6", "#94A3B8",
];

export const TIPOS_MANUAIS = ["Renda Fixa", "Fundo", "Outro"];

export const TIPOS_VARIAVEIS = ["Ação", "FII", "ETF", "Cripto", "Exterior", "BDR"];

export const PDF_TAB_OPTIONS = [
  { value: "visao-geral", label: "Visão Geral" },
  { value: "renda-variavel", label: "Renda Variável" },
  { value: "historico", label: "Histórico" },
  { value: "resultado-ir", label: "Resultado & IR" },
  { value: "proventos", label: "Proventos" },
  { value: "stock-guide", label: "Stock Guide" },
];

export const emptyForm = {
  nome: "", ticker: "", tipo: "Renda Fixa", classe: "Renda Fixa", instituicao: "XP",
  valor_atual: 0, total_aportado: 0, quantidade: 0, preco_medio: 0,
  indexador: "", taxa_contratada: 0, vencimento_data: "", liquidez: "D+2", categoria_titulo: "",
  perfil_risco: "Conservador", is_reserva_emergencia: false,
  recebe_proventos: false, frequencia_proventos: "sem_proventos", meses_proventos: "",
  data_compra: "",
};

export const TAB_TO_PATH: Record<string, string> = {
  "visao-geral": "visao-geral",
  "renda-variavel": "renda-variavel",
  "historico": "historico",
  "resultado-ir": "resultado-ir",
  "proventos": "proventos",
  "stock-guide": "stock-guide",
  "importacao-b3": "importacao",
  "rebalanceamento": "rebalanceamento",
};

export const PATH_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_PATH).map(([tab, path]) => [path, tab])
);

export const pct = (v: number | null | undefined) => `${(v ?? 0).toFixed(2).replace(".", ",")}%`;

export function getAlocacaoKey(inv: Investimento): string {
  if (inv.tipo === "FII") return "FIIs";
  if (inv.tipo === "ETF") return "ETFs";
  if (inv.tipo === "Cripto") return "Cripto";
  if (inv.tipo === "Exterior") return "Internacional";
  if (inv.tipo === "Ação") return "Renda Variável";
  if (inv.classe === "Renda Fixa") {
    if (inv.indexador === "IPCA+") return "IPCA+";
    if (inv.indexador === "Prefixado") return "Pré-fixado";
    return "Pós-fixado";
  }
  return "Outro";
}

export function getMonthsBack(period: string): number {
  switch (period) {
    case "mes": return 1;
    case "3m": return 3;
    case "6m": return 6;
    case "12m": return 12;
    case "24m": return 24;
    case "ano": return new Date().getMonth() + 1;
    default: return 999;
  }
}

export function getStartDate(period: string): string {
  const now = new Date();
  if (period === "all") return "2000-01-01";
  if (period === "ano") return `${now.getFullYear()}-01-01`;
  const months = getMonthsBack(period);
  const d = new Date(now.getFullYear(), now.getMonth() - months + 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export const mesesPT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function formatMesPT(mesRef: string): string {
  if (!mesRef) return mesRef;
  const [ano, mes] = mesRef.split("-");
  return `${mesesPT[parseInt(mes) - 1]}/${ano?.slice(2)}`;
}

export const REFRESH_LIMIT_KEY = "atlas_brapi_refresh";
