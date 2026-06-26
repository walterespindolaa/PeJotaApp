-- Migration 1: Corrige due_date em instances de recorrências empresariais onde o mês/ano
-- divergem do month_ref. Bug original: new Date("YYYY-MM-DD") interpretado
-- como UTC em JS, resultando em due_date 1 mês antes em timezones negativos.

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

-- Sincroniza business_transactions.date com due_date corrigido.
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

-- Migration 2: Blindagem 1 - view de usuários presos no loop de força-troca-de-senha há mais de 24h.

CREATE OR REPLACE VIEW public.v_users_stuck_password_change AS
SELECT
  p.user_id,
  u.email,
  p.full_name,
  p.must_change_password,
  u.created_at AS account_created_at,
  u.last_sign_in_at,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(u.last_sign_in_at, u.created_at))) / 3600 AS hours_stuck,
  p.updated_at AS profile_last_updated
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.must_change_password = true
  AND COALESCE(u.last_sign_in_at, u.created_at) < NOW() - INTERVAL '24 hours'
ORDER BY hours_stuck DESC;

COMMENT ON VIEW public.v_users_stuck_password_change IS
  'Usuários com must_change_password=true há mais de 24h (indicador de loop). Conferir periodicamente no SQL Editor. Para liberar manualmente: UPDATE profiles SET must_change_password=false WHERE user_id=...';

ALTER VIEW public.v_users_stuck_password_change SET (security_invoker = on);