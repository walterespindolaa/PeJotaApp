export type SupportedCurrency = "BRL" | "USD" | "EUR" | "GBP";
export type SupportedLanguage = "pt-BR" | "en" | "es";

const LOCALE_MAP: Record<SupportedLanguage, string> = {
  "pt-BR": "pt-BR",
  en: "en-US",
  es: "es-ES",
};

/**
 * Format a numeric value as currency string.
 * NO conversion — purely visual formatting.
 */
export function formatMoney(
  value: number | null | undefined,
  currency: SupportedCurrency = "BRL",
  language: SupportedLanguage = "pt-BR"
): string {
  const v = value ?? 0;
  const locale = LOCALE_MAP[language] || "pt-BR";
  try {
    return v.toLocaleString(locale, { style: "currency", currency });
  } catch {
    return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }
}

/**
 * Short format for chart axes / compact display.
 */
export function formatMoneyShort(
  value: number | null | undefined,
  currency: SupportedCurrency = "BRL",
  language: SupportedLanguage = "pt-BR"
): string {
  const v = value ?? 0;
  const symbol = CURRENCY_SYMBOLS[currency] || currency;
  if (Math.abs(v) >= 1_000_000) return `${symbol} ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${symbol} ${(v / 1_000).toFixed(0)}k`;
  return formatMoney(v, currency, language);
}

const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
  BRL: "R$",
  USD: "$",
  EUR: "€",
  GBP: "£",
};

export function getCurrencySymbol(currency: SupportedCurrency): string {
  return CURRENCY_SYMBOLS[currency] || currency;
}
