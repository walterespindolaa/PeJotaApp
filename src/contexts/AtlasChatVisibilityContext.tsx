import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type AtlasChatVisibilityContextValue = {
  isChatOpen: boolean;
  setChatOpen: (open: boolean) => void;
};

const AtlasChatVisibilityContext = createContext<AtlasChatVisibilityContextValue>({
  isChatOpen: false,
  setChatOpen: () => {},
});

export const useAtlasChatVisibility = () => useContext(AtlasChatVisibilityContext);

export const AtlasChatVisibilityProvider = ({ children }: { children: ReactNode }) => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const setChatOpen = useCallback((open: boolean) => setIsChatOpen(open), []);
  const value = useMemo(() => ({ isChatOpen, setChatOpen }), [isChatOpen, setChatOpen]);
  return (
    <AtlasChatVisibilityContext.Provider value={value}>
      {children}
    </AtlasChatVisibilityContext.Provider>
  );
};
