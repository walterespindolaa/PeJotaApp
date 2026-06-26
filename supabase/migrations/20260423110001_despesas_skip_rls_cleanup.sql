-- Cleanup + RLS pra tabela despesas_skip (criada manualmente via SQL Editor).
-- Também dropa a coluna despesas.skipped_months adicionada por engano — fonte
-- única de verdade passa a ser a tabela despesas_skip.

-- 1) Drop coluna duplicada em despesas (se existir)
ALTER TABLE despesas DROP COLUMN IF EXISTS skipped_months;

-- 2) RLS na despesas_skip
ALTER TABLE despesas_skip ENABLE ROW LEVEL SECURITY;

-- Policy: user vê só skips dele próprio + household shared
DROP POLICY IF EXISTS "Users can view own despesas_skip" ON despesas_skip;
CREATE POLICY "Users can view own despesas_skip"
  ON despesas_skip FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM household_members hm1
      JOIN household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = despesas_skip.user_id
    )
  );

-- Policy: user insere skip só pra próprios dados (ou membros do household)
DROP POLICY IF EXISTS "Users can insert own despesas_skip" ON despesas_skip;
CREATE POLICY "Users can insert own despesas_skip"
  ON despesas_skip FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM household_members hm1
      JOIN household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = despesas_skip.user_id
    )
  );

-- Policy: user desfaz skip (delete) só do próprio ou household
DROP POLICY IF EXISTS "Users can delete own despesas_skip" ON despesas_skip;
CREATE POLICY "Users can delete own despesas_skip"
  ON despesas_skip FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM household_members hm1
      JOIN household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = despesas_skip.user_id
    )
  );

-- 3) Index para consulta frequente (template_id + month_ref já são unique, mas user_id + month_ref é a query mais comum)
CREATE INDEX IF NOT EXISTS idx_despesas_skip_user_month
  ON despesas_skip(user_id, month_ref);

-- Foreign key pra template (despesa)
-- ALTER TABLE despesas_skip
--   ADD CONSTRAINT fk_despesas_skip_template
--   FOREIGN KEY (template_id) REFERENCES despesas(id) ON DELETE CASCADE;
-- NOTE: deixado comentado — habilita se quiser cascade ao deletar o template original
