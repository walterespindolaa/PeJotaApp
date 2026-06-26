import {
  Users, BarChart3, DollarSign, Briefcase, Shield, Handshake, Ticket,
  UserCheck, Calendar, MessageSquareText, Megaphone, FileText, Database,
  LayoutDashboard, Gauge, type LucideIcon,
} from "lucide-react";

export type KpiKey =
  | "usersCount" | "activeUsers" | "mrr" | "newLeads" | "newInsuranceLeads"
  | "partnersCount" | "feedbackNovos" | "recadosAtivos" | "logsRecentes";

export type AdminSection = {
  to: string;
  label: string;
  icon: LucideIcon;
  description: string;
  kpi: KpiKey | null;
  kpiSuffix?: string;
  badge?: "alert";
  /** Se true, aparece também na barra de tabs do topo. Home só renderiza os com showInHome !== false */
  showInTabs?: boolean;
  showInHome?: boolean;
  /** Para a tab "Home" que existe só na barra superior */
  end?: boolean;
};

export const ADMIN_SECTIONS: AdminSection[] = [
  { to: "/dashboard/admin", label: "Home", icon: LayoutDashboard, description: "Visão geral do painel", kpi: null, end: true, showInTabs: true, showInHome: false },
  { to: "/dashboard/admin/indicadores", label: "Indicadores", icon: Database, description: "Taxas econômicas (SELIC, IPCA, CDI)", kpi: null, showInTabs: true },
  { to: "/dashboard/admin/users", label: "Usuários", icon: Users, description: "Contas, planos e permissões", kpi: "usersCount", kpiSuffix: "usuários", showInTabs: true },
  { to: "/dashboard/admin/metrics", label: "Métricas", icon: BarChart3, description: "Usuários ativos, novos, retenção", kpi: "activeUsers", kpiSuffix: "ativos", showInTabs: true },
  { to: "/dashboard/admin/revenue", label: "Faturamento", icon: DollarSign, description: "Receita, MRR, assinaturas ativas", kpi: "mrr", showInTabs: true },
  { to: "/dashboard/admin/uso", label: "Uso & Custos", icon: Gauge, description: "Consumo de IA, custo estimado e crescimento", kpi: null, showInTabs: true },
  { to: "/dashboard/admin/leads", label: "Leads Assessoria", icon: Briefcase, description: "Leads qualificados para consultoria", kpi: "newLeads", kpiSuffix: "novo(s)", showInTabs: true },
  { to: "/dashboard/admin/insurance-leads", label: "Leads Seguro", icon: Shield, description: "Leads interessados em seguro", kpi: "newInsuranceLeads", kpiSuffix: "novo(s)", showInTabs: true },
  { to: "/dashboard/admin/partners", label: "Parceiros", icon: Handshake, description: "Rede de parceiros e comissões", kpi: "partnersCount", kpiSuffix: "parceiros", showInTabs: true },
  { to: "/dashboard/admin/coupons", label: "Cupons", icon: Ticket, description: "Descontos e códigos promocionais", kpi: null, showInTabs: true },
  { to: "/dashboard/admin/advisor-coupons", label: "Cupons de Assessor", icon: Ticket, description: "Códigos de indicação e comissões de assessores", kpi: null, showInTabs: true },
  { to: "/dashboard/admin/attributions", label: "Atribuições", icon: UserCheck, description: "Origem dos cadastros e conversões", kpi: null, showInTabs: true },
  { to: "/dashboard/admin/settlement", label: "Fechamento", icon: Calendar, description: "Fechamento mensal financeiro", kpi: null, showInTabs: true },
  { to: "/dashboard/admin/feedback", label: "Feedback", icon: MessageSquareText, description: "Bugs, ideias e sugestões dos usuários", kpi: "feedbackNovos", kpiSuffix: "novo(s)", badge: "alert", showInTabs: true },
  { to: "/dashboard/admin/recados", label: "Recados", icon: Megaphone, description: "Broadcast de mensagens para usuários", kpi: "recadosAtivos", kpiSuffix: "ativo(s)", showInTabs: true },
  { to: "/dashboard/admin/stock-guide", label: "Stock Guide", icon: BarChart3, description: "Análise fundamentalista (BRAPI)", kpi: null, showInTabs: true },
  { to: "/dashboard/admin/logs", label: "Logs", icon: FileText, description: "Erros e incidentes recentes", kpi: "logsRecentes", kpiSuffix: "esta semana", badge: "alert", showInTabs: true },
];

export const homeSections = ADMIN_SECTIONS.filter(s => s.showInHome !== false && s.to !== "/dashboard/admin");
export const tabSections = ADMIN_SECTIONS.filter(s => s.showInTabs !== false);
