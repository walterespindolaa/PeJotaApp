
ALTER TABLE public.investimentos_nao_financeiros
  ADD COLUMN IF NOT EXISTS tipo_renda text DEFAULT '',
  ADD COLUMN IF NOT EXISTS observacao_renda text DEFAULT '';
