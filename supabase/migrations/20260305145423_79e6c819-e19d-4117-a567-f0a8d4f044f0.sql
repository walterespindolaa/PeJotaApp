-- Weekly email preferences on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_email_day integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_email_hour integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS weekly_email_timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS last_weekly_email_sent_at timestamptz;

-- AI usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  questions_used integer NOT NULL DEFAULT 0,
  daily_limit integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai_usage"
  ON public.ai_usage FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);