import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home, Mountain, Wallet, Target, LineChart, Briefcase, GraduationCap, Settings, LogOut, Lock,
  Map, FileBarChart, Sparkles, FileText, Lightbulb, Calendar, PieChart, Building2,
  Calculator, Scale, Zap, Umbrella, Heart, Shield, Compass, BookOpen, ListChecks,
  HeartHandshake, Receipt, Globe, Users, User, Palette, Settings2, TrendingUp, ChevronDown, CreditCard,
} from "lucide-react";
import {
  Filter, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, UserCog,
  Package, Boxes, ClipboardList, Repeat, Tag, CalendarRange, Download,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FeatureKey } from "@/hooks/useFeatureAccess";
import { cn } from "@/lib/utils";

type RailItem = { to: string; label: string; icon: React.ElementType; featureKey?: FeatureKey };
type RailGroup =
  | { kind: "direct"; key: string; label: string; icon: React.ElementType; to: string }
  | { kind: "flyout"; key: string; label: string; icon: React.ElementType; items: RailItem[] };

/* ─────────────────────────────────────────────────────────────
   PeJota — navegação 100% PJ (multiempresa).
   Rotas marcadas /dashboard/negocios apontam pro hub do negócio
   até a tela dedicada ser construída (Fase 1+). As demais já têm
   tela própria herdada do PeJota e serão adaptadas pro contexto PJ.
   ───────────────────────────────────────────────────────────── */
const GROUPS: RailGroup[] = [
  { kind: "direct", key: "dashboard", label: "Dashboard", icon: Home, to: "/dashboard" },
  {
    kind: "flyout", key: "vendas", label: "Vendas", icon: Target, items: [
      { to: "/dashboard/negocios/funil", label: "Funil de vendas", icon: Filter },
      { to: "/dashboard/negocios/clientes", label: "Clientes (CRM)", icon: Users },
      { to: "/dashboard/negocios/propostas", label: "Propostas", icon: FileText },
    ],
  },
  {
    kind: "flyout", key: "financeiro", label: "Financeiro", icon: Wallet, items: [
      { to: "/dashboard/negocios", label: "Fluxo de caixa", icon: LineChart },
      { to: "/dashboard/contas-pagar", label: "Contas a pagar", icon: ArrowDownCircle },
      { to: "/dashboard/contas-receber", label: "Contas a receber", icon: ArrowUpCircle },
      { to: "/dashboard/importar-ofx", label: "Conciliação bancária", icon: ArrowLeftRight },
      { to: "/dashboard/impostos", label: "Impostos", icon: Receipt },
      { to: "/dashboard/colaboradores", label: "Colaboradores", icon: UserCog },
    ],
  },
  {
    kind: "flyout", key: "estoque", label: "Estoque", icon: Package, items: [
      { to: "/dashboard/negocios/estoque", label: "Produtos e insumos", icon: Boxes },
      { to: "/dashboard/negocios/estoque", label: "Ficha técnica", icon: ClipboardList },
      { to: "/dashboard/negocios/estoque", label: "Movimentações", icon: Repeat },
      { to: "/dashboard/negocios/estoque", label: "Precificação", icon: Tag },
    ],
  },
  {
    kind: "flyout", key: "planejamento", label: "Planejamento", icon: TrendingUp, items: [
      { to: "/dashboard/projecao-caixa", label: "Projeção de caixa", icon: CalendarRange },
      { to: "/dashboard/metas-vendas", label: "Metas de vendas", icon: Target },
      { to: "/dashboard/simulador-decisao", label: "Simulador de decisão", icon: Calculator },
      { to: "/dashboard/planejamento-tributario", label: "Planejamento tributário", icon: Scale },
      { to: "/dashboard/bens-imoveis", label: "Imobilizado", icon: Building2 },
    ],
  },
  {
    kind: "flyout", key: "relatorios", label: "Relatórios", icon: FileBarChart, items: [
      { to: "/dashboard/dre", label: "DRE gerencial", icon: FileText },
      { to: "/dashboard/fluxo-caixa", label: "Projetado × Realizado", icon: TrendingUp },
      { to: "/dashboard/analises", label: "Análises", icon: PieChart },
      { to: "/dashboard/exportacoes", label: "Exportações", icon: Download },
    ],
  },
  {
    kind: "flyout", key: "academy", label: "Academy", icon: GraduationCap, items: [
      { to: "/dashboard/comecar", label: "Comece por aqui", icon: BookOpen },
      { to: "/dashboard/manual-do-dinheiro", label: "Fluxo de caixa na prática", icon: LineChart, featureKey: "manual_do_dinheiro" },
      { to: "/dashboard/dominando-variavel", label: "Precificação que dá lucro", icon: Tag, featureKey: "dominando_variavel" },
      { to: "/dashboard/novo-mapa-dinheiro", label: "Vendas e funil", icon: TrendingUp, featureKey: "novo_mapa_dinheiro" },
    ],
  },
  {
    kind: "flyout", key: "config", label: "Configuração", icon: Settings, items: [
      { to: "/dashboard/empresa", label: "Empresa", icon: Building2 },
      { to: "/dashboard/cobrancas", label: "Cobranças (Asaas)", icon: CreditCard },
      { to: "/dashboard/equipe", label: "Equipe e acessos", icon: Users },
      { to: "/dashboard/seguranca", label: "Segurança e auditoria", icon: Shield },
      { to: "/dashboard/planos", label: "Plano e cobrança", icon: CreditCard },
      { to: "/dashboard/perfil", label: "Perfil", icon: User },
    ],
  },
];

interface Props {
  isAdmin: boolean;
  featureLoading: boolean;
  hasFeature: (key: FeatureKey) => boolean;
  requiredPlanFor: (key: FeatureKey) => { name: string } | null;
  onSignOut: () => void;
  onScrollTop?: () => void;
  negociosOnly?: boolean;
}

export default function FloatingRail({ isAdmin, featureLoading, hasFeature, requiredPlanFor, onSignOut, onScrollTop, negociosOnly }: Props) {
  const navigate = useNavigate();
  const NEGOCIOS_KEYS = ["dashboard", "vendas", "financeiro", "estoque", "planejamento", "relatorios", "config"];
  const VISIBLE_GROUPS = negociosOnly ? GROUPS.filter(g => NEGOCIOS_KEYS.includes(g.key)) : GROUPS;
  const location = useLocation();
  const path = location.pathname;

  const [expanded, setExpanded] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const groupActive = (g: RailGroup) =>
    g.kind === "direct" ? path === g.to : g.items.some(i => path === i.to);

  const activeFlyoutKey =
    GROUPS.find(g => g.kind === "flyout" && g.items.some(i => path === i.to))?.key ?? null;

  const handleEnter = () => {
    setExpanded(true);
    setOpenKey(prev => prev ?? activeFlyoutKey);
  };
  const handleLeave = () => {
    setExpanded(false);
    setOpenKey(null);
  };

  const go = (to: string) => navigate(to);

  // Linha de nível 1 (grupo/atalho direto). Mostra só ícone quando recolhido (com tooltip),
  // ícone + rótulo (+ chevron pros grupos) quando expandido.
  const renderRow = (opts: {
    keyId: string;
    icon: React.ElementType;
    label: string;
    active: boolean;
    onClick: () => void;
    isGroup: boolean;
    isOpen?: boolean;
  }) => {
    const { icon: Icon, label, active, onClick, isGroup, isOpen } = opts;
    const btn = (
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "relative flex items-center rounded-xl transition-colors",
          expanded ? "w-full gap-3 px-3 py-2.5" : "w-11 h-11 mx-auto justify-center",
          active
            ? "bg-sidebar-accent text-sidebar-foreground font-medium"
            : "text-sidebar-foreground/65 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
        )}
      >
        {active && expanded && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-sidebar-primary" />
        )}
        <Icon className="h-5 w-5 flex-shrink-0" />
        {expanded && <span className="flex-1 text-left text-sm font-medium truncate">{label}</span>}
        {expanded && isGroup && (
          <ChevronDown
            className={cn("h-4 w-4 flex-shrink-0 text-sidebar-foreground/40 transition-transform", isOpen && "rotate-180")}
          />
        )}
      </button>
    );
    if (expanded) return btn;
    return (
      <Tooltip key={opts.keyId}>
        <TooltipTrigger asChild>{btn}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        className={cn(
          "hidden lg:flex fixed left-3 top-3 bottom-3 z-50 flex-col rounded-[26px] bg-sidebar text-sidebar-foreground backdrop-blur-md border border-sidebar-border shadow-[0_18px_50px_-20px_rgba(0,0,0,0.35)] overflow-hidden transition-[width] duration-200 ease-out",
          expanded ? "w-[280px]" : "w-[64px]",
        )}
      >
        {/* Marca */}
        <button
          type="button"
          onClick={() => { if (path === "/dashboard") onScrollTop?.(); else navigate("/dashboard"); }}
          aria-label="Ir para o dashboard"
          className={cn(
            "flex items-center h-14 flex-shrink-0",
            expanded ? "gap-2.5 px-4" : "justify-center px-2",
          )}
        >
          <img src="/logo-branca.png" alt="PeJota" className="w-8 h-8 rounded-lg object-contain flex-shrink-0" />
          {expanded && <span className="font-heading font-bold text-lg tracking-tight truncate">PeJota</span>}
        </button>

        {/* Navegação */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide px-2 py-1 flex flex-col gap-0.5">
          {VISIBLE_GROUPS.map(g => {
            const active = groupActive(g);
            if (g.kind === "direct") {
              return (
                <div key={g.key}>
                  {renderRow({ keyId: g.key, icon: g.icon, label: g.label, active, onClick: () => go(g.to), isGroup: false })}
                </div>
              );
            }
            const isOpen = expanded && openKey === g.key;
            return (
              <div key={g.key}>
                {renderRow({
                  keyId: g.key,
                  icon: g.icon,
                  label: g.label,
                  active,
                  isGroup: true,
                  isOpen,
                  onClick: () => {
                    if (!expanded) { setExpanded(true); setOpenKey(g.key); return; }
                    setOpenKey(prev => (prev === g.key ? null : g.key));
                  },
                })}

                {/* Submenu inline (accordion) — só quando expandido e aberto */}
                {isOpen && (
                  <div className="mt-0.5 mb-1 ml-[18px] pl-3 border-l border-sidebar-border flex flex-col gap-0.5">
                    {g.items.map(item => {
                      const locked = !featureLoading && !!item.featureKey && !hasFeature(item.featureKey);
                      const lockName = item.featureKey ? requiredPlanFor(item.featureKey)?.name : undefined;
                      const itemActive = path === item.to;
                      return (
                        <button
                          key={item.to}
                          type="button"
                          onClick={() => go(item.to)}
                          title={locked ? `${item.label} — ${lockName || "PeJota Pro"}` : undefined}
                          className={cn(
                            "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] transition-colors",
                            itemActive ? "bg-sidebar-accent text-sidebar-foreground font-semibold" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                            locked && "opacity-60",
                          )}
                        >
                          <item.icon className="h-4 w-4 flex-shrink-0" />
                          <span className="flex-1 truncate">{item.label}</span>
                          {locked && <Lock className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />}
                        </button>
                      );
                    })}

                    {/* Admin — só para admin, dentro de Configuração */}
                    {g.key === "config" && isAdmin && (
                      <button
                        type="button"
                        onClick={() => go("/dashboard/admin")}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left text-[13px] transition-colors",
                          path === "/dashboard/admin" ? "bg-sidebar-accent text-sidebar-foreground font-semibold" : "text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                        )}
                      >
                        <Settings2 className="h-4 w-4 flex-shrink-0" />
                        <span className="flex-1 truncate">Admin</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sair */}
        <div className="flex-shrink-0 px-2 py-2 border-t border-sidebar-border">
          {expanded ? (
            <button
              type="button"
              aria-label="Sair"
              onClick={onSignOut}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-5 w-5 flex-shrink-0" />
              <span className="flex-1 text-left text-sm font-medium">Sair</span>
            </button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label="Sair"
                  onClick={onSignOut}
                  className="grid place-items-center w-11 h-11 mx-auto rounded-xl text-sidebar-foreground/60 hover:text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sair</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
