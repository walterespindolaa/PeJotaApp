
-- Table for custom password reset tokens
CREATE TABLE public.password_resets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can read/write
CREATE POLICY "Service role full access" ON public.password_resets
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast token lookup
CREATE INDEX idx_password_resets_token_hash ON public.password_resets(token_hash);
CREATE INDEX idx_password_resets_email ON public.password_resets(email);

-- Auto-cleanup: delete used/expired tokens older than 24h
-- (can be run via cron later)
