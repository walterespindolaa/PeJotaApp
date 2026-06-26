import { NavLink } from "react-router-dom";
import { LogOut, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface SidebarFooterProps {
  collapsed: boolean;
  isAdmin: boolean;
  onNavigate: () => void;
  onSignOut: () => void;
  labels: { admin: string; sair: string };
}

const ITEM_BASE =
  "flex items-center rounded-xl text-[13px] font-body transition-all duration-200 mb-0.5";

export default function SidebarFooter({
  collapsed,
  isAdmin,
  onNavigate,
  onSignOut,
  labels,
}: SidebarFooterProps) {
  const activeClass = "bg-sidebar-accent text-sidebar-primary font-semibold";
  const inactiveClass =
    "text-sidebar-foreground/50 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground/80";

  if (collapsed) {
    return (
      <div
        className="p-1.5 flex-shrink-0"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      >
        {isAdmin && (
          <FooterTooltip label={labels.admin}>
            <NavLink
              to="/dashboard/admin"
              onClick={onNavigate}
              className={({ isActive }) =>
                `${ITEM_BASE} justify-center px-2 py-2 ${isActive ? activeClass : inactiveClass}`
              }
            >
              <Settings2 className="h-[17px] w-[17px]" />
            </NavLink>
          </FooterTooltip>
        )}

        <FooterTooltip label={labels.sair}>
          <Button
            variant="ghost"
            size="icon"
            className="w-full text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 rounded-xl h-9"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </FooterTooltip>
      </div>
    );
  }

  return (
    <div
      className="p-3 flex-shrink-0"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
    >
      {isAdmin && (
        <NavLink
          to="/dashboard/admin"
          onClick={onNavigate}
          className={({ isActive }) =>
            `${ITEM_BASE} gap-3 px-3 py-2 ${isActive ? activeClass : inactiveClass}`
          }
        >
          <Settings2 className="h-[17px] w-[17px] flex-shrink-0" /> {labels.admin}
        </NavLink>
      )}

      <Button
        variant="ghost"
        className="w-full justify-start text-sidebar-foreground/40 hover:text-sidebar-foreground hover:bg-sidebar-accent/30 text-[13px] px-3 rounded-xl h-9"
        onClick={onSignOut}
      >
        <LogOut className="h-4 w-4 mr-2" /> {labels.sair}
      </Button>

      {/* Footer */}
      <div className="mt-1">
        <p className="text-[10px] text-sidebar-foreground/40 text-center leading-tight">PeJota © 2026</p>
      </div>
    </div>
  );
}

function FooterTooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
