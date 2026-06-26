import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const RECHECK_INTERVAL_MS = 60 * 60 * 1000;

export default function PWAUpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const interval = setInterval(() => {
        registration.update().catch(() => {});
      }, RECHECK_INTERVAL_MS);
      return () => clearInterval(interval);
    },
    onRegisterError() {
      /* silent — sem PII em log */
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    document.documentElement.style.setProperty(
      "--pwa-update-banner-offset",
      "88px"
    );
    return () => {
      document.documentElement.style.removeProperty("--pwa-update-banner-offset");
    };
  }, [needRefresh]);

  if (!needRefresh) return null;

  return (
    <div
      className="fixed left-4 right-4 md:left-auto md:right-4 md:max-w-sm z-[60] animate-fade-in"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
    >
      <div className="rounded-2xl border border-border bg-card shadow-elevated p-4 flex items-start gap-3">
        <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground leading-tight">
            Nova versão do Atlas disponível
          </p>
          <p className="text-xs text-muted-foreground mt-1 leading-snug font-body">
            Atualize agora pra acessar as melhorias mais recentes.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={() => {
                // Ativa o novo service worker (skipWaiting). O reload normalmente
                // acontece via 'controllerchange', mas em alguns navegadores (iOS/web)
                // ele não dispara — então garantimos o reload por fallback.
                updateServiceWorker(true);
                setTimeout(() => window.location.reload(), 2000);
              }}
              className="h-8 text-xs font-heading font-semibold"
            >
              Atualizar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setNeedRefresh(false)}
              className="h-8 text-xs font-heading"
            >
              Depois
            </Button>
          </div>
        </div>
        <button
          onClick={() => setNeedRefresh(false)}
          aria-label="Fechar"
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
