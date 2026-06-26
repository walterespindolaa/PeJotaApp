-- Add ex_date column to proventos_investimentos for BRAPI-imported dividends.
-- Existing rows without ex_date stay NULL (rendered as "—" in UI).

ALTER TABLE public.proventos_investimentos
  ADD COLUMN IF NOT EXISTS ex_date date;

COMMENT ON COLUMN public.proventos_investimentos.ex_date IS
  'Ex-dividend date (data EX) — populated automatically from BRAPI imports. Manual entries leave it NULL.';
