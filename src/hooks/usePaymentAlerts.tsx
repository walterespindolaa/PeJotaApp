import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type PaymentAlert = {
  id: string;
  user_id: string;
  source_type: string;
  source_id: string;
  due_date: string;
  reminder_offsets: number[];
  custom_message: string | null;
  linked_investment_id: string | null;
  status: string;
  triggered_at: string | null;
  dismissed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentAlertEvent = {
  id: string;
  alert_id: string;
  user_id: string;
  offset_days: number;
  scheduled_for: string;
  sent_at: string | null;
  dismissed_at: string | null;
  message: string | null;
  created_at: string;
};

export type EnrichedAlert = PaymentAlertEvent & {
  alert: PaymentAlert;
  sourceName: string;
  sourceDetail: string;
  amount?: number;
  linkedInvestmentName?: string;
  daysUntilDue: number;
  isOverdue: boolean;
};

function defaultMessage(name: string, daysUntilDue: number, dueDate: string, linkedInvestmentName?: string): string {
  const dd = new Date(dueDate).toLocaleDateString("pt-BR");
  if (linkedInvestmentName) {
    return `Para pagar ${name}, considere usar ${linkedInvestmentName}. Quer ver seus investimentos?`;
  }
  if (daysUntilDue < 0) {
    return `${name} está em atraso desde ${dd}. Quer resolver agora?`;
  }
  if (daysUntilDue === 0) {
    return `${name} vence hoje (${dd}).`;
  }
  return `Seu pagamento de ${name} vence em ${daysUntilDue} dia(s) (venc.: ${dd}).`;
}

export const usePaymentAlerts = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<PaymentAlert[]>([]);
  const [events, setEvents] = useState<PaymentAlertEvent[]>([]);
  const [enrichedAlerts, setEnrichedAlerts] = useState<EnrichedAlert[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch alerts and today's events
    const today = new Date().toISOString().split("T")[0];
    const [alertsRes, eventsRes] = await Promise.all([
      supabase.from("payment_alerts" as any).select("*").eq("user_id", user.id).eq("status", "scheduled"),
      supabase.from("payment_alert_events" as any).select("*").eq("user_id", user.id).lte("scheduled_for", today).is("sent_at", null).is("dismissed_at", null),
    ]);

    const alertsData = (alertsRes.data as unknown as PaymentAlert[]) || [];
    const eventsData = (eventsRes.data as unknown as PaymentAlertEvent[]) || [];
    setAlerts(alertsData);
    setEvents(eventsData);

    // Enrich events with source names
    if (eventsData.length > 0) {
      const alertMap = new Map(alertsData.map(a => [a.id, a]));
      // Also fetch alerts for events that might not be in scheduled list
      const missingAlertIds = eventsData.filter(e => !alertMap.has(e.alert_id)).map(e => e.alert_id);
      if (missingAlertIds.length > 0) {
        const { data: moreAlerts } = await supabase.from("payment_alerts" as any).select("*").in("id", missingAlertIds);
        (moreAlerts as unknown as PaymentAlert[] || []).forEach(a => alertMap.set(a.id, a));
      }

      // Get source names
      const sourceIds = [...new Set([...alertMap.values()].map(a => a.source_id))];
      const [despRes, instRes, invRes] = await Promise.all([
        supabase.from("despesas").select("id,descricao,categoria,valor").in("id", sourceIds),
        supabase.from("installment_instances" as any).select("id,installment_id,installment_number,amount").in("id", sourceIds),
        supabase.from("investimentos_financeiros").select("id,nome,instituicao").eq("user_id", user.id),
      ]);

      const despMap = new Map((despRes.data || []).map((d: any) => [d.id, d]));
      const instMap = new Map(((instRes.data as unknown as any[]) || []).map((i: any) => [i.id, i]));
      const invMap = new Map((invRes.data || []).map((i: any) => [i.id, i]));

      // For installment instances, get parent despesa info
      const parentIds = [...new Set(((instRes.data as unknown as any[]) || []).map((i: any) => i.installment_id))];
      if (parentIds.length > 0) {
        const { data: parents } = await supabase.from("despesas").select("id,descricao,categoria,total_parcelas").in("id", parentIds);
        (parents || []).forEach((p: any) => despMap.set(p.id, p));
      }

      const enriched: EnrichedAlert[] = eventsData.map(event => {
        const alert = alertMap.get(event.alert_id)!;
        if (!alert) return null;
        const todayDate = new Date(today);
        const dueDate = new Date(alert.due_date);
        const daysUntilDue = Math.ceil((dueDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24));

        let sourceName = "Pagamento";
        let sourceDetail = "";
        let amount: number | undefined;

        if (alert.source_type === "installment_instance") {
          const inst = instMap.get(alert.source_id);
          if (inst) {
            const parent = despMap.get(inst.installment_id);
            sourceName = parent?.descricao || parent?.categoria || "Parcela";
            sourceDetail = `Parcela ${inst.installment_number}/${parent?.total_parcelas || "?"}`;
            amount = inst?.amount;
          }
        } else {
          const desp = despMap.get(alert.source_id);
          sourceName = desp?.descricao || desp?.categoria || "Despesa";
          sourceDetail = alert.source_type === "fixed_expense" ? "Despesa Fixa" :
            alert.source_type === "variable_expense" ? "Despesa Variável" : "Dívida";
          amount = desp?.valor;
        }

        const linkedInv = alert.linked_investment_id ? invMap.get(alert.linked_investment_id) : null;

        return {
          ...event,
          alert,
          sourceName,
          sourceDetail,
          amount,
          linkedInvestmentName: linkedInv ? `${linkedInv.nome} (${linkedInv.instituicao})` : undefined,
          daysUntilDue,
          isOverdue: daysUntilDue < 0,
          message: event.message || alert.custom_message || defaultMessage(
            sourceName, daysUntilDue, alert.due_date, linkedInv ? `${linkedInv.nome}` : undefined
          ),
        } as EnrichedAlert;
      }).filter(Boolean) as EnrichedAlert[];

      setEnrichedAlerts(enriched);
      setActiveCount(enriched.length);
    } else {
      setEnrichedAlerts([]);
      setActiveCount(0);
    }

    setLoading(false);
  }, [user]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Trigger due alerts (client-side engine)
  const triggerDueAlerts = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().split("T")[0];

    // Get all scheduled alerts
    const { data: scheduledAlerts } = await supabase
      .from("payment_alerts" as any).select("*")
      .eq("user_id", user.id).eq("status", "scheduled");

    const alerts = (scheduledAlerts as unknown as PaymentAlert[]) || [];

    for (const alert of alerts) {
      const dueDate = new Date(alert.due_date);
      const todayDate = new Date(today);

      for (const offset of alert.reminder_offsets) {
        const triggerDate = new Date(dueDate);
        triggerDate.setDate(triggerDate.getDate() - offset);
        const triggerStr = triggerDate.toISOString().split("T")[0];

        if (triggerStr <= today) {
          // Check if event already exists
          const { data: existing } = await supabase
            .from("payment_alert_events" as any).select("id")
            .eq("alert_id", alert.id).eq("offset_days", offset).limit(1);

          if (!existing || existing.length === 0) {
            await supabase.from("payment_alert_events" as any).insert({
              alert_id: alert.id,
              user_id: user.id,
              offset_days: offset,
              scheduled_for: triggerStr,
            } as any);
          }
        }
      }

      // Auto-mark overdue: if due_date < today and still scheduled, update
      if (dueDate < todayDate) {
        // Create a "0 days" event if not exists
        const { data: existing } = await supabase
          .from("payment_alert_events" as any).select("id")
          .eq("alert_id", alert.id).eq("offset_days", 0).limit(1);

        if (!existing || existing.length === 0) {
          await supabase.from("payment_alert_events" as any).insert({
            alert_id: alert.id,
            user_id: user.id,
            offset_days: 0,
            scheduled_for: alert.due_date,
          } as any);
        }
      }
    }

    await fetchAlerts();
  }, [user, fetchAlerts]);

  // Create or update alert for a source
  const upsertAlert = useCallback(async (params: {
    sourceType: string;
    sourceId: string;
    dueDate: string;
    reminderOffsets: number[];
    customMessage?: string;
    linkedInvestmentId?: string;
  }) => {
    if (!user) return;

    // Delete existing alert for this source
    await supabase.from("payment_alerts" as any)
      .delete().eq("user_id", user.id)
      .eq("source_id", params.sourceId);

    // Create new alert
    const { data: newAlert } = await supabase.from("payment_alerts" as any).insert({
      user_id: user.id,
      source_type: params.sourceType,
      source_id: params.sourceId,
      due_date: params.dueDate,
      reminder_offsets: params.reminderOffsets,
      custom_message: params.customMessage || null,
      linked_investment_id: params.linkedInvestmentId || null,
      status: "scheduled",
    } as any).select().single();

    if (newAlert) {
      // Pre-generate events for each offset
      const dueDate = new Date(params.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const offset of params.reminderOffsets) {
        const triggerDate = new Date(dueDate);
        triggerDate.setDate(triggerDate.getDate() - offset);
        const triggerStr = triggerDate.toISOString().split("T")[0];

        await supabase.from("payment_alert_events" as any).insert({
          alert_id: (newAlert as any).id,
          user_id: user.id,
          offset_days: offset,
          scheduled_for: triggerStr,
        } as any);
      }
    }

    await fetchAlerts();
  }, [user, fetchAlerts]);

  // Remove alert for a source
  const removeAlert = useCallback(async (sourceId: string) => {
    if (!user) return;
    await supabase.from("payment_alerts" as any)
      .delete().eq("user_id", user.id).eq("source_id", sourceId);
    await fetchAlerts();
  }, [user, fetchAlerts]);

  // Dismiss event
  const dismissEvent = useCallback(async (eventId: string) => {
    if (!user) return;
    await supabase.from("payment_alert_events" as any)
      .update({ dismissed_at: new Date().toISOString() } as any).eq("id", eventId);
    await fetchAlerts();
  }, [user, fetchAlerts]);

  // Mark alert as done (source was paid)
  const markAlertDone = useCallback(async (sourceId: string) => {
    if (!user) return;
    await supabase.from("payment_alerts" as any)
      .update({ status: "done", triggered_at: new Date().toISOString() } as any)
      .eq("user_id", user.id).eq("source_id", sourceId);
    await fetchAlerts();
  }, [user, fetchAlerts]);

  // Get alert config for a source
  const getAlertForSource = useCallback((sourceId: string): PaymentAlert | undefined => {
    return alerts.find(a => a.source_id === sourceId);
  }, [alerts]);

  return {
    alerts,
    events,
    enrichedAlerts,
    activeCount,
    loading,
    fetchAlerts,
    triggerDueAlerts,
    upsertAlert,
    removeAlert,
    dismissEvent,
    markAlertDone,
    getAlertForSource,
  };
};
