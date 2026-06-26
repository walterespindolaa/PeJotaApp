import { useState } from "react";
import { Bell, BellRing, X, Share, PlusSquare, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePushPrompt } from "@/hooks/usePushPrompt";
import { useToast } from "@/hooks/use-toast";

function isIOS(): boolean {
  return typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  return (
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true)
  );
}

export default function PushPermissionPrompt() {
  const { visible, dismiss, markConverted, markDenied } = usePushPrompt();
  const { subscribe, isSupported } = usePushNotifications();
  const { toast } = useToast();
  const [activating, setActivating] = useState(false);

  if (!visible) return null;

  const iosNotInstalled = isIOS() && !isStandalone();

  const handleActivate = async () => {
    if (iosNotInstalled) {
      // Can't activate on iOS Safari — just dismiss and show the instructions
      dismiss();
      return;
    }

    setActivating(true);
    const ok = await subscribe();
    setActivating(false);

    if (ok) {
      markConverted();
      toast({
        title: "Notificações ativadas!",
        description: "Você receberá alertas importantes do Atlas.",
      });
    } else {
      // User denied at browser level
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        markDenied();
        toast({
          title: "Permissão negada",
          description: "Você pode reativar nas configurações do navegador.",
          variant: "destructive",
        });
      } else {
        dismiss();
      }
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-500 md:left-auto md:right-6 md:bottom-6">
      <div className="relative rounded-2xl border border-border/50 bg-card shadow-xl p-5 backdrop-blur-sm">
        {/* Close button */}
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>

        {iosNotInstalled ? (
          /* iOS install instructions */
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-heading font-bold text-foreground pr-6">
                Instale o Atlas no iPhone
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Para receber notificações no iPhone, primeiro instale o Atlas na tela de início:
            </p>
            <ol className="text-xs text-muted-foreground space-y-2 pl-1">
              <li className="flex items-start gap-2">
                <Share className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <span>Toque no botão <strong>Compartilhar</strong> do Safari</span>
              </li>
              <li className="flex items-start gap-2">
                <PlusSquare className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <span>Escolha <strong>"Adicionar à Tela de Início"</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <Bell className="h-4 w-4 flex-shrink-0 text-primary mt-0.5" />
                <span>Abra o Atlas pelo ícone e ative as notificações</span>
              </li>
            </ol>
            <Button variant="outline" size="sm" className="w-full mt-2" onClick={dismiss}>
              Entendi
            </Button>
          </div>
        ) : (
          /* Standard pre-permission prompt */
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <BellRing className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-heading font-bold text-foreground pr-6">
                Ative os lembretes do Atlas
              </h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Receba alertas sobre metas, vencimentos, lembretes e novidades do Atlas. Você pode desativar quando quiser.
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1"
                onClick={handleActivate}
                disabled={activating || !isSupported}
              >
                <Bell className="h-4 w-4 mr-1.5" />
                {activating ? "Ativando..." : "Ativar notificações"}
              </Button>
              <Button variant="ghost" size="sm" onClick={dismiss} className="text-muted-foreground">
                Agora não
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
