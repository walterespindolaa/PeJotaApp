CREATE TABLE IF NOT EXISTS public.rate_limit_register (
  ip_key TEXT PRIMARY KEY,
  hour_key TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rate_limit_register ENABLE ROW LEVEL SECURITY;

-- Nenhuma policy RLS — só service_role acessa (Edge Function usa serviceRoleKey)
COMMENT ON TABLE public.rate_limit_register IS 'Rate limiting for trial registration by IP';
