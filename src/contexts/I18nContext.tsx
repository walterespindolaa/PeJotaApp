import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ptBR from "@/lib/i18n/pt-BR";
import en from "@/lib/i18n/en";
import es from "@/lib/i18n/es";
import type { SupportedCurrency, SupportedLanguage } from "@/lib/formatMoney";
import { formatMoney, formatMoneyShort, getCurrencySymbol } from "@/lib/formatMoney";
import { logError } from "@/lib/log";

const DICTIONARIES: Record<SupportedLanguage, Record<string, string>> = {
  "pt-BR": ptBR,
  en,
  es,
};

interface I18nContextType {
  language: SupportedLanguage;
  currency: SupportedCurrency;
  onboardingCompleted: boolean | null; // null = loading
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  setCurrency: (cur: SupportedCurrency) => Promise<void>;
  completeOnboarding: (fullName: string, lang: SupportedLanguage, cur: SupportedCurrency) => Promise<boolean | string>;
  t: (key: string) => string;
  fmt: (value: number | null | undefined) => string;
  fmtShort: (value: number | null | undefined) => string;
  currencySymbol: string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [language, setLanguageState] = useState<SupportedLanguage>("pt-BR");
  const [currency, setCurrencyState] = useState<SupportedCurrency>("BRL");
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  // Load user preferences
  useEffect(() => {
    if (!user) {
      setOnboardingCompleted(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("language,currency,onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        logError("[I18n] profile fetch failed; keeping current state:", error);
        return;
      }
      if (data) {
        const d = data as any;
        setLanguageState((d.language as SupportedLanguage) || "pt-BR");
        setCurrencyState((d.currency as SupportedCurrency) || "BRL");
        setOnboardingCompleted(d.onboarding_completed ?? false);
      } else {
        setOnboardingCompleted(false);
      }
    })();
  }, [user?.id]);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setLanguageState(lang);
    if (user) {
      await supabase
        .from("profiles")
        .update({ language: lang } as any)
        .eq("user_id", user.id);
    }
  }, [user]);

  const setCurrency = useCallback(async (cur: SupportedCurrency) => {
    setCurrencyState(cur);
    if (user) {
      await supabase
        .from("profiles")
        .update({ currency: cur } as any)
        .eq("user_id", user.id);
    }
  }, [user]);

  const completeOnboarding = useCallback(async (fullName: string, lang: SupportedLanguage, cur: SupportedCurrency): Promise<boolean | string> => {
    if (!user) return "Usuário não autenticado.";

    const payload = {
      user_id: user.id,
      full_name: fullName.trim(),
      nome_pessoa1: fullName.trim(),
      language: lang,
      currency: cur,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("profiles")
      .upsert(payload as any, { onConflict: "user_id" });

    if (error) {
      logError("[Onboarding] upsert failed:", error);
      if (error.code === "42501") return "Permissão insuficiente para salvar seu perfil.";
      return error.message || "Não conseguimos salvar suas preferências. Tente novamente.";
    }

    setLanguageState(lang);
    setCurrencyState(cur);
    setOnboardingCompleted(true);
    return true;
  }, [user]);

  const t = useCallback((key: string): string => {
    const dict = DICTIONARIES[language] || DICTIONARIES["pt-BR"];
    return dict[key] ?? DICTIONARIES["pt-BR"][key] ?? key;
  }, [language]);

  const fmt = useCallback((value: number | null | undefined) => {
    return formatMoney(value, currency, language);
  }, [currency, language]);

  const fmtShort = useCallback((value: number | null | undefined) => {
    return formatMoneyShort(value, currency, language);
  }, [currency, language]);

  const currencySymbol = getCurrencySymbol(currency);

  const value = useMemo(
    () => ({ language, currency, onboardingCompleted, setLanguage, setCurrency, completeOnboarding, t, fmt, fmtShort, currencySymbol }),
    [language, currency, onboardingCompleted, setLanguage, setCurrency, completeOnboarding, t, fmt, fmtShort, currencySymbol]
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
