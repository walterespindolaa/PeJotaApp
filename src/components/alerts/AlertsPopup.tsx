import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Clock, X, Lightbulb } from "lucide-react";
import type { EnrichedAlert } from "@/hooks/usePaymentAlerts";

interface Props {
  alerts: EnrichedAlert[];
  onDismiss: (eventId: string) => void;
}

const AlertsPopup = ({ alerts, onDismiss }: Props) => {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (alerts.length > 0 && !dismissed) {
      // Show popup after 1 second on login
      const timer = setTimeout(() => setOpen(true), 1000);
      return () => clearTimeout(timer);
    }
  }, [alerts.length, dismissed]);

  const handleClose = () => {
    setOpen(false);
    setDismissed(true);
  };

  if (alerts.length === 0) return null;

  const urgent = alerts.filter(a => a.isOverdue || a.daysUntilDue <= 1);
  const upcoming = alerts.filter(a => !a.isOverdue && a.daysUntilDue > 1).slice(0, 3);
  const display = [...urgent, ...upcoming].slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); else setOpen(v); }}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading flex items-center gap-2">
            <Bell className="h-5 w-5 text-warning" />
            Alertas de Vencimento
            <Badge variant="destructive" className="text-xs">{alerts.length}</Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[50vh] overflow-y-auto">
          {display.map(alert => (
            <div key={alert.id} className={`p-3 rounded-xl border ${
              alert.isOverdue ? "bg-destructive/5 border-destructive/20" :
              alert.daysUntilDue <= 1 ? "bg-warning/5 border-warning/20" :
              "bg-muted/30 border-border/40"
            }`}>
              <div className="flex items-start gap-2">
                {alert.isOverdue ? <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" /> :
                 <Clock className="h-4 w-4 text-warning mt-0.5" />}
                <div className="flex-1">
                  <p className="text-sm font-medium">{alert.sourceName}</p>
                  <p className="text-xs text-muted-foreground">{alert.message}</p>
                  {alert.linkedInvestmentName && (
                    <p className="text-[10px] text-primary mt-1 flex items-center gap-1">
                      <Lightbulb className="h-3 w-3" /> Sugestão: usar {alert.linkedInvestmentName}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDismiss(alert.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button onClick={handleClose} variant="outline" className="w-full">Entendi</Button>
      </DialogContent>
    </Dialog>
  );
};

export default AlertsPopup;
