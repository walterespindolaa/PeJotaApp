import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Check, Eye, AlertTriangle, Clock, Lightbulb, PartyPopper } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EnrichedAlert } from "@/hooks/usePaymentAlerts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: EnrichedAlert[];
  onDismiss: (eventId: string) => void;
}

const AlertsDrawer = ({ open, onOpenChange, alerts, onDismiss }: Props) => {
  const navigate = useNavigate();

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="flex items-center justify-between">
          <DrawerTitle className="font-heading flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Alertas de Vencimento
            {alerts.length > 0 && (
              <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>
            )}
          </DrawerTitle>
          <Button variant="ghost" size="sm" onClick={() => {
            onOpenChange(false);
            navigate("/dashboard/alertas");
          }}>
            Ver todos
          </Button>
        </DrawerHeader>
        <div className="px-4 pb-6 space-y-3 overflow-y-auto max-h-[60vh]">
          {alerts.length === 0 ? (
            <div className="text-center py-8">
              <Check className="h-10 w-10 text-success mx-auto mb-3" />
              <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5">Nenhum alerta pendente. Tudo em dia! <PartyPopper className="h-4 w-4" /></p>
            </div>
          ) : (
            alerts.slice(0, 10).map(alert => (
              <div key={alert.id} className={`p-3 rounded-xl border transition-all ${
                alert.isOverdue
                  ? "bg-destructive/5 border-destructive/20"
                  : alert.daysUntilDue <= 1
                  ? "bg-warning/5 border-warning/20"
                  : "bg-muted/30 border-border/40"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`p-1.5 rounded-lg flex-shrink-0 ${
                    alert.isOverdue ? "bg-destructive/10" : alert.daysUntilDue <= 1 ? "bg-warning/10" : "bg-primary/10"
                  }`}>
                    {alert.isOverdue ? <AlertTriangle className="h-4 w-4 text-destructive" /> :
                     alert.daysUntilDue <= 1 ? <Clock className="h-4 w-4 text-warning" /> :
                     <Bell className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium truncate">{alert.sourceName}</p>
                      <Badge variant="outline" className="text-[10px] px-1.5">{alert.sourceDetail}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                    {alert.linkedInvestmentName && (
                      <div className="flex items-center gap-1 mt-1.5">
                        <Lightbulb className="h-3 w-3 text-primary" />
                        <span className="text-[10px] text-primary font-medium">
                          Sugestão: usar {alert.linkedInvestmentName}
                        </span>
                      </div>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => onDismiss(alert.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default AlertsDrawer;
