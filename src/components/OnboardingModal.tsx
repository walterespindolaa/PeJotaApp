import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n } from "@/contexts/I18nContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { SupportedCurrency, SupportedLanguage } from "@/lib/formatMoney";
import { logError } from "@/lib/log";

const LANGUAGE_OPTIONS: { value: SupportedLanguage; label: string }[] = [
  { value: "pt-BR", label: "Português" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
];

const CURRENCY_OPTIONS: { value: SupportedCurrency; label: string }[] = [
  { value: "BRL", label: "Real (BRL - R$)" },
  { value: "USD", label: "Dollar (USD - $)" },
  { value: "EUR", label: "Euro (EUR - €)" },
  { value: "GBP", label: "Pound (GBP - £)" },
];

export default function OnboardingModal() {
  const { onboardingCompleted, completeOnboarding, t } = useI18n();
  const { user, isRecovery } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [fullName, setFullName] = useState("");
  const [lang, setLang] = useState<SupportedLanguage>("pt-BR");
  const [cur, setCur] = useState<SupportedCurrency>("BRL");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  // Don't show during recovery flow or on reset pages
  const isResetRoute = location.pathname.includes("/auth/reset") || location.pathname.includes("/reset-password");
  if (isRecovery || isResetRoute) return null;

  // Defense: never show modal when there is no authenticated user
  if (!user) return null;

  // Don't show if still loading (null) or already completed
  if (onboardingCompleted !== false) return null;

  const validateName = (name: string): boolean => {
    const trimmed = name.trim();
    if (trimmed.length < 3) return false;
    const words = trimmed.split(/\s+/).filter(w => w.length > 0);
    return words.length >= 2;
  };

  const handleSave = async () => {
    if (!validateName(fullName)) {
      setNameError(t("onboarding.nome_erro"));
      return;
    }
    setNameError("");
    setSaving(true);
    const result = await completeOnboarding(fullName, lang, cur);
    setSaving(false);
    if (result === true) {
      toast({ title: t("toast.preferencias_salvas") });
    } else {
      const errorMsg = typeof result === "string" ? result : "Não conseguimos salvar suas preferências. Tente novamente.";
      logError("[Onboarding] Error:", errorMsg);
      toast({ title: errorMsg, variant: "destructive" });
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">{t("onboarding.titulo")}</DialogTitle>
          <DialogDescription>{t("onboarding.subtitulo")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>{t("onboarding.nome_completo")}</Label>
            <Input
              value={fullName}
              onChange={(e) => { setFullName(e.target.value); setNameError(""); }}
              placeholder={t("onboarding.nome_placeholder")}
            />
            {nameError && <p className="text-xs text-destructive">{nameError}</p>}
          </div>

          <div className="space-y-2">
            <Label>{t("onboarding.idioma")}</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as SupportedLanguage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("onboarding.moeda")}</Label>
            <Select value={cur} onValueChange={(v) => setCur(v as SupportedCurrency)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{t("onboarding.salvando")}</> : t("onboarding.salvar")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
