import { NavLink } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { FeatureKey } from "@/hooks/useFeatureAccess";

/* ── Types ── */
export type SidebarNavItem = {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  featureKey?: FeatureKey;
};

export type SidebarNavGroup = {
  title: string;
  dot: string;
  items: SidebarNavItem[];
  badge?: string;
};

interface SidebarNavProps {
  groups: SidebarNavGroup[];
  collapsed: boolean;
  featureLoading: boolean;
  hasFeature: (key: FeatureKey) => boolean;
  requiredPlanFor: (key: FeatureKey) => { name: string } | null;
  onNavigate: () => void;
}

/* ── Shared class constants ── */
const ITEM_BASE =
  "flex items-center w-full h-9 rounded-xl text-[13px] font-body font-normal leading-none transition-colors";
const ITEM_EXPANDED = "px-3 gap-2.5";
const ITEM_COLLAPSED = "px-2 justify-center";
const ICON_CLASS = "h-[18px] w-[18px] flex-shrink-0";

/* ── Section header ── */
function SectionHeader({
  title,
  dot,
  badge,
  collapsed,
}: {
  title: string;
  dot: string;
  badge?: string;
  collapsed: boolean;
}) {
  if (!title) return null;

  if (collapsed) {
    return (
      <div className="flex justify-center mb-1">
        <div className={`w-1 h-1 rounded-full ${dot}`} />
      </div>
    );
  }

  const badgeColor =
    badge === "Elite"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : "bg-rose-500/15 text-rose-600 dark:text-rose-400";

  return (
    <div className="flex items-center px-3 mb-2 h-4">
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      <span className="ml-2 text-[9px] uppercase tracking-[0.15em] text-sidebar-foreground/30 font-heading font-semibold leading-none whitespace-nowrap">
        {title}
      </span>
      {badge && (
        <span
          className={`ml-1.5 text-[8px] font-medium px-1 py-px rounded normal-case tracking-normal ${badgeColor}`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}

/* ── Single menu item ── */
function MenuItem({
  item,
  collapsed,
  locked,
  lockLabel,
  onNavigate,
}: {
  item: SidebarNavItem;
  collapsed: boolean;
  locked: boolean;
  lockLabel?: string;
  onNavigate: () => void;
}) {
  const activeClass = locked
    ? "bg-sidebar-accent/20 text-sidebar-foreground/50"
    : "bg-sidebar-accent text-sidebar-primary font-semibold";

  const inactiveClass = locked
    ? "text-sidebar-foreground/40 hover:bg-sidebar-accent/10"
    : "text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/80";

  const navLink = (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `${ITEM_BASE} ${collapsed ? ITEM_COLLAPSED : ITEM_EXPANDED} ${
          locked ? "cursor-not-allowed opacity-70" : ""
        } ${isActive ? activeClass : inactiveClass}`
      }
    >
      <item.icon className={ICON_CLASS} />
      {!collapsed && (
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">
          {item.label}
        </span>
      )}
    </NavLink>
  );

  /* Tooltip for collapsed mode or locked items.
     Wrap in a <div> so TooltipTrigger asChild targets a plain element
     instead of NavLink's function-className (which Radix can't merge). */
  if (collapsed || locked) {
    const tooltipText = locked
      ? `${item.label} — ${lockLabel || "Atlas Pro"}`
      : item.label;

    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div>{navLink}</div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {tooltipText}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return navLink;
}

/* ── Main component ── */
export default function SidebarNav({
  groups,
  collapsed,
  featureLoading,
  hasFeature,
  requiredPlanFor,
  onNavigate,
}: SidebarNavProps) {
  return (
    <nav
      className={`flex-1 ${collapsed ? "px-1.5" : "px-3"} py-4 space-y-6 overflow-y-auto overscroll-contain scrollbar-sidebar`}
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      {groups.map((group, gi) => (
        <div key={gi}>
          <SectionHeader
            title={group.title}
            dot={group.dot}
            badge={group.badge}
            collapsed={collapsed}
          />
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const locked =
                !featureLoading &&
                !!item.featureKey &&
                !hasFeature(item.featureKey);

              const lockLabel = item.featureKey
                ? requiredPlanFor(item.featureKey)?.name || undefined
                : undefined;

              return (
                <MenuItem
                  key={item.to}
                  item={item}
                  collapsed={collapsed}
                  locked={locked}
                  lockLabel={lockLabel}
                  onNavigate={onNavigate}
                />
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
