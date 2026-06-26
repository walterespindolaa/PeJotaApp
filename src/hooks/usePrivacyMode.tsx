import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

interface PrivacyModeContextType {
  isPrivate: boolean;
  toggle: () => void;
}

const PrivacyModeContext = createContext<PrivacyModeContextType>({
  isPrivate: false,
  toggle: () => {},
});

export const PrivacyModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPrivate, setIsPrivate] = useState(() => {
    try { return localStorage.getItem("privacyMode") === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("privacyMode", String(isPrivate)); } catch {}
    if (isPrivate) {
      document.documentElement.classList.add("privacy-mode");
    } else {
      document.documentElement.classList.remove("privacy-mode");
    }
  }, [isPrivate]);

  const toggle = useCallback(() => setIsPrivate(prev => !prev), []);

  const value = useMemo(() => ({ isPrivate, toggle }), [isPrivate, toggle]);

  return (
    <PrivacyModeContext.Provider value={value}>
      {children}
    </PrivacyModeContext.Provider>
  );
};

export const usePrivacyMode = () => useContext(PrivacyModeContext);
