
CREATE TABLE public.upgrade_triggers_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trigger_key text NOT NULL,
  shown_count integer NOT NULL DEFAULT 0,
  last_shown_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, trigger_key)
);

ALTER TABLE public.upgrade_triggers_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own trigger logs"
  ON public.upgrade_triggers_log
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
