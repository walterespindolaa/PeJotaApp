import { useState, useEffect, type ElementType } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home, Sparkles, Plus, Compass, TrendingUp, SlidersHorizontal,
  Calendar, PieChart, Wallet, Building2, Heart, Umbrella,
  ChevronRight, Receipt, CreditCard, Briefcase, Menu, LogOut, Lock, Settings2,
} from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useQuickAdd, type QuickAddType } from "@/contexts/QuickAddContext";
import { useAtlasChatVisibility } from "@/contexts/AtlasChatVisibilityContext";
import { getShowNegociosNav, NAV_PREF_EVENT } from "@/lib/navPrefs";

type SubItem = { label: string; to: string; icon: typeof Home };
type AddItem = { type: QuickAddType; label: string; description: string; icon: typeof Wallet; color: string };

const CONTROLE: SubItem[] = [
  { label: "Fluxo de caixa", to: "/dashboard/negocios", icon: Building2 },
  { label: "Contas a receber", to: "/dashboard/contas-receber", icon: Wallet },
  { label: "Conciliação bancária", to: "/dashboard/importar-ofx", icon: PieChart },
  { label: "Impostos", to: "/dashboard/impostos", icon: Receipt },
];
const FINANCEIRO: SubItem[] = [
  { label: "Projeção de caixa", to: "/dashboard/projecao-caixa", icon: Calendar },
  { label: "Metas de vendas", to: "/dashboard/metas-vendas", icon: TrendingUp },
  { label: "DRE gerencial", to: "/dashboard/dre", icon: PieChart },
  { label: "Imobilizado", to: "/dashboard/bens-imoveis", icon: Building2 },
];
const ADD_OPTIONS: AddItem[] = [
  { type: "variavel", label: "Nova despesa variável", description: "Compras do dia, mercado, lazer", icon: Wallet, color: "text-accent" },
  { type: "ganho", label: "Novo ganho", description: "Salário, freelance, dividendo", icon: TrendingUp, color: "text-success" },
  { type: "fixa", label: "Nova despesa fixa", description: "Aluguel, assinatura, conta", icon: Receipt, color: "text-primary" },
  { type: "parcela", label: "Nova parcela", description: "Compra parcelada no cartão", icon: CreditCard, color: "text-info" },
];

const CONTROLE_ROUTES = CONTROLE.map((i) => i.to);
const FINANCEIRO_ROUTES = FINANCEIRO.map((i) => i.to);

type Sheet = "controle" | "financeiro" | "add" | "menu" | null;
type MenuItem = { to: string; icon: ElementType; label: string; featureKey?: string };
type MenuGroup = { title?: string; items: MenuItem[]; badge?: string };

export default function MobileBottomNav({ onOpenChat, hasCompany = false, menuGroups, onSignOut, hasFeature, requiredPlanFor, featureLoading, isAdmin }: { onOpenChat: () => void; hasCompany?: boolean; menuGroups?: MenuGroup[]; onSignOut?: () => void; hasFeature?: (key: any) => boolean; requiredPlanFor?: (key: any) => { name: string } | null; featureLoading?: boolean; isAdmin?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openQuickAdd } = useQuickAdd();
  const { isChatOpen } = useAtlasChatVisibility();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [showNegocios, setShowNegocios] = useState(getShowNegociosNav());

  useEffect(() => {
    const sync = () => setShowNegocios(getShowNegociosNav());
    window.addEventListener(NAV_PREF_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(NAV_PREF_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  // No desktop os menus rápidos abrem como painel flutuante acima da barra;
  // no mobile continuam como gaveta (bottom-sheet).
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setIsDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  if (isChatOpen) return null;

  const path = location.pathname;
  const isHome = path === "/dashboard";
  const inControle = CONTROLE_ROUTES.includes(path);
  const inFinanceiro = FINANCEIRO_ROUTES.includes(path);
  const inSimulador = path === "/dashboard/simulador-decisao";
  const inNegocios = path === "/dashboard/negocios";

  const go = (to: string) => { setSheet(null); navigate(to); };
  const add = (type: QuickAddType) => { setSheet(null); openQuickAdd(type); };

  const iconBtn = (active: boolean) =>
    `w-[38px] h-[38px] rounded-[14px] grid place-items-center transition-all active:scale-95 ${
      active
        ? "text-primary bg-card shadow-sm ring-1 ring-border/60"
        : "text-foreground/45 hover:text-foreground/80"
    }`;

  const rowBtn = "w-full flex items-center gap-3 p-3 rounded-2xl border border-border hover:bg-muted/50 transition-colors text-left";
  const rowIcon = "w-10 h-10 rounded-xl bg-muted grid place-items-center flex-shrink-0";

  const addList = (
    <>
      {ADD_OPTIONS.map((o) => (
        <button key={o.type} onClick={() => add(o.type)} className={rowBtn}>
          <span className={rowIcon}><o.icon className={`h-5 w-5 ${o.color}`} /></span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-foreground">{o.label}</span>
            <span className="block text-xs text-muted-foreground">{o.description}</span>
          </span>
        </button>
      ))}
    </>
  );
  const subList = (items: SubItem[]) => (
    <>
      {items.map((i) => (
        <button key={i.to} onClick={() => go(i.to)} className={rowBtn}>
          <span className={rowIcon}><i.icon className="h-5 w-5 text-primary" /></span>
          <span className="flex-1 text-sm font-semibold text-foreground">{i.label}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      ))}
    </>
  );
  const menuList = (
    <div className="space-y-4">
      {(menuGroups ?? []).map((g, gi) => (
        <div key={gi} className="space-y-1">
          {g.title ? (
            <div className="flex items-center gap-1.5 px-1 pt-1">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
              {g.badge ? (
                <span className={`text-[9px] font-semibold px-1.5 py-px rounded ${g.badge === "Elite" ? "bg-amber-500/15 text-amber-600" : "bg-rose-500/15 text-rose-600"}`}>{g.badge}</span>
              ) : null}
            </div>
          ) : null}
          {g.items.map((it) => {
            const locked = !!it.featureKey && !featureLoading && !!hasFeature && !hasFeature(it.featureKey);
            return (
              <button key={it.to} onClick={() => go(it.to)} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-colors text-left ${locked ? "opacity-50 hover:bg-muted/30" : "hover:bg-muted/50"}`}>
                <span className="w-9 h-9 rounded-xl bg-muted grid place-items-center flex-shrink-0"><it.icon className="h-[18px] w-[18px] text-primary" /></span>
                <span className="flex-1 text-sm font-medium text-foreground">{it.label}</span>
                {locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      ))}
      {isAdmin && (
        <button onClick={() => go("/dashboard/admin")} className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-muted/50 transition-colors text-left">
          <span className="w-9 h-9 rounded-xl bg-muted grid place-items-center flex-shrink-0"><Settings2 className="h-[18px] w-[18px] text-primary" /></span>
          <span className="flex-1 text-sm font-medium text-foreground">Admin</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
      {onSignOut && (
        <button onClick={() => { setSheet(null); onSignOut(); }} className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-destructive/10 text-destructive transition-colors text-left">
          <span className="w-9 h-9 rounded-xl bg-destructive/10 grid place-items-center flex-shrink-0"><LogOut className="h-[18px] w-[18px]" /></span>
          <span className="flex-1 text-sm font-medium">Sair</span>
        </button>
      )}
    </div>
  );

  return (
    <>
      <nav
        className="glass fixed left-1/2 -translate-x-1/2 z-50 flex items-center gap-0.5 px-1.5 py-1.5 rounded-[24px] shadow-[0_14px_38px_-12px_rgba(0,0,0,0.28)]"
        style={{ bottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {menuGroups && menuGroups.length > 0 && (
          <button aria-label="Menu" onClick={() => setSheet(sheet === "menu" ? null : "menu")} className={iconBtn(sheet === "menu")}>
            <Menu className="h-5 w-5" />
          </button>
        )}
        <button aria-label="Atlas IA" onClick={() => { setSheet(null); onOpenChat(); }} className={iconBtn(false)}>
          <Sparkles className="h-5 w-5" />
        </button>
        <button aria-label="Home" onClick={() => go("/dashboard")} className={iconBtn(isHome)}>
          <Home className="h-5 w-5" />
        </button>
        <button
          aria-label="Novo lançamento"
          onClick={() => setSheet(sheet === "add" ? null : "add")}
          className="w-[42px] h-[42px] mx-0.5 rounded-2xl grid place-items-center bg-primary text-primary-foreground shadow-[0_8px_18px_-6px_rgba(0,0,0,0.45)] active:scale-95 transition-transform"
        >
          <Plus className="h-5 w-5" strokeWidth={2.5} />
        </button>
        <button aria-label="Financeiro" onClick={() => setSheet(sheet === "controle" ? null : "controle")} className={iconBtn(inControle || sheet === "controle")}>
          <Compass className="h-5 w-5" />
        </button>
        <button aria-label="Planejamento" onClick={() => setSheet(sheet === "financeiro" ? null : "financeiro")} className={iconBtn(inFinanceiro || sheet === "financeiro")}>
          <TrendingUp className="h-5 w-5" />
        </button>
        <button aria-label="Simulador de Decisão" onClick={() => go("/dashboard/simulador-decisao")} className={iconBtn(inSimulador)}>
          <SlidersHorizontal className="h-5 w-5" />
        </button>
        {showNegocios && hasCompany && (
          <button aria-label="Negócios" onClick={() => go("/dashboard/negocios")} className={iconBtn(inNegocios)}>
            <Briefcase className="h-5 w-5" />
          </button>
        )}
      </nav>

      {/* Desktop: painel flutuante acima da barra (substitui a gaveta no web) */}
      {isDesktop && sheet && (
        <>
          <div className="fixed inset-0 z-[49]" onClick={() => setSheet(null)} />
          <div
            className="fixed left-1/2 -translate-x-1/2 z-50 w-80 max-h-[68vh] overflow-y-auto rounded-2xl border border-border bg-popover text-popover-foreground shadow-[0_14px_38px_-12px_rgba(0,0,0,0.35)] p-2 space-y-1.5 animate-in fade-in slide-in-from-bottom-2 duration-200"
            style={{ bottom: "calc(0.75rem + 66px + env(safe-area-inset-bottom, 0px))" }}
          >
            <p className="px-2 pt-1 pb-1 text-xs font-semibold text-muted-foreground">
              {sheet === "add" ? "Lançamento rápido" : sheet === "controle" ? "Financeiro" : sheet === "financeiro" ? "Planejamento" : "Menu"}
            </p>
            {sheet === "add" && addList}
            {sheet === "controle" && subList(CONTROLE)}
            {sheet === "financeiro" && subList(FINANCEIRO)}
            {sheet === "menu" && menuList}
          </div>
        </>
      )}

      {!isDesktop && (
        <>
      <Drawer open={sheet === "add"} onOpenChange={(o) => !o && setSheet(null)}>
        <DrawerContent className="rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)] lg:max-w-md lg:mx-auto lg:rounded-3xl lg:mb-4">
          <DrawerHeader className="pt-2 pb-3 text-left"><DrawerTitle>Lançamento rápido</DrawerTitle></DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {ADD_OPTIONS.map((o) => (
              <button key={o.type} onClick={() => add(o.type)} className={rowBtn}>
                <span className={rowIcon}><o.icon className={`h-5 w-5 ${o.color}`} /></span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-foreground">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.description}</span>
                </span>
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={sheet === "controle"} onOpenChange={(o) => !o && setSheet(null)}>
        <DrawerContent className="rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)] lg:max-w-md lg:mx-auto lg:rounded-3xl lg:mb-4">
          <DrawerHeader className="pt-2 pb-3 text-left"><DrawerTitle>Financeiro</DrawerTitle></DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {CONTROLE.map((i) => (
              <button key={i.to} onClick={() => go(i.to)} className={rowBtn}>
                <span className={rowIcon}><i.icon className="h-5 w-5 text-primary" /></span>
                <span className="flex-1 text-sm font-semibold text-foreground">{i.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>

      <Drawer open={sheet === "financeiro"} onOpenChange={(o) => !o && setSheet(null)}>
        <DrawerContent className="rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)] lg:max-w-md lg:mx-auto lg:rounded-3xl lg:mb-4">
          <DrawerHeader className="pt-2 pb-3 text-left"><DrawerTitle>Planejamento</DrawerTitle></DrawerHeader>
          <div className="px-4 pb-6 space-y-2">
            {FINANCEIRO.map((i) => (
              <button key={i.to} onClick={() => go(i.to)} className={rowBtn}>
                <span className={rowIcon}><i.icon className="h-5 w-5 text-primary" /></span>
                <span className="flex-1 text-sm font-semibold text-foreground">{i.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
        </>
      )}

      {/* Menu completo — bottom-sheet com toda a navegação (substitui a sidebar lateral no mobile) */}
      {!isDesktop && (
      <Drawer open={sheet === "menu"} onOpenChange={(o) => !o && setSheet(null)}>
        <DrawerContent className="rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)] max-h-[85vh] lg:max-w-md lg:mx-auto lg:rounded-3xl lg:mb-4">
          <DrawerHeader className="pt-2 pb-2 text-left"><DrawerTitle>Menu</DrawerTitle></DrawerHeader>
          <div className="px-4 pb-6 space-y-4 overflow-y-auto">
            {(menuGroups ?? []).map((g, gi) => (
              <div key={gi} className="space-y-1">
                {g.title ? (
                  <div className="flex items-center gap-1.5 px-1 pt-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{g.title}</p>
                    {g.badge ? (
                      <span className={`text-[9px] font-semibold px-1.5 py-px rounded ${g.badge === "Elite" ? "bg-amber-500/15 text-amber-600" : "bg-rose-500/15 text-rose-600"}`}>{g.badge}</span>
                    ) : null}
                  </div>
                ) : null}
                {g.items.map((it) => {
                  const locked = !!it.featureKey && !featureLoading && !!hasFeature && !hasFeature(it.featureKey);
                  return (
                    <button key={it.to} onClick={() => go(it.to)} className={`w-full flex items-center gap-3 p-2.5 rounded-2xl transition-colors text-left ${locked ? "opacity-50 hover:bg-muted/30" : "hover:bg-muted/50"}`}>
                      <span className="w-9 h-9 rounded-xl bg-muted grid place-items-center flex-shrink-0"><it.icon className="h-[18px] w-[18px] text-primary" /></span>
                      <span className="flex-1 text-sm font-medium text-foreground">{it.label}</span>
                      {locked ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            ))}
            {isAdmin && (
              <button onClick={() => go("/dashboard/admin")} className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-muted/50 transition-colors text-left">
                <span className="w-9 h-9 rounded-xl bg-muted grid place-items-center flex-shrink-0"><Settings2 className="h-[18px] w-[18px] text-primary" /></span>
                <span className="flex-1 text-sm font-medium text-foreground">Admin</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
            {onSignOut && (
              <button onClick={() => { setSheet(null); onSignOut(); }} className="w-full flex items-center gap-3 p-2.5 rounded-2xl hover:bg-destructive/10 text-destructive transition-colors text-left">
                <span className="w-9 h-9 rounded-xl bg-destructive/10 grid place-items-center flex-shrink-0"><LogOut className="h-[18px] w-[18px]" /></span>
                <span className="flex-1 text-sm font-medium">Sair</span>
              </button>
            )}
          </div>
        </DrawerContent>
      </Drawer>
      )}
    </>
  );
}
