
-- Notification history: records every push sent
CREATE TABLE public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_slug text NOT NULL,
  source_ref text DEFAULT NULL,
  title text NOT NULL,
  message text NOT NULL,
  route text NOT NULL DEFAULT '/dashboard',
  priority text NOT NULL DEFAULT 'medium',
  block text NOT NULL DEFAULT 'habito',
  delivery_status text NOT NULL DEFAULT 'sent',
  error_message text DEFAULT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification_history"
  ON public.notification_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can manage notification_history"
  ON public.notification_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_notif_history_user_slug ON public.notification_history (user_id, notification_slug);
CREATE INDEX idx_notif_history_sent_at ON public.notification_history (sent_at);

-- Notification preferences: per-user category toggles
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification_preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
