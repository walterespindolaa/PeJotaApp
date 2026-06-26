-- Normaliza status 'atrasado' → 'em_atraso' em receitas e pagamentos.
-- Motivo: o código frontend usa duas grafias intercambiavelmente (em_atraso para
-- despesas, atrasado para receitas). Padronizando tudo em em_atraso.

BEGIN;

-- 1. receitas: status é texto livre, seguro fazer UPDATE
UPDATE public.receitas
SET status = 'em_atraso'
WHERE status = 'atrasado';

-- 2. pagamentos: status é texto livre, pode haver rows com 'atrasado' (se foi
-- setado via código de receita recorrente projetada)
UPDATE public.pagamentos
SET status = 'em_atraso'
WHERE status = 'atrasado';

-- 3. log pro audit
INSERT INTO public.audit_logs (action, payload)
VALUES (
  'migration_normalize_atrasado',
  jsonb_build_object(
    'migrated_at', NOW(),
    'description', 'Normalized status atrasado → em_atraso in receitas and pagamentos'
  )
);

COMMIT;