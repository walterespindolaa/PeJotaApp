-- Consentimento de marketing (LGPD): registra opt-in, quando foi dado e de onde veio.
-- Usado pelo futuro painel admin de e-mail marketing para segmentar a base por consentimento.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_opt_in_source text;

COMMENT ON COLUMN public.profiles.marketing_opt_in IS 'Usuario aceitou receber comunicacoes de marketing.';
COMMENT ON COLUMN public.profiles.marketing_opt_in_at IS 'Data/hora em que o consentimento de marketing foi registrado.';
COMMENT ON COLUMN public.profiles.marketing_opt_in_source IS 'Origem do consentimento (ex: checkout, comece, configuracoes).';
