
CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  platform text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_reason text,
  UNIQUE (endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push_subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service can manage all push_subscriptions"
  ON public.push_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
