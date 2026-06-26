-- Corrige due_date em instances de recorrências empresariais onde o mês/ano
-- divergem do month_ref. Bug original: new Date("YYYY-MM-DD") interpretado
-- como UTC em JS, resultando em due_date 1 mês antes em timezones negativos.
--
-- Também sincroniza business_transactions.date com a nova due_date corrigida,
-- porque cada instance confirmada gera uma transaction com bt.date = bri.due_date.

BEGIN;

-- Log do que será afetado (audit preview)
INSERT INTO audit_logs (action, payload)
SELECT
  'kwk_timezone_fix_preview',
  jsonb_build_object(
    'instances_affected', COUNT(*),
    'companies_affected', COUNT(DISTINCT company_id),
    'sample_company_ids', array_agg(DISTINCT company_id) FILTER (WHERE company_id IS NOT NULL)
  )
FROM business_recurring_instances
WHERE (EXTRACT(YEAR FROM due_date) != EXTRACT(YEAR FROM month_ref)
       OR EXTRACT(MONTH FROM due_date) != EXTRACT(MONTH FROM month_ref));

-- Corrige due_date: mantém o DIA mas recalcula com YEAR/MONTH de month_ref.
-- LEAST garante que due_day não ultrapasse o último dia do mês
-- (caso edge: template com due_day=31 num month_ref de fevereiro).
UPDATE business_recurring_instances
SET due_date = (
  DATE_TRUNC('month', month_ref)::date +
  (LEAST(
    EXTRACT(DAY FROM due_date)::int,
    EXTRACT(DAY FROM (DATE_TRUNC('month', month_ref) + INTERVAL '1 month - 1 day'))::int
  ) - 1)
)
WHERE (EXTRACT(YEAR FROM due_date) != EXTRACT(YEAR FROM month_ref)
       OR EXTRACT(MONTH FROM due_date) != EXTRACT(MONTH FROM month_ref));

-- Sincroniza business_transactions.date com due_date corrigido (só das que vieram
-- de instance).
UPDATE business_transactions bt
SET date = bri.due_date
FROM business_recurring_instances bri
WHERE bri.transaction_id = bt.id
  AND bt.date != bri.due_date;

-- Log pós-migração
INSERT INTO audit_logs (action, payload)
VALUES (
  'kwk_timezone_fix_applied',
  jsonb_build_object(
    'migrated_at', NOW(),
    'description', 'Corrigidas instances com due_date em mês diferente do month_ref (bug timezone new Date YYYY-MM-DD UTC) e transactions correspondentes sincronizadas.'
  )
);

COMMIT;
