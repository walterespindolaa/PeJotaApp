import { usePaymentAlerts, type EnrichedAlert } from "@/hooks/usePaymentAlerts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle, Clock, Check, X, Lightbulb, RefreshCw, AlertCircle, Calendar } from "lucide-react";
import { usePrivacyFmt } from "@/components/PrivacyValue";

const Alertas = () => {
  const { enrichedAlerts, loading, dismissEvent, triggerDueAlerts, fetchAlerts } = usePaymentAlerts();
  const { fmt } = usePrivacyFmt();

  const overdue = enrichedAlerts.filter(a => a.isOverdue);
  const today = enrichedAlerts.filter(a => a.daysUntilDue === 0 && !a.isOverdue);
  const upcoming = enrichedAlerts.filter(a => a.daysUntilDue > 0);

  const handleRefresh = async () => {
    await triggerDueAlerts();
  };

  if (loading) {
    return <div className="flex items-center justify-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  const renderAlert = (alert: EnrichedAlert) => (
    <Card key={alert.id} className={`shadow-soft transition-all ${
      alert.isOverdue ? "border-destructive/30" : alert.daysUntilDue <= 1 ? "border-warning/30" : ""
    }`}>
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`p-2 rounded-xl flex-shrink-0 ${
          alert.isOverdue ? "bg-destructive/10" : alert.daysUntilDue <= 1 ? "bg-warning/10" : "bg-primary/10"
        }`}>
          {alert.isOverdue ? <AlertTriangle className="h-5 w-5 text-destructive" /> :
           alert.daysUntilDue <= 1 ? <Clock className="h-5 w-5 text-warning" /> :
           <Bell className="h-5 w-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-heading font-bold">{alert.sourceName}</p>
            <Badge variant="outline" className="text-[10px] px-1.5">{alert.sourceDetail}</Badge>
            {alert.isOverdue && <Badge variant="destructive" className="text-[10px]">Em atraso</Badge>}
            {alert.daysUntilDue === 0 && !alert.isOverdue && <Badge className="text-[10px] bg-warning text-warning-foreground">Vence hoje</Badge>}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
          {alert.linkedInvestmentName && (
            <div className="flex items-center gap-1 mt-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
              <Lightbulb className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs text-primary font-medium">
                Sugestão: usar {alert.linkedInvestmentName} para cobrir este pagamento
              </span>
            </div>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">
            Vencimento: {new Date(alert.alert.due_date).toLocaleDateString("pt-BR")} · 
            Alerta: {alert.offset_days > 0 ? `${alert.offset_days} dias antes` : "No vencimento"}
          </p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => dismissEvent(alert.id)} title="Dispensar">
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Alertas de Vencimento
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Acompanhe vencimentos e evite atrasos.</p>
        </div>
        <Button variant="outline" onClick={handleRefresh} className="gap-2">
          <RefreshCw className="h-4 w-4" /> Atualizar
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="shadow-soft border-destructive/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Em atraso</p>
            <p className="text-2xl font-heading font-bold text-destructive">{overdue.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft border-warning/20">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Vence hoje</p>
            <p className="text-2xl font-heading font-bold text-warning">{today.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">Próximos</p>
            <p className="text-2xl font-heading font-bold text-primary">{upcoming.length}</p>
          </CardContent>
        </Card>
      </div>

      {enrichedAlerts.length === 0 ? (
        <Card className="shadow-soft">
          <CardContent className="p-8 text-center">
            <Check className="h-12 w-12 text-success mx-auto mb-3" />
            <p className="text-lg font-heading font-bold text-success">Tudo em dia!</p>
            <p className="text-sm text-muted-foreground mt-1">Nenhum alerta de vencimento pendente.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {overdue.length > 0 && (
            <div>
              <p className="text-sm font-heading font-bold text-destructive mb-2 flex items-center gap-1.5"><AlertCircle className="h-4 w-4" /> Em atraso</p>
              <div className="space-y-2">{overdue.map(renderAlert)}</div>
            </div>
          )}
          {today.length > 0 && (
            <div>
              <p className="text-sm font-heading font-bold text-warning mb-2 flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" /> Vence hoje</p>
              <div className="space-y-2">{today.map(renderAlert)}</div>
            </div>
          )}
          {upcoming.length > 0 && (
            <div>
              <p className="text-sm font-heading font-bold text-foreground mb-2 flex items-center gap-1.5"><Calendar className="h-4 w-4" /> Próximos</p>
              <div className="space-y-2">{upcoming.map(renderAlert)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Alertas;
