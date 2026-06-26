
-- Payment alerts table
CREATE TABLE public.payment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'fixed_expense',
  source_id uuid NOT NULL,
  due_date date NOT NULL,
  reminder_offsets integer[] NOT NULL DEFAULT '{7,3,1}',
  custom_message text,
  linked_investment_id uuid,
  status text NOT NULL DEFAULT 'scheduled',
  triggered_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment_alerts" ON public.payment_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own payment_alerts" ON public.payment_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payment_alerts" ON public.payment_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payment_alerts" ON public.payment_alerts FOR DELETE USING (auth.uid() = user_id);

-- Payment alert events (one per offset to avoid duplicates)
CREATE TABLE public.payment_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.payment_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  offset_days integer NOT NULL,
  scheduled_for date NOT NULL,
  sent_at timestamptz,
  dismissed_at timestamptz,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert_events" ON public.payment_alert_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own alert_events" ON public.payment_alert_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alert_events" ON public.payment_alert_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alert_events" ON public.payment_alert_events FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_payment_alerts_user_status ON public.payment_alerts(user_id, status);
CREATE INDEX idx_payment_alert_events_scheduled ON public.payment_alert_events(user_id, scheduled_for);
