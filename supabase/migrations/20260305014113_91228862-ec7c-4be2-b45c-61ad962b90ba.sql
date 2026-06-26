
-- 1) Rate limit table
CREATE TABLE public.user_rate_limits (
  user_id uuid NOT NULL PRIMARY KEY,
  minute_key text NOT NULL DEFAULT '',
  minute_count int NOT NULL DEFAULT 0,
  day_key text NOT NULL DEFAULT '',
  day_count int NOT NULL DEFAULT 0,
  ai_minute_key text NOT NULL DEFAULT '',
  ai_minute_count int NOT NULL DEFAULT 0,
  ai_day_key text NOT NULL DEFAULT '',
  ai_day_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_rate_limits_day_key ON public.user_rate_limits(day_key);
CREATE INDEX idx_user_rate_limits_minute_key ON public.user_rate_limits(minute_key);

ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits" ON public.user_rate_limits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rate limits" ON public.user_rate_limits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rate limits" ON public.user_rate_limits
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2) Fingerprint v2 columns on credit_card_statements
ALTER TABLE public.credit_card_statements
  ADD COLUMN IF NOT EXISTS statement_fingerprint_v2 text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS top5_signature text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_statements_fingerprint_v2
  ON public.credit_card_statements(user_id, statement_fingerprint_v2)
  WHERE statement_fingerprint_v2 IS NOT NULL;

-- 3) Idempotency key on statement lines
ALTER TABLE public.credit_card_statement_lines
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lines_idempotency_key
  ON public.credit_card_statement_lines(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
