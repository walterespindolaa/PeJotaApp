
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
