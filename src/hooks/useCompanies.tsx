import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type BusinessType = "service" | "physical_store" | "ecommerce" | "marketplace" | "distribution" | "autonomous" | "other";

export interface Company {
  id: string;
  user_id: string;
  name: string;
  business_type: BusinessType;
  currency: string | null;
  archived: boolean;
  controla_estoque: boolean | null;
  nicho: string | null;
  cnpj: string | null;
  endereco: string | null;
  telefone: string | null;
  logo_url: string | null;
  paid_seats: number;
  created_at: string;
  updated_at: string;
}

// Segmentos/nichos com suas categorias de insumo padrão (ponto de partida; o usuário pode criar as suas).
export const NICHOS: Record<string, { label: string; categorias: string[] }> = {
  alimentacao: { label: "Alimentação", categorias: ["Hortifruti", "Açougue / Proteínas", "Secos / Grãos", "Laticínios", "Bebidas", "Embalagem", "Descartáveis", "Limpeza"] },
  moda: { label: "Moda / Vestuário", categorias: ["Tecidos", "Aviamentos", "Etiquetas / Tags", "Linhas", "Embalagem", "Acessórios"] },
  beleza: { label: "Beleza / Cosméticos", categorias: ["Matérias-primas", "Embalagens", "Rótulos", "Essências / Fragrâncias", "Descartáveis"] },
  artesanato: { label: "Artesanato / Papelaria", categorias: ["Matéria-prima", "Papel", "Ferramentas", "Tintas / Colas", "Embalagem"] },
  bebidas: { label: "Bebidas / Drinks", categorias: ["Insumos", "Garrafas / Latas", "Rótulos", "Embalagem"] },
  marcenaria: { label: "Marcenaria / Móveis", categorias: ["Madeira / MDF", "Ferragens", "Acabamento", "Embalagem"] },
  generico: { label: "Outro / Genérico", categorias: ["Matéria-prima", "Embalagem", "Revenda", "Outros"] },
};

// Categorias de insumo de uma empresa, a partir do nicho (cai no genérico se não houver).
export const nichoCategorias = (c?: { nicho?: string | null } | null): string[] => {
  const n = c?.nicho && NICHOS[c.nicho] ? c.nicho : "generico";
  return NICHOS[n].categorias;
};

// Empresa controla estoque/produção? null = automático pelo tipo de negócio.
export const companyControlsStock = (c?: { business_type?: BusinessType; controla_estoque?: boolean | null } | null): boolean => {
  if (!c) return false;
  if (c.controla_estoque === true || c.controla_estoque === false) return c.controla_estoque;
  return !(c.business_type === "service" || c.business_type === "autonomous");
};

export interface AllocationRule {
  id: string;
  company_id: string;
  user_id: string;
  name: string;
  type: string;
  base: string;
  percentage: number;
  active: boolean;
  category_ids: string[];
}

export interface BusinessCategory {
  id: string;
  company_id: string;
  name: string;
  emoji: string;
  direction: "in" | "out";
  description: string | null;
  sort_order: number;
}

export interface BusinessTransaction {
  id: string;
  company_id: string;
  date: string;
  description: string;
  amount: number;
  direction: "in" | "out";
  category_id: string | null;
  source: string;
  external_hash: string | null;
  created_at: string;
}

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  service: "Prestação de Serviços",
  physical_store: "Loja Física",
  ecommerce: "E-commerce",
  marketplace: "Marketplace",
  distribution: "Distribuição / Atacado",
  autonomous: "Autônomo / Freelancer",
  other: "Outro",
};

export const BUSINESS_TYPE_EMOJI: Record<BusinessType, string> = {
  service: "💼",
  physical_store: "🏪",
  ecommerce: "🛒",
  marketplace: "🛍",
  distribution: "📦",
  autonomous: "👨‍💻",
  other: "🏢",
};

// Default categories per business type
const DEFAULT_IN_CATEGORIES = [
  { name: "Venda de produtos", emoji: "🛒", description: "Receita com vendas de produtos físicos ou digitais." },
  { name: "Venda de serviços", emoji: "💼", description: "Receita com prestação de serviços." },
  { name: "Recebimentos online", emoji: "💳", description: "Pagamentos recebidos por meios digitais." },
  { name: "Venda loja física", emoji: "🏪", description: "Vendas realizadas presencialmente." },
  { name: "Marketplace", emoji: "🛍", description: "Vendas em plataformas de terceiros." },
  { name: "Distribuição / atacado", emoji: "📦", description: "Vendas em grande volume." },
  { name: "Receita recorrente", emoji: "🔁", description: "Assinaturas, mensalidades e contratos recorrentes." },
  { name: "Outros recebimentos", emoji: "💰", description: "Outras fontes de receita." },
];

const DEFAULT_OUT_CATEGORIES = [
  { name: "Impostos", emoji: "🏛", description: "Valor reservado para pagar impostos da empresa." },
  { name: "Marketing / anúncios", emoji: "📢", description: "Investimento em anúncios, divulgação e crescimento." },
  { name: "Equipe / colaboradores", emoji: "👨‍💻", description: "Pagamentos para funcionários, freelancers ou parceiros." },
  { name: "Frete / logística", emoji: "🚚", description: "Custos com envio e transporte de mercadorias." },
  { name: "Compra de mercadorias", emoji: "📦", description: "Custo com aquisição de produtos para revenda." },
  { name: "Aluguel", emoji: "🏢", description: "Aluguel do espaço comercial ou escritório." },
  { name: "Softwares / ferramentas", emoji: "💻", description: "Assinaturas de softwares e ferramentas digitais." },
  { name: "Internet / telefone", emoji: "📱", description: "Custos com comunicação e internet." },
  { name: "Contas operacionais", emoji: "⚡", description: "Luz, água e outras contas da operação." },
  { name: "Contabilidade", emoji: "📊", description: "Serviços contábeis e fiscais." },
  { name: "Manutenção", emoji: "🔧", description: "Reparos e manutenção de equipamentos." },
  { name: "Despesas pequenas", emoji: "☕", description: "Pequenos gastos do dia a dia." },
  { name: "Pró-labore", emoji: "💰", description: "Salário do dono da empresa." },
  { name: "Reinvestimento", emoji: "📈", description: "Valor reinvestido no crescimento do negócio." },
  { name: "Outros custos", emoji: "🧾", description: "Despesas que não se encaixam nas categorias acima." },
];

const DEFAULT_ALLOCATION_RULES: { name: string; type: string; base: string; percentage: number }[] = [
  { name: "Impostos", type: "expense", base: "revenue", percentage: 15 },
  { name: "Marketing", type: "expense", base: "revenue", percentage: 10 },
  { name: "Pró-labore", type: "profit", base: "gross_profit", percentage: 40 },
  { name: "Reserva / Caixa", type: "reserve", base: "net_profit", percentage: 35 },
];

export const MAX_COMPANIES = 3;

export function useCompanies() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanies = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("*")
      .eq("archived", false)
      .order("created_at");
    const list = (data || []) as unknown as Company[];
    setCompanies(list);
    // Get selected from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("selected_company_id")
      .eq("user_id", user.id)
      .maybeSingle();
    const savedId = (profile as any)?.selected_company_id;
    if (savedId && list.find(c => c.id === savedId)) {
      setSelectedId(savedId);
    } else if (list.length > 0) {
      setSelectedId(list[0].id);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchCompanies(); }, [fetchCompanies]);

  const selectCompany = useCallback(async (id: string) => {
    setSelectedId(id);
    if (user) {
      await supabase.from("profiles").update({ selected_company_id: id } as any).eq("user_id", user.id);
    }
  }, [user]);

  const createCompany = useCallback(async (name: string, businessType: BusinessType, currency?: string, nicho?: string): Promise<Company | null> => {
    if (!user) return null;
    if (companies.length >= MAX_COMPANIES) {
      toast({ title: "Limite atingido", description: "Seu plano permite até 3 empresas.", variant: "destructive" });
      return null;
    }

    const { data, error } = await supabase
      .from("companies")
      .insert({ user_id: user.id, name, business_type: businessType, currency: currency || null, nicho: nicho || null } as any)
      .select()
      .single();
    if (error || !data) {
      toast({ title: "Erro ao criar empresa", variant: "destructive" });
      return null;
    }
    const company = data as unknown as Company;

    // Seed default categories
    const catInserts = [
      ...DEFAULT_IN_CATEGORIES.map((c, i) => ({
        company_id: company.id, user_id: user.id, name: c.name, emoji: c.emoji, direction: "in" as const, description: c.description, sort_order: i + 1,
      })),
      ...DEFAULT_OUT_CATEGORIES.map((c, i) => ({
        company_id: company.id, user_id: user.id, name: c.name, emoji: c.emoji, direction: "out" as const, description: c.description, sort_order: i + 1,
      })),
    ];
    await supabase.from("business_categories").insert(catInserts as any);

    // Seed default allocation rules
    const ruleInserts = DEFAULT_ALLOCATION_RULES.map(r => ({
      company_id: company.id, user_id: user.id, ...r,
    }));
    await supabase.from("allocation_rules").insert(ruleInserts as any);

    await fetchCompanies();
    await selectCompany(company.id);
    toast({ title: `"${name}" criada com sucesso!` });
    return company;
  }, [user, companies, fetchCompanies, selectCompany, toast]);

  const updateCompany = useCallback(async (id: string, updates: Partial<Pick<Company, "name" | "business_type" | "currency" | "controla_estoque" | "nicho" | "cnpj" | "endereco" | "telefone" | "logo_url">>) => {
    await supabase.from("companies").update(updates as any).eq("id", id);
    await fetchCompanies();
  }, [fetchCompanies]);

  const archiveCompany = useCallback(async (id: string) => {
    await supabase.from("companies").update({ archived: true } as any).eq("id", id);
    await fetchCompanies();
    toast({ title: "Empresa arquivada" });
  }, [fetchCompanies, toast]);

  // Exclusão definitiva (apaga todos os dados da empresa)
  const deleteCompany = useCallback(async (id: string) => {
    await supabase.rpc("delete_company" as any, { _company_id: id });
    await fetchCompanies();
    toast({ title: "Empresa excluída" });
  }, [fetchCompanies, toast]);

  const selected = companies.find(c => c.id === selectedId) || null;

  return {
    companies,
    selected,
    selectedId,
    loading,
    selectCompany,
    createCompany,
    updateCompany,
    archiveCompany,
    deleteCompany,
    refresh: fetchCompanies,
    canCreate: companies.length < MAX_COMPANIES,
  };
}
