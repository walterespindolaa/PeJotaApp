import { Outlet, useNavigate, useOutletContext, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { usePlan } from "@/hooks/usePlan";
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { useNegociosOnly } from "@/hooks/useNegociosOnly";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompanies } from "@/hooks/useCompanies";
import { applyTheme } from "@/pages/Configuracoes";
import { useI18n } from "@/contexts/I18nContext";
import SidebarUserCard from "@/components/SidebarUserCard";
import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { usePaymentAlerts } from "@/hooks/usePaymentAlerts";
import PlanBanner from "@/components/PlanBanner";
import RestrictedScreen from "@/components/RestrictedScreen";
import InactiveUserScreen from "@/components/InactiveUserScreen";
import AwaitingPaymentScreen from "@/components/AwaitingPaymentScreen";
import TrialUrgencyPopup from "@/components/TrialUrgencyPopup";
import SmartNotificationsPopover from "@/components/alerts/SmartNotificationsDrawer";
import AlertsPopup from "@/components/alerts/AlertsPopup";
import AtlasChatFAB from "@/components/AtlasChatFAB";
import MobileBottomNav from "@/components/MobileBottomNav";
import { QuickAddProvider } from "@/contexts/QuickAddContext";
import { AtlasChatVisibilityProvider } from "@/contexts/AtlasChatVisibilityContext";
import FeedbackButton from "@/components/feedback/FeedbackButton";
import HouseholdViewSelector from "@/components/HouseholdViewSelector";
import GreetingEmojiButton from "@/components/dashboard/GreetingEmojiButton";
import AssistantNudge from "@/components/AssistantNudge";
import PushPermissionPrompt from "@/components/PushPermissionPrompt";
import PwaInstallNudge from "@/components/PwaInstallNudge";
import FeatureGateModal from "@/components/FeatureGateModal";
import PlanBadge from "@/components/PlanBadge";
import UpgradeNudge from "@/components/UpgradeNudge";
import SidebarNav from "@/components/sidebar/SidebarNav";
import SidebarFooter from "@/components/sidebar/SidebarFooter";
import FloatingRail from "@/components/sidebar/FloatingRail";
import type { SidebarNavGroup } from "@/components/sidebar/SidebarNav";
import {
  LayoutDashboard, Wallet, FileBarChart, TrendingUp, Umbrella,
  User, LogOut, Menu, X, Shield,
  Building2, PieChart, Users, Calendar, Zap, FileText, Lightbulb,
  Eye, EyeOff, Briefcase, Heart, Sparkles, Compass, PanelLeftClose, PanelLeft, RefreshCw,
  Calculator, Map, Scale, BookOpen, LineChart, Target, Mountain, ListChecks, Palette,
  HeartHandshake, Receipt, Globe, CreditCard,
} from "lucide-react";
import {
  Filter, ArrowDownCircle, ArrowUpCircle, ArrowLeftRight, UserCog,
  Boxes, ClipboardList, Repeat, Tag, CalendarRange, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserPlan } from "@/hooks/useUserPlan";
import { useHouseholdView } from "@/contexts/HouseholdViewContext";
import { useAtlasScore } from "@/hooks/useAtlasScore";
import { useIsMobile } from "@/hooks/use-mobile";

const DashboardLayout = () => {
  const { signOut, user } = useAuth();
  const { isAdmin } = useUserRole();
  const { isPrivate, toggle: togglePrivacy } = usePrivacyMode();
  const { isRestricted, isInactive, isAwaitingPayment, accessState } = usePlan();
  const { hasFeature, requiredPlanFor, loading: featureLoading } = useFeatureAccess();
  const { restricted: negociosOnly } = useNegociosOnly();
  const mainRef = useRef<HTMLElement>(null);
  const scrollToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);
  const { enrichedAlerts, dismissEvent, triggerDueAlerts } = usePaymentAlerts();
  const { t } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const isPlanos = location.pathname === "/dashboard/planos";
  const isHome = location.pathname === "/dashboard";

  // ── Desktop canopy (home only) ──
  const isMobile = useIsMobile();
  const { acesso_organiza_2026 } = useUserPlan();
  const { greetingName: rawGreeting, activeAvatar, greetingEmoji, setGreetingEmoji, hasPessoa2 } = useHouseholdView();
  const firstName = user?.user_metadata?.full_name?.split(" ")[0] || "Olá";
  const canopyName = rawGreeting || firstName;
  const [visaoFutura, setVisaoFutura] = useState(true);
  const { periodStart: canopyStart, periodEnd: canopyEnd } = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const pad = (n: number) => String(n).padStart(2, "0");
    const lastDay = new Date(y, m + 1, 0).getDate();
    return { periodStart: `${y}-${pad(m + 1)}-01`, periodEnd: `${y}-${pad(m + 1)}-${pad(lastDay)}` };
  }, []);
  // Só busca no desktop (mobile usa o DashboardHero, sem custo extra de query aqui).
  const { result: canopyScore } = useAtlasScore({
    userId: isMobile ? undefined : user?.id,
    periodStart: canopyStart,
    periodEnd: canopyEnd,
  });
  const canopyDash = canopyScore ? 2 * Math.PI * 30 : 0;
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("atlas-sidebar-collapsed") === "true"; } catch { return false; }
  });
  const toggleCollapse = useCallback(() => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("atlas-sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);
  const [chatInitialQuestion, setChatInitialQuestion] = useState<string | undefined>();
  const { companies } = useCompanies();
  const primaryCompany = companies.find(c => !c.archived) || null;

  const [gateModal, setGateModal] = useState<{ open: boolean; label: string; planName: string }>({
    open: false, label: "", planName: "",
  });

  const handleOpenChat = useCallback((q?: string) => {
    setChatInitialQuestion(q || "__open__");
    setTimeout(() => setChatInitialQuestion(undefined), 500);
  }, []);

  useEffect(() => { triggerDueAlerts(); }, [triggerDueAlerts]);
  const handleSignOut = async () => { await signOut(); navigate("/auth"); };
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("tema_sidebar,tema_destaque,tema_modo").eq("user_id", user.id).maybeSingle();
      if (data) {
        const sidebar = (data as any).tema_sidebar;
        const accent = (data as any).tema_destaque;
        const mode = (data as any).tema_modo;
        applyTheme(
          sidebar && sidebar !== "default" ? sidebar : "white",
          accent || "default",
          mode && mode !== "system" ? mode : "light",
        );
      }
    })();
  }, [user]);

  const groups: SidebarNavGroup[] = [
    { title: "", dot: "", items: [
      { to: "/dashboard", icon: LayoutDashboard, label: t("nav.dashboard"), end: true },
    ]},
    { title: "Vendas", dot: "bg-accent", items: [
      { to: "/dashboard/negocios/funil", icon: Filter, label: "Funil de vendas" },
      { to: "/dashboard/negocios/clientes", icon: Users, label: "Clientes (CRM)" },
      { to: "/dashboard/negocios/propostas", icon: FileText, label: "Propostas" },
    ]},
    { title: "Financeiro", dot: "bg-success", items: [
      { to: "/dashboard/negocios", icon: LineChart, label: "Fluxo de caixa" },
      { to: "/dashboard/negocios", icon: ArrowDownCircle, label: "Contas a pagar" },
      { to: "/dashboard/contas-receber", icon: ArrowUpCircle, label: "Contas a receber" },
      { to: "/dashboard/importar-ofx", icon: ArrowLeftRight, label: "Conciliação bancária" },
      { to: "/dashboard/impostos", icon: Receipt, label: "Impostos" },
      { to: "/dashboard/colaboradores", icon: UserCog, label: "Colaboradores" },
    ]},
    { title: "Estoque", dot: "bg-amber-500", items: [
      { to: "/dashboard/negocios/estoque", icon: Boxes, label: "Produtos e insumos" },
      { to: "/dashboard/negocios/estoque", icon: ClipboardList, label: "Ficha técnica" },
      { to: "/dashboard/negocios/estoque", icon: Repeat, label: "Movimentações" },
      { to: "/dashboard/negocios/estoque", icon: Tag, label: "Precificação" },
    ]},
    { title: "Planejamento", dot: "bg-accent", items: [
      { to: "/dashboard/projecao-caixa", icon: CalendarRange, label: "Projeção de caixa" },
      { to: "/dashboard/metas-vendas", icon: Target, label: "Metas de vendas" },
      { to: "/dashboard/simulador-decisao", icon: Calculator, label: "Simulador de decisão" },
      { to: "/dashboard/planejamento-tributario", icon: Scale, label: "Planejamento tributário" },
      { to: "/dashboard/bens-imoveis", icon: Building2, label: "Imobilizado" },
    ]},
    { title: "Relatórios", dot: "bg-primary", items: [
      { to: "/dashboard/dre", icon: FileText, label: "DRE gerencial" },
      { to: "/dashboard/analises", icon: PieChart, label: "Análises" },
      { to: "/dashboard/exportacoes", icon: Download, label: "Exportações" },
    ]},
    { title: "Academy", dot: "bg-primary", badge: "Pro", items: [
      { to: "/dashboard/comecar", icon: BookOpen, label: "Comece por aqui" },
      { to: "/dashboard/manual-do-dinheiro", icon: LineChart, label: "Fluxo de caixa na prática", featureKey: "manual_do_dinheiro" },
      { to: "/dashboard/dominando-variavel", icon: Tag, label: "Precificação que dá lucro", featureKey: "dominando_variavel" },
      { to: "/dashboard/novo-mapa-dinheiro", icon: TrendingUp, label: "Vendas e funil", featureKey: "novo_mapa_dinheiro" },
    ]},
    { title: "Configuração", dot: "bg-warning", items: [
      { to: "/dashboard/empresa", icon: Building2, label: "Empresa" },
      { to: "/dashboard/equipe", icon: Users, label: "Equipe e acessos" },
      { to: "/dashboard/seguranca", icon: Shield, label: "Segurança e auditoria" },
      { to: "/dashboard/planos", icon: CreditCard, label: "Plano e cobrança" },
      { to: "/dashboard/perfil", icon: User, label: "Perfil" },
    ]},
  ];

  const NEG_TITLES = ["", "Vendas", "Financeiro", "Estoque", "Planejamento", "Relatórios", "Configuração"];
  const visibleGroups = negociosOnly ? groups.filter(g => NEG_TITLES.includes(g.title)) : groups;
  const sidebarWidth = sidebarCollapsed ? "w-[68px]" : "w-[280px]";

  return (
    <AtlasChatVisibilityProvider>
    <QuickAddProvider>
    <div className="h-[100dvh] flex flex-col lg:flex-row bg-background overflow-hidden">
      {/* ── Mobile-only Header ── */}
      <header
        className={`flex-shrink-0 z-40 lg:hidden ${isHome ? "text-[#F5F1E8] [&_svg]:!text-[#F5F1E8]" : "border-b border-border/60 glass"}`}
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          ...(isHome ? { background: "linear-gradient(rgba(17,19,27,0.74), rgba(17,19,27,0.74)), hsl(var(--primary))" } : {}),
        }}
      >
        <div className="relative h-12 flex items-center px-4">
          {/* Hambúrguer movido para a barra inferior (MobileBottomNav). */}
          {/* Logo centralizado de forma absoluta — fica no meio real da tela, independente da largura dos lados */}
          <button type="button" onClick={() => { navigate("/dashboard"); scrollToTop(); }} aria-label="Ir para o dashboard" className="absolute left-1/2 -translate-x-1/2 focus:outline-none">
            <img src={isHome ? "/logo.png" : "/logo.png"} alt="PeJota" className="w-7 h-7 rounded-lg object-contain" />
          </button>
          <div className="flex-1" />
          <PlanBadge />
          <SmartNotificationsPopover paymentAlerts={enrichedAlerts} onDismissPayment={dismissEvent} />
          <FeedbackButton />
          <Button variant="ghost" size="icon" onClick={() => window.location.reload()} title="Atualizar" aria-label="Atualizar página" className="text-muted-foreground hover:text-foreground">
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={togglePrivacy} title={isPrivate ? t("header.mostrar_valores") : t("header.ocultar_valores")} className="text-muted-foreground hover:text-foreground">
            {isPrivate ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </Button>
        </div>
        {/* Mobile Row 2: Context chips — só aparece quando há algo pra mostrar (evita barra vazia sem Pessoa 2) */}
        {(hasPessoa2 || primaryCompany) && (
        <div className={`h-10 flex items-center justify-center gap-2 px-4 overflow-x-auto scrollbar-hide relative z-10 ${isHome ? "" : "border-t border-border/30"}`}>
          <HouseholdViewSelector />
          {primaryCompany && (
            <button
              onClick={() => navigate("/dashboard/negocios")}
              aria-label="Negócios" title="Negócios"
              className={`grid place-items-center w-8 h-8 rounded-full transition-colors border bg-transparent flex-shrink-0 ${isHome ? "text-[#F5F1E8]/70 border-[#F5F1E8]/20 hover:bg-white/5" : "text-muted-foreground hover:text-foreground border-border/40 hover:bg-muted/50"}`}
            >
              <Briefcase className="h-4 w-4" />
            </button>
          )}
        </div>
        )}
      </header>

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden">
        {sidebarOpen && <div className="fixed inset-0 bg-foreground/5 backdrop-blur-md z-40 lg:hidden" onClick={closeSidebar} />}

        {/* ── Sidebar (mobile drawer only) ── */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 lg:hidden ${sidebarWidth} bg-sidebar text-sidebar-foreground flex flex-col h-[100dvh] transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {/* Mobile sidebar header — clean, no logo */}
          <div className="px-5 h-12 flex items-center justify-end border-b border-sidebar-border flex-shrink-0 lg:hidden">
            <Button variant="ghost" size="icon" className="text-sidebar-foreground hover:bg-sidebar-accent" onClick={closeSidebar}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Desktop collapse toggle */}
          <div className={`hidden lg:flex items-center ${sidebarCollapsed ? "justify-center" : "justify-end px-3"} py-2 flex-shrink-0`}>
            <Button variant="ghost" size="icon" onClick={toggleCollapse} className="h-7 w-7 text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30">
              {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </Button>
          </div>

          {/* User card — synced with household view */}
          {!sidebarCollapsed && <SidebarUserCard onNavigate={closeSidebar} />}
          {sidebarCollapsed && (
            <div className="hidden lg:flex justify-center py-3" />
          )}

          {/* Navigation */}
          <SidebarNav
            groups={visibleGroups}
            collapsed={sidebarCollapsed}
            featureLoading={featureLoading}
            hasFeature={hasFeature}
            requiredPlanFor={requiredPlanFor}
            onNavigate={closeSidebar}
          />

          {/* Footer */}
          <SidebarFooter
            collapsed={sidebarCollapsed}
            isAdmin={isAdmin}
            onNavigate={closeSidebar}
            onSignOut={handleSignOut}
            labels={{ admin: t("nav.admin"), sair: t("nav.sair") }}
          />
        </aside>

        {/* ── Desktop floating rail ── */}
        <FloatingRail
          isAdmin={isAdmin}
          featureLoading={featureLoading}
          hasFeature={hasFeature}
          requiredPlanFor={requiredPlanFor}
          onSignOut={handleSignOut}
          onScrollTop={scrollToTop}
          negociosOnly={negociosOnly}
        />

        {/* ── Main content ── */}
        <div className={`flex-1 flex flex-col overflow-hidden lg:pl-[96px] ${isHome ? "lg:bg-[radial-gradient(70%_45%_at_50%_0%,hsl(var(--primary)/0.06),transparent_70%)]" : ""}`}>
          {/* ── Desktop canopy (home only) — sangra sob a rail ── */}
          {isHome && (
            <div
              className="hidden lg:block lg:-ml-[96px] rounded-b-[36px] overflow-hidden text-[#F5F1E8] flex-shrink-0"
              style={{ background: "linear-gradient(rgba(17,19,27,0.74), rgba(17,19,27,0.74)), hsl(var(--primary))" }}
            >
              <div className="pl-[120px] pr-8 pt-3 pb-5">
                {/* Top line: toolbar acoplada (seletor + empresa · controles + Visão Futura) */}
                <div className="flex items-center gap-3 mb-4">
                  {/* Esquerda: household + empresa */}
                  <div className="flex items-center gap-2 [&_svg]:text-[#F5F1E8]">
                    <HouseholdViewSelector />
                    {primaryCompany && (
                      <>
                        <div className="h-5 w-px bg-[rgba(245,241,232,0.16)]" />
                        <button
                          type="button"
                          onClick={() => navigate("/dashboard/negocios")}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#F5F1E8] bg-[rgba(245,241,232,0.10)] hover:bg-[rgba(245,241,232,0.16)] border border-[rgba(245,241,232,0.16)] whitespace-nowrap transition-colors"
                        >
                          <Briefcase className="h-3.5 w-3.5" /> Empresa
                        </button>
                      </>
                    )}
                  </div>

                  <div className="flex-1" />

                  {/* Direita: plano · sino · chat · privacidade · Visão Futura */}
                  <div className="flex items-center gap-2 [&_svg]:text-[#F5F1E8] [&_button]:text-[#F5F1E8]">
                    <PlanBadge />
                    <SmartNotificationsPopover paymentAlerts={enrichedAlerts} onDismissPayment={dismissEvent} />
                    <FeedbackButton />
                    <button
                      type="button"
                      onClick={togglePrivacy}
                      title={isPrivate ? t("header.mostrar_valores") : t("header.ocultar_valores")}
                      className="grid place-items-center h-8 w-8 rounded-full text-[#F5F1E8] bg-[rgba(245,241,232,0.08)] hover:bg-[rgba(245,241,232,0.16)] transition-colors"
                    >
                      {isPrivate ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {acesso_organiza_2026 && (
                      <div className="flex items-center gap-2 ml-1">
                        <Label htmlFor="visao-futura-desktop" className="text-xs text-[#F5F1E8]/80 font-body whitespace-nowrap cursor-pointer">
                          <Target className="h-3.5 w-3.5 inline mr-1" />Visão Futura
                        </Label>
                        <Switch id="visao-futura-desktop" checked={visaoFutura} onCheckedChange={setVisaoFutura} />
                      </div>
                    )}
                  </div>
                </div>
                {/* Main row: foto + saudação + score */}
                <div className="flex items-end justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar className="h-16 w-16 flex-shrink-0 border-2 border-[#F5F1E8]/20">
                      {activeAvatar ? <AvatarImage src={activeAvatar} alt={canopyName} /> : null}
                      <AvatarFallback className="bg-[#F5F1E8]/10 text-[#F5F1E8] text-xl font-bold">
                        {canopyName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[#F5F1E8]/70">Olá,</p>
                      <h1 className="text-3xl font-heading font-bold leading-tight flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{canopyName}</span>
                        <GreetingEmojiButton greetingEmoji={greetingEmoji} onEmojiSelect={setGreetingEmoji} />
                      </h1>
                      <p className="text-sm text-[#F5F1E8]/70 mt-0.5">Clareza para planejar, decidir e construir patrimônio.</p>
                    </div>
                  </div>
                  {canopyScore && (
                    <div className="relative h-[88px] w-[88px] flex-shrink-0">
                      <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
                        <circle cx="44" cy="44" r="30" fill="none" stroke="hsl(0 0% 100% / 0.18)" strokeWidth="7" />
                        <circle
                          cx="44" cy="44" r="30" fill="none"
                          stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round"
                          strokeDasharray={canopyDash}
                          strokeDashoffset={canopyDash * (1 - Math.max(0, Math.min(100, canopyScore.score ?? 0)) / 100)}
                          style={{ transition: "stroke-dashoffset 0.8s ease" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="font-heading text-2xl font-bold leading-none text-[#F5F1E8]">{canopyScore.score}</span>
                        <span className="mt-0.5 text-[8px] font-heading font-semibold uppercase tracking-[0.12em] text-[#F5F1E8]/70">Score</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Desktop-only context bar — escondida na home (canopy assume o topo) */}
          {!isHome && (
          <div onDoubleClick={scrollToTop} className="hidden lg:flex items-center gap-3 px-6 py-2 border-b border-border/30 flex-shrink-0 relative z-10">
            <button type="button" onClick={() => { if (isHome) scrollToTop(); else navigate("/dashboard"); }} aria-label="Ir para o dashboard" className="focus:outline-none">
              <img src="/logo.png" alt="PeJota" className="w-6 h-6 rounded-md object-contain mr-2" />
            </button>
            <HouseholdViewSelector />
            {primaryCompany && (
              <button
                onClick={() => navigate("/dashboard/negocios")}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border/40 bg-transparent hover:bg-muted/50 whitespace-nowrap flex-shrink-0"
              >
                <Briefcase className="h-3.5 w-3.5" />
                <span>Empresa</span>
              </button>
            )}
            <div className="flex-1" />
            <PlanBadge />
            <SmartNotificationsPopover paymentAlerts={enrichedAlerts} onDismissPayment={dismissEvent} />
            <FeedbackButton />
            <Button variant="ghost" size="icon" onClick={() => window.location.reload()} title="Atualizar" aria-label="Atualizar página" className="text-muted-foreground hover:text-foreground">
              <RefreshCw className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={togglePrivacy} title={isPrivate ? t("header.mostrar_valores") : t("header.ocultar_valores")} className="text-muted-foreground hover:text-foreground">
              {isPrivate ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </Button>
          </div>
          )}
          <main
            ref={mainRef}
            className={`flex-1 ${sidebarOpen ? "overflow-hidden lg:overflow-y-auto" : "overflow-y-auto"} overscroll-y-none overflow-x-clip px-4 pt-4 pb-28 sm:px-5 lg:px-6 lg:pb-24`}
            style={{ paddingLeft: "max(1rem, env(safe-area-inset-left))", paddingRight: "max(1rem, env(safe-area-inset-right))" }}
          >
            <div className="max-w-[1400px] mx-auto w-full">
              {!isHome && <PlanBanner />}
              <UpgradeNudge />
              {negociosOnly ? <Outlet context={{ onOpenChat: handleOpenChat, visaoFutura, setVisaoFutura }} /> : isInactive ? <InactiveUserScreen /> : isAwaitingPayment && !isPlanos ? <AwaitingPaymentScreen /> : isRestricted && !isPlanos ? <RestrictedScreen /> : <Outlet context={{ onOpenChat: handleOpenChat, visaoFutura, setVisaoFutura }} />}
            </div>
            {/* Legal footer */}
            <div className="mt-8 py-6 text-center space-y-1.5 border-t border-border/20">
              <p className="text-[10px] text-muted-foreground/50">
                PeJota © 2026
                <span className="mx-1.5">·</span>
                <a href="/termos-de-uso" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground underline underline-offset-2">Termos</a>
                <span className="mx-1.5">·</span>
                <a href="/politica-de-privacidade" target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground underline underline-offset-2">Privacidade</a>
              </p>
              <p className="text-[10px] text-muted-foreground/35 leading-relaxed max-w-lg mx-auto">
                PeJota é uma plataforma de gestão financeira e administrativa para empresas. As informações apresentadas têm finalidade gerencial e não constituem aconselhamento contábil ou jurídico.
              </p>
            </div>
          </main>
        </div>
      </div>

      {/* ── Overlays ── */}
      <TrialUrgencyPopup />
      <AlertsPopup alerts={enrichedAlerts} onDismiss={dismissEvent} />
      <AssistantNudge chatOpen={!!chatInitialQuestion} onOpenChat={() => handleOpenChat()} />
      <AtlasChatFAB initialQuestion={chatInitialQuestion} />
      <MobileBottomNav onOpenChat={() => handleOpenChat()} hasCompany={!!primaryCompany} menuGroups={visibleGroups} onSignOut={handleSignOut} hasFeature={hasFeature} requiredPlanFor={requiredPlanFor} featureLoading={featureLoading} isAdmin={isAdmin} />
      <PushPermissionPrompt />
      <PwaInstallNudge />
      <FeatureGateModal
        open={gateModal.open}
        onOpenChange={(open) => setGateModal(prev => ({ ...prev, open }))}
        featureLabel={gateModal.label}
        requiredPlanName={gateModal.planName}
      />
    </div>
    </QuickAddProvider>
    </AtlasChatVisibilityProvider>
  );
};

export default DashboardLayout;
