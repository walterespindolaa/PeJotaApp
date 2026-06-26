import {
  ShoppingCart, Briefcase, CreditCard, Store, ShoppingBag, Package, Repeat, Wallet,
  Landmark, Megaphone, Users, Truck, Building2, Laptop, Smartphone, Zap, BarChart3,
  Wrench, Coffee, TrendingUp, Receipt, Tag,
  type LucideIcon,
} from "lucide-react";

/**
 * Ícone Lucide por categoria de negócio (substitui os emojis salvos no banco).
 * Mapeado por NOME — o campo emoji continua no banco, só não é renderizado.
 */
const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  // Receitas
  "Venda de produtos": ShoppingCart,
  "Venda de serviços": Briefcase,
  "Recebimentos online": CreditCard,
  "Venda loja física": Store,
  "Marketplace": ShoppingBag,
  "Distribuição / atacado": Package,
  "Receita recorrente": Repeat,
  "Outros recebimentos": Wallet,
  // Despesas
  "Impostos": Landmark,
  "Marketing / anúncios": Megaphone,
  "Equipe / colaboradores": Users,
  "Frete / logística": Truck,
  "Compra de mercadorias": Package,
  "Aluguel": Building2,
  "Softwares / ferramentas": Laptop,
  "Internet / telefone": Smartphone,
  "Contas operacionais": Zap,
  "Contabilidade": BarChart3,
  "Manutenção": Wrench,
  "Despesas pequenas": Coffee,
  "Pró-labore": Wallet,
  "Reinvestimento": TrendingUp,
  "Outros custos": Receipt,
};

export function getCategoryIcon(name?: string): LucideIcon {
  if (!name) return Tag;
  return CATEGORY_ICON_MAP[name] || Tag;
}

export function CategoryIcon({ name, className = "h-3.5 w-3.5" }: { name?: string; className?: string }) {
  const Icon = getCategoryIcon(name);
  return <Icon className={className} />;
}
