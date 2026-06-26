import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TERMS_VERSION } from "@/lib/legal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { logError } from "@/lib/log";

const PUBLIC_ROUTES = ["/termos-de-uso", "/politica-de-privacidade"];

type GateState = "loading" | "accepted" | "needs_acceptance";

export default function TermsAcceptanceGate() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();

  const [state, setState] = useState<GateState>("loading");
  const [agreeChecked, setAgreeChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const acceptedRef = useRef(false); // Prevents re-check after accept in same session

  const isDashboard = location.pathname.startsWith("/dashboard");
  const shouldCheck = !!user && isDashboard && !acceptedRef.current;

  useEffect(() => {
    if (!shouldCheck) {
      // Don't show modal for non-dashboard or unauthenticated routes
      if (state !== "accepted" && !acceptedRef.current) setState("loading");
      return;
    }

    let cancelled = false;

    const check = async () => {
      setState("loading");

      try {
        const { data, error } = await supabase
          .from("user_terms_acceptance")
          .select("id")
          .eq("user_id", user!.id)
          .eq("terms_version", TERMS_VERSION)
          .maybeSingle();

        if (cancelled) return;

        if (data && !error) {
          acceptedRef.current = true;
          setState("accepted");
        } else {
          setState("needs_acceptance");
        }
      } catch (err) {
        if (!cancelled) {
          logError("[TermsGate] Query error:", err);
          setState("needs_acceptance");
        }
      }
    };

    check();
    return () => { cancelled = true; };
    // Only re-check when user id changes (login/logout), not on every route change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isDashboard]);

  const handleAccept = async () => {
    if (!user || !agreeChecked || saving) return;
    setSaving(true);

    // Insere direto na tabela (sem edge function, que não existe no Supabase novo).
    try {
      const { error } = await supabase
        .from("user_terms_acceptance")
        .upsert(
          {
            user_id: user.id,
            terms_version: TERMS_VERSION,
            accepted_at: new Date().toISOString(),
            ip_address: null,
            user_agent: navigator.userAgent,
          },
          { onConflict: "user_id,terms_version" }
        );
      if (error) logError("[TermsGate] Insert falhou (seguindo mesmo assim):", error);
    } catch (err) {
      logError("[TermsGate] Erro inesperado (seguindo mesmo assim):", err);
    }

    // Libera o acesso após o aceite, mesmo se o registro falhar (não trava o usuário).
    acceptedRef.current = true;
    setState("accepted");
    setAgreeChecked(false);
    window.dispatchEvent(new Event("atlas:terms-accepted"));
    setSaving(false);
  };

  // Don't render modal for: auth loading, non-dashboard, already accepted, or still checking
  if (authLoading || !isDashboard || !user || state !== "needs_acceptance") return null;

  return (
    <Dialog open>
      <DialogContent
        className="sm:max-w-xl"
        hideCloseButton
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl font-heading">Antes de continuar</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
          <p>
            Para utilizar a plataforma PeJota é necessário aceitar nossos Termos de Uso e Política de Privacidade.
          </p>
          <p>
            A plataforma utiliza tecnologias de análise automatizada e inteligência artificial para geração de relatórios e projeções financeiras com base nas informações fornecidas pelo usuário.
          </p>
          <p>Ao continuar, você declara estar ciente e de acordo com essas condições.</p>
        </div>

        <div className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
          <Checkbox
            id="accept-terms"
            checked={agreeChecked}
            onCheckedChange={(v) => setAgreeChecked(Boolean(v))}
            className="mt-0.5"
          />
          <label htmlFor="accept-terms" className="text-sm leading-relaxed text-foreground cursor-pointer">
            Li e concordo com os{" "}
            <Link to="/termos-de-uso" target="_blank" className="text-primary underline underline-offset-2">
              Termos de Uso
            </Link>{" "}
            e{" "}
            <Link to="/politica-de-privacidade" target="_blank" className="text-primary underline underline-offset-2">
              Política de Privacidade
            </Link>
            .
          </label>
        </div>

        <Button className="w-full" disabled={!agreeChecked || saving} onClick={handleAccept}>
          {saving ? "Registrando..." : "ACEITAR E CONTINUAR"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
