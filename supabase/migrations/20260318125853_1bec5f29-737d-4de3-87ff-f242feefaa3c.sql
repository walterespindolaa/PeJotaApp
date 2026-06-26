CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_minute_key text,
  ai_minute_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rate limits" ON public.user_rate_limits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on rate limits" ON public.user_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);