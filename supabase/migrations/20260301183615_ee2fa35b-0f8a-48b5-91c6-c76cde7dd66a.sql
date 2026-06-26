
-- Add columns to persist incluir_bens toggle and renda_passiva_atual
ALTER TABLE public.aposentadoria
  ADD COLUMN IF NOT EXISTS incluir_bens boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renda_passiva_atual numeric DEFAULT 0;
