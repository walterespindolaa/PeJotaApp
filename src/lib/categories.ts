import {
  Home, Car, Utensils, Heart, GraduationCap, ShoppingBag,
  Wifi, Droplets, Zap, Baby, Dumbbell, Plane, Gift, Film,
  Stethoscope, PawPrint, Scissors, Target, Shirt, Sofa,
  Smartphone, Tv, DollarSign, Briefcase, TrendingUp, Building2,
} from "lucide-react";

// ─── DESPESAS (Fonte Única de Verdade) ───────────────────────────
export interface CategoryDef {
  nome: string;
  icone: React.ElementType;
  tipo: "fixa" | "variavel" | "ambas";
  ordem: number;
}

export const DESPESA_CATEGORIES: CategoryDef[] = [
  { nome: "Moradia", icone: Home, tipo: "fixa", ordem: 1 },
  { nome: "Transporte", icone: Car, tipo: "ambas", ordem: 2 },
  { nome: "Mercado", icone: Utensils, tipo: "variavel", ordem: 3 },
  { nome: "Alimentação", icone: Utensils, tipo: "variavel", ordem: 4 },
  { nome: "Saúde", icone: Stethoscope, tipo: "ambas", ordem: 4 },
  { nome: "Educação", icone: GraduationCap, tipo: "ambas", ordem: 5 },
  { nome: "Compras", icone: ShoppingBag, tipo: "variavel", ordem: 6 },
  { nome: "Internet/Telecom", icone: Wifi, tipo: "fixa", ordem: 7 },
  { nome: "Energia", icone: Zap, tipo: "fixa", ordem: 8 },
  { nome: "Água/Saneamento", icone: Droplets, tipo: "fixa", ordem: 9 },
  { nome: "Filhos", icone: Baby, tipo: "ambas", ordem: 10 },
  { nome: "Academia/Esporte", icone: Dumbbell, tipo: "ambas", ordem: 11 },
  { nome: "Lazer", icone: Film, tipo: "variavel", ordem: 12 },
  { nome: "Viagem", icone: Plane, tipo: "variavel", ordem: 13 },
  { nome: "Assinaturas", icone: Wifi, tipo: "fixa", ordem: 14 },
  { nome: "Seguros", icone: Heart, tipo: "fixa", ordem: 15 },
  { nome: "Pet", icone: PawPrint, tipo: "variavel", ordem: 16 },
  { nome: "Beleza", icone: Scissors, tipo: "variavel", ordem: 17 },
  { nome: "Presentes", icone: Gift, tipo: "variavel", ordem: 18 },
  { nome: "Vestuário", icone: Shirt, tipo: "variavel", ordem: 19 },
  { nome: "Eletrodoméstico", icone: Tv, tipo: "variavel", ordem: 20 },
  { nome: "Eletrônico", icone: Smartphone, tipo: "variavel", ordem: 21 },
  { nome: "Móveis", icone: Sofa, tipo: "variavel", ordem: 22 },
  { nome: "Outros", icone: Target, tipo: "ambas", ordem: 99 },
];

/** All expense category names (sorted by ordem) */
export const ALL_DESPESA_CATEGORY_NAMES = DESPESA_CATEGORIES.map(c => c.nome);

/** Categories for fixas (tipo = fixa or ambas) */
export const CATEGORIAS_FIXAS = DESPESA_CATEGORIES
  .filter(c => c.tipo === "fixa" || c.tipo === "ambas")
  .map(c => c.nome);

/** Categories for variáveis (tipo = variavel or ambas) */
export const CATEGORIAS_VARIAVEIS = DESPESA_CATEGORIES
  .filter(c => c.tipo === "variavel" || c.tipo === "ambas")
  .map(c => c.nome);

/** Categories for parcelas — same as variáveis */
export const CATEGORIAS_PARCELAS = CATEGORIAS_VARIAVEIS;

/** Icon map for quick lookups */
export const CATEGORY_ICON_MAP: Record<string, React.ElementType> = Object.fromEntries(
  DESPESA_CATEGORIES.map(c => [c.nome, c.icone])
);

// ─── RECEITAS (Fonte Única de Verdade) ───────────────────────────
export const RECEITA_CATEGORIES = [
  { nome: "Salário", icone: DollarSign },
  { nome: "Freelance", icone: Briefcase },
  { nome: "Investimentos", icone: TrendingUp },
  { nome: "Aluguel", icone: Building2 },
  { nome: "Outros", icone: Target },
];

export const CATEGORIAS_RECEITAS = RECEITA_CATEGORIES.map(c => c.nome);
