import { usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useI18n } from "@/contexts/I18nContext";

const MASK = "••••";

/** Hook that returns privacy-aware formatting functions using i18n context. */
export const usePrivacyFmt = () => {
  const { isPrivate } = usePrivacyMode();
  const { fmt: i18nFmt, fmtShort: i18nFmtShort } = useI18n();
  return {
    fmt: (v: number | null | undefined) =>
      isPrivate ? MASK : i18nFmt(v),
    pct: (v: number | null | undefined, decimals = 2) =>
      isPrivate ? MASK : `${(v ?? 0).toFixed(decimals).replace(".", ",")}%`,
    fmtShort: (v: number | null | undefined) => {
      if (isPrivate) return MASK;
      return i18nFmtShort(v);
    },
    isPrivate,
  };
};

interface PrivacyValueProps {
  children: React.ReactNode;
  mask?: string;
  className?: string;
}

export const PrivacyValue: React.FC<PrivacyValueProps> = ({ children, mask = MASK, className }) => {
  const { isPrivate } = usePrivacyMode();
  if (isPrivate) return <span className={className}>{mask}</span>;
  return <>{children}</>;
};

export const MoneyValue: React.FC<{ value: number; className?: string }> = ({ value, className }) => {
  const { isPrivate } = usePrivacyMode();
  const { fmt } = useI18n();
  if (isPrivate) return <span className={className}>{MASK}</span>;
  return <span className={className}>{fmt(value)}</span>;
};

export const PercentValue: React.FC<{ value: number; decimals?: number; className?: string }> = ({ value, decimals = 1, className }) => {
  const { isPrivate } = usePrivacyMode();
  if (isPrivate) return <span className={className}>{MASK}</span>;
  return <span className={className}>{value.toFixed(decimals)}%</span>;
};

export default PrivacyValue;
