import { useState, useEffect, useCallback } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as any).standalone === true;

const DISMISSED_KEY = "atlas-pwa-install-dismissed";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOS, setShowIOS] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (isStandalone()) return;

    const wasDismissed = sessionStorage.getItem(DISMISSED_KEY);
    if (wasDismissed) return;

    if (isIOS()) {
      setShowIOS(true);
      setDismissed(false);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDismissed(true);
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    sessionStorage.setItem(DISMISSED_KEY, "1");
  }, []);

  if (dismissed || (!deferredPrompt && !showIOS)) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-fade-in">
      <div className="rounded-2xl border border-border bg-card p-4 shadow-elevated flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
          {showIOS ? (
            <Share className="h-5 w-5 text-primary" />
          ) : (
            <Download className="h-5 w-5 text-primary" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground leading-tight">
            Instalar PeJota
          </p>
          {showIOS ? (
            <p className="text-xs text-muted-foreground mt-1 leading-snug font-body">
              Toque em{" "}
              <Share className="inline h-3.5 w-3.5 -mt-0.5" />{" "}
              e depois em <strong>"Adicionar à Tela de Início"</strong>.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1 font-body">
              Acesso rápido, direto da tela inicial.
            </p>
          )}

          {!showIOS && (
            <Button
              size="sm"
              onClick={handleInstall}
              className="mt-2 h-8 text-xs font-heading font-semibold"
            >
              Instalar Aplicativo
            </Button>
          )}
        </div>

        <button
          onClick={handleDismiss}
          aria-label="Fechar"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
