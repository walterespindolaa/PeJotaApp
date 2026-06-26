import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, AlertTriangle, Lightbulb, Rocket, ChevronRight, Check, X, Trash2, Megaphone, PartyPopper, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSmartNotifications, type NotifCategory } from "@/hooks/useSmartNotifications";
import { useAdminRecados } from "@/hooks/useAdminRecados";
import type { EnrichedAlert } from "@/hooks/usePaymentAlerts";

interface Props {
  paymentAlerts: EnrichedAlert[];
  onDismissPayment: (eventId: string) => void;
}

const CATEGORY_CONFIG: Record<NotifCategory, { label: string; icon: React.ReactNode; color: string }> = {
  lembrete: { label: "Lembretes", icon: <Calendar className="h-4 w-4" />, color: "text-info" },
  alerta: { label: "Alertas", icon: <AlertTriangle className="h-4 w-4" />, color: "text-warning" },
  insight: { label: "Insights", icon: <Lightbulb className="h-4 w-4" />, color: "text-success" },
  oportunidade: { label: "Oportunidades", icon: <Rocket className="h-4 w-4" />, color: "text-primary" },
};

const SmartNotificationsPopover = ({ paymentAlerts, onDismissPayment }: Props) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { byCategory, totalCount, unreadCount, markRead, markAllRead, dismissNotif, clearCategory, clearAll } = useSmartNotifications();
  const { recados, unreadCount: recadosUnread, markAsRead: markRecadoRead, dismiss: dismissRecado, dismissAll: dismissAllRecados } = useAdminRecados();

  const categories: NotifCategory[] = ["alerta", "lembrete", "insight", "oportunidade"];

  const handleCTA = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const handleRecadoCTA = (recado: typeof recados[number]) => {
    markRecadoRead(recado.id);
    if (!recado.cta_url) return;
    const url = recado.cta_url;
    if (url.startsWith("/")) {
      setOpen(false);
      navigate(url);
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  const allCount = totalCount + paymentAlerts.length + recados.length;
  const badgeCount = unreadCount + paymentAlerts.length + recadosUnread;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground relative">
          <Bell className="h-5 w-5" />
          {badgeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-heading font-bold flex items-center justify-center">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[380px] max-w-[calc(100vw-2rem)] p-0 shadow-elevated"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <p className="text-sm font-heading font-bold">Notificações Atlas</p>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-[9px] px-1.5 h-4">{unreadCount}</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-[11px] h-7" onClick={markAllRead}>
                <Check className="h-3 w-3 mr-1" /> Ler tudo
              </Button>
            )}
            {allCount > 0 && (
              <Button variant="ghost" size="sm" className="text-[11px] h-7 text-muted-foreground" onClick={clearAll}>
                <Trash2 className="h-3 w-3 mr-1" /> Limpar
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        {allCount === 0 ? (
          <div className="py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Nenhuma notificação no momento.</p>
            <p className="text-xs text-muted-foreground/60 mt-1 inline-flex items-center gap-1.5">Seus dados estão em dia! <PartyPopper className="h-3.5 w-3.5" /></p>
          </div>
        ) : (
          <div className="max-h-[70vh] overflow-y-auto overscroll-contain">
            <div className="p-3 space-y-4">
              {/* Admin recados */}
              {recados.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Megaphone className="h-3.5 w-3.5 text-primary" />
                      <p className="text-[10px] uppercase tracking-[0.15em] font-heading font-bold text-muted-foreground">Recados</p>
                      <Badge variant="outline" className="text-[9px] px-1.5">{recados.length}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="text-[10px] h-6 text-muted-foreground/60" onClick={dismissAllRecados}>
                      Limpar
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {recados.map(recado => (
                      <div
                        key={recado.id}
                        className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                          recado.read_at
                            ? "border-border/20 bg-card/50 opacity-70"
                            : "border-border/30 bg-card/80 hover:bg-muted/30"
                        }`}
                        onClick={() => markRecadoRead(recado.id)}
                      >
                        <div className="flex items-start gap-2.5">
                          <Megaphone className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className={`text-sm font-heading ${recado.read_at ? "font-medium text-foreground/60" : "font-semibold text-foreground/90"}`}>{recado.title}</p>
                              {!recado.read_at && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed whitespace-pre-wrap">{recado.body}</p>
                            {recado.cta_label && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleRecadoCTA(recado); }}
                                className="flex items-center gap-1 text-[11px] text-primary font-medium mt-1.5 hover:underline"
                              >
                                {recado.cta_label}
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 flex-shrink-0"
                            onClick={(e) => { e.stopPropagation(); dismissRecado(recado.id); }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Payment alerts */}
              {paymentAlerts.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-warning" />
                    <p className="text-[10px] uppercase tracking-[0.15em] font-heading font-bold text-muted-foreground">Vencimentos</p>
                    <Badge variant="outline" className="text-[9px] px-1.5">{paymentAlerts.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {paymentAlerts.slice(0, 3).map(alert => (
                      <div key={alert.id} className={`p-3 rounded-xl border ${
                        alert.isOverdue ? "bg-destructive/5 border-destructive/20" :
                        alert.daysUntilDue <= 1 ? "bg-warning/5 border-warning/20" :
                        "bg-muted/30 border-border/40"
                      }`}>
                        <div className="flex items-start gap-2">
                          <span className="text-sm mt-0.5">{alert.isOverdue ? <Circle className="h-3 w-3 fill-destructive text-destructive" /> : <Calendar className="h-3.5 w-3.5 text-muted-foreground" />}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{alert.sourceName}</p>
                            <p className="text-xs text-muted-foreground">{alert.message}</p>
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => onDismissPayment(alert.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Smart notifications by category */}
              {categories.map(cat => {
                const items = byCategory(cat);
                if (items.length === 0) return null;
                const cfg = CATEGORY_CONFIG[cat];

                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={cfg.color}>{cfg.icon}</span>
                        <p className="text-[10px] uppercase tracking-[0.15em] font-heading font-bold text-muted-foreground">{cfg.label}</p>
                        <Badge variant="outline" className="text-[9px] px-1.5">{items.length}</Badge>
                      </div>
                      <Button variant="ghost" size="sm" className="text-[10px] h-6 text-muted-foreground/60" onClick={() => clearCategory(cat)}>
                        Limpar
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {items.map(notif => (
                        <div
                          key={notif.id}
                          className={`p-3 rounded-xl border transition-colors cursor-pointer ${
                            notif.read
                              ? "border-border/20 bg-card/50 opacity-70"
                              : "border-border/30 bg-card/80 hover:bg-muted/30"
                          }`}
                          onClick={() => markRead(notif.id)}
                        >
                          <div className="flex items-start gap-2.5">
                            <span className="text-base mt-0.5">{notif.icon}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-heading ${notif.read ? "font-medium text-foreground/60" : "font-semibold text-foreground/90"}`}>{notif.title}</p>
                                {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.description}</p>
                              {notif.cta && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleCTA(notif.cta!.path); }}
                                  className="flex items-center gap-1 text-[11px] text-primary font-medium mt-1.5 hover:underline"
                                >
                                  {notif.cta.label}
                                  <ChevronRight className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                            <Button
                              variant="ghost" size="icon"
                              className="h-6 w-6 flex-shrink-0"
                              onClick={(e) => { e.stopPropagation(); dismissNotif(notif.id); }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default SmartNotificationsPopover;
