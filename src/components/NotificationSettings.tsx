import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, BellOff, BellRing, AlertTriangle, Smartphone, CheckCircle2, Send } from "lucide-react";
import { usePushNotifications, type PushStatus } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";

const STATUS_CONFIG: Record<PushStatus, { label: string; icon: React.ReactNode; color: string; description: string }> = {
  loading: { label: "Verificando...", icon: <Bell className="h-4 w-4 animate-pulse" />, color: "text-muted-foreground", description: "Verificando status das notificações..." },
  unsupported: { label: "Não suportado", icon: <AlertTriangle className="h-4 w-4" />, color: "text-warning", description: "Seu navegador ou dispositivo não suporta notificações push." },
  denied: { label: "Bloqueadas", icon: <BellOff className="h-4 w-4" />, color: "text-destructive", description: "As notificações foram bloqueadas. Para reativar, altere nas configurações do navegador." },
  active: { label: "Ativadas", icon: <BellRing className="h-4 w-4" />, color: "text-success", description: "Você receberá notificações de lembretes, alertas e novidades do PeJota." },
  inactive: { label: "Desativadas", icon: <BellOff className="h-4 w-4" />, color: "text-muted-foreground", description: "Ative para receber lembretes e alertas importantes." },
};

export default function NotificationSettings() {
  const { status, loading, subscribe, unsubscribe, sendTest, isSupported } = usePushNotifications();
  const { toast } = useToast();
  const [testSending, setTestSending] = useState(false);

  const cfg = STATUS_CONFIG[status];

  const handleActivate = async () => {
    const ok = await subscribe();
    if (ok) {
      toast({ title: "Notificações ativadas!", description: "Você agora receberá alertas do PeJota." });
    } else if (status === "denied") {
      toast({ title: "Permissão negada", description: "Altere nas configurações do navegador.", variant: "destructive" });
    }
  };

  const handleDeactivate = async () => {
    const ok = await unsubscribe();
    if (ok) {
      toast({ title: "Notificações desativadas", description: "Você não receberá mais alertas push." });
    }
  };

  const handleTest = async () => {
    setTestSending(true);
    const ok = await sendTest();
    setTestSending(false);
    if (ok) {
      toast({ title: "Notificação enviada!", description: "Verifique se recebeu a notificação de teste." });
    } else {
      toast({ title: "Falha no envio", description: "Tente novamente em alguns instantes.", variant: "destructive" });
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Bell className="h-5 w-5 text-primary" />
          Notificações Push
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/30">
          <div className={`flex-shrink-0 ${cfg.color}`}>
            {cfg.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-heading font-semibold">{cfg.label}</p>
              <Badge variant={status === "active" ? "default" : "outline"} className="text-[10px]">
                {status === "active" ? "ON" : "OFF"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{cfg.description}</p>
          </div>
        </div>

        {/* iOS info */}
        {!isSupported && /iPad|iPhone|iPod/.test(navigator.userAgent) && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/5 border border-warning/20">
            <Smartphone className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              No iPhone, instale o PeJota na tela de início primeiro. Depois, ative as notificações nas configurações do app.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {status === "inactive" && (
            <Button
              onClick={handleActivate}
              disabled={loading}
              className="flex-1"
              size="sm"
            >
              <BellRing className="h-4 w-4 mr-1.5" />
              {loading ? "Ativando..." : "Ativar Notificações"}
            </Button>
          )}

          {status === "active" && (
            <>
              <Button
                onClick={handleDeactivate}
                disabled={loading}
                variant="outline"
                className="flex-1"
                size="sm"
              >
                <BellOff className="h-4 w-4 mr-1.5" />
                {loading ? "Desativando..." : "Desativar"}
              </Button>
              <Button
                onClick={handleTest}
                disabled={testSending}
                variant="secondary"
                size="sm"
              >
                <Send className="h-4 w-4 mr-1.5" />
                {testSending ? "Enviando..." : "Testar"}
              </Button>
            </>
          )}
        </div>

        {status === "active" && (
          <div className="flex items-center gap-1.5 text-xs text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Pronto para receber notificações</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
