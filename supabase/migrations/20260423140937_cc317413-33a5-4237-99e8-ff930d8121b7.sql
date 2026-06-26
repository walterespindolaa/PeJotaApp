-- 1. Remove coluna skipped_months adicionada por engano
ALTER TABLE public.despesas DROP COLUMN IF EXISTS skipped_months;

-- 2. Habilita RLS na tabela despesas_skip
ALTER TABLE public.despesas_skip ENABLE ROW LEVEL SECURITY;

-- 3. Cria policies (SELECT, INSERT, DELETE) para o próprio usuário
DROP POLICY IF EXISTS "Users can view own skips" ON public.despesas_skip;
CREATE POLICY "Users can view own skips"
  ON public.despesas_skip
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own skips" ON public.despesas_skip;
CREATE POLICY "Users can insert own skips"
  ON public.despesas_skip
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own skips" ON public.despesas_skip;
CREATE POLICY "Users can delete own skips"
  ON public.despesas_skip
  FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Cria index para queries por user + mês
CREATE INDEX IF NOT EXISTS idx_despesas_skip_user_month
  ON public.despesas_skip (user_id, month_ref);