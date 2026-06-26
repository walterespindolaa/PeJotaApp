import { useState } from "react";
import { Plus, Wallet, TrendingUp, Receipt, CreditCard } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/hooks/useAuth";
import { useQuickAdd, type QuickAddType } from "@/contexts/QuickAddContext";
import { useAtlasChatVisibility } from "@/contexts/AtlasChatVisibilityContext";

type Option = {
  type: QuickAddType;
  label: string;
  description: string;
  icon: typeof Wallet;
  iconColor: string;
};

const OPTIONS: Option[] = [
  {
    type: "variavel",
    label: "Nova despesa variável",
    description: "Compras do dia, mercado, lazer",
    icon: Wallet,
    iconColor: "text-accent",
  },
  {
    type: "ganho",
    label: "Novo ganho",
    description: "Salário, freelance, dividendo",
    icon: TrendingUp,
    iconColor: "text-success",
  },
  {
    type: "fixa",
    label: "Nova despesa fixa",
    description: "Aluguel, assinatura, conta",
    icon: Receipt,
    iconColor: "text-primary",
  },
  {
    type: "parcela",
    label: "Nova parcela",
    description: "Compra parcelada no cartão",
    icon: CreditCard,
    iconColor: "text-info",
  },
];

const QuickAddFAB = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { openQuickAdd } = useQuickAdd();
  const { isChatOpen } = useAtlasChatVisibility();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!isMobile || !user || isChatOpen) return null;

  const handleSelect = (type: QuickAddType) => {
    setSheetOpen(false);
    openQuickAdd(type);
  };

  return (
    <>
      <button
        onClick={() => setSheetOpen(true)}
        aria-label="Lançamento rápido"
        className="fixed z-50 h-12 w-12 rounded-full bg-foreground text-background shadow-[0_4px_20px_-4px_hsl(var(--foreground)/0.4)] hover:shadow-[0_6px_28px_-4px_hsl(var(--foreground)/0.5)] transition-all duration-200 flex items-center justify-center hover:scale-105 active:scale-95"
        style={{
          bottom: "calc(5.5rem + env(safe-area-inset-bottom, 0px))",
          right: "1.75rem",
        }}
      >
        <Plus className="h-5 w-5" strokeWidth={2.5} />
      </button>

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent className="rounded-t-3xl pb-[env(safe-area-inset-bottom,0px)]">
          <DrawerHeader className="pt-2 pb-3 text-left">
            <DrawerTitle>Lançamento rápido</DrawerTitle>
          </DrawerHeader>
          <div className="px-3 pb-4 space-y-1">
            {OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.type}
                  onClick={() => handleSelect(opt.type)}
                  className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-muted active:bg-muted transition-colors text-left"
                >
                  <div className={`flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center ${opt.iconColor}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{opt.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{opt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default QuickAddFAB;
