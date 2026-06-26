import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import NovaVariavelDialog from "@/components/quick-add/NovaVariavelDialog";
import NovoGanhoDialog from "@/components/quick-add/NovoGanhoDialog";
import NovaFixaDialog from "@/components/quick-add/NovaFixaDialog";
import NovaParcelaDialog from "@/components/quick-add/NovaParcelaDialog";

export type QuickAddType = "variavel" | "ganho" | "fixa" | "parcela";

type QuickAddContextValue = {
  openQuickAdd: (type: QuickAddType) => void;
};

const QuickAddContext = createContext<QuickAddContextValue | null>(null);

export const useQuickAdd = (): QuickAddContextValue => {
  const ctx = useContext(QuickAddContext);
  if (!ctx) throw new Error("useQuickAdd must be used within a QuickAddProvider");
  return ctx;
};

export const QuickAddProvider = ({ children }: { children: ReactNode }) => {
  const [active, setActive] = useState<QuickAddType | null>(null);

  const openQuickAdd = useCallback((type: QuickAddType) => {
    setActive(type);
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) setActive(null);
  }, []);

  const value = useMemo(() => ({ openQuickAdd }), [openQuickAdd]);

  return (
    <QuickAddContext.Provider value={value}>
      {children}
      <NovaVariavelDialog open={active === "variavel"} onOpenChange={handleOpenChange} />
      <NovoGanhoDialog open={active === "ganho"} onOpenChange={handleOpenChange} />
      <NovaFixaDialog open={active === "fixa"} onOpenChange={handleOpenChange} />
      <NovaParcelaDialog open={active === "parcela"} onOpenChange={handleOpenChange} />
    </QuickAddContext.Provider>
  );
};
