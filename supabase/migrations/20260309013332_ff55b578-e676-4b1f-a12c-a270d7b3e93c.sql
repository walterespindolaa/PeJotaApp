
-- ============================================================
-- ATLAS SCALABILITY AUDIT — Migration
-- Índices, constraints anti-duplicata, retenção e resumos mensais
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. ÍNDICES CRÍTICOS DE PERFORMANCE
-- ─────────────────────────────────────────────

-- despesas: queries filtram por user_id + data e user_id + tipo
CREATE INDEX IF NOT EXISTS idx_despesas_user_data 
  ON public.despesas (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_despesas_user_tipo 
  ON public.despesas (user_id, tipo);

CREATE INDEX IF NOT EXISTS idx_despesas_user_mes_ref 
  ON public.despesas (user_id, mes_referencia)
  WHERE mes_referencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_user_recorrente 
  ON public.despesas (user_id, recorrente)
  WHERE recorrente = true;

-- receitas: mesma lógica
CREATE INDEX IF NOT EXISTS idx_receitas_user_data 
  ON public.receitas (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_receitas_user_tipo 
  ON public.receitas (user_id, tipo);

-- economias
CREATE INDEX IF NOT EXISTS idx_economias_user_data 
  ON public.economias (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_economias_user_destino 
  ON public.economias (user_id, destino_tipo);

-- investimentos_financeiros: carregado no scorecard e dashboard sem filtro de data
CREATE INDEX IF NOT EXISTS idx_investimentos_fin_user 
  ON public.investimentos_financeiros (user_id);

-- atlas_score_snapshots: comparação temporal
CREATE INDEX IF NOT EXISTS idx_atlas_score_snap_user_date 
  ON public.atlas_score_snapshots (user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_atlas_score_snap_user_period 
  ON public.atlas_score_snapshots (user_id, period_start, period_end);

-- portfolio_snapshots: lido no score e dashboard
CREATE INDEX IF NOT EXISTS idx_portfolio_snap_user_month 
  ON public.portfolio_snapshots (user_id, month_ref DESC);

-- credit_card_statement_lines: filtra por statement_id E user_id frequentemente
CREATE INDEX IF NOT EXISTS idx_cc_lines_stmt_user 
  ON public.credit_card_statement_lines (statement_id, user_id);

CREATE INDEX IF NOT EXISTS idx_cc_lines_user_date 
  ON public.credit_card_statement_lines (user_id, purchase_date DESC);

-- credit_card_statements: filtra por user_id + statement_month
CREATE INDEX IF NOT EXISTS idx_cc_stmts_user_month 
  ON public.credit_card_statements (user_id, statement_month DESC);

-- ai_inference_cache: lookup por fingerprint + user_id
CREATE INDEX IF NOT EXISTS idx_ai_cache_user_fp 
  ON public.ai_inference_cache (user_id, fingerprint);

-- fatura_import_logs: retenção e admin queries
CREATE INDEX IF NOT EXISTS idx_fatura_logs_user_created 
  ON public.fatura_import_logs (user_id, created_at DESC);

-- credit_card_audit_events: retenção
CREATE INDEX IF NOT EXISTS idx_cc_audit_user_created 
  ON public.credit_card_audit_events (user_id, created_at DESC);

-- business_transactions: filtros por company + date
CREATE INDEX IF NOT EXISTS idx_bizz_tx_company_date 
  ON public.business_transactions (company_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_bizz_tx_user_date 
  ON public.business_transactions (user_id, date DESC);

-- installment_instances: competencia + user_id
CREATE INDEX IF NOT EXISTS idx_inst_instances_user_comp 
  ON public.installment_instances (user_id, competencia);

-- objetivos: consulta frequente por user
CREATE INDEX IF NOT EXISTS idx_objetivos_user 
  ON public.objetivos (user_id);

-- aportes_objetivos: join com objetivos
CREATE INDEX IF NOT EXISTS idx_aportes_obj_user_data 
  ON public.aportes_objetivos (user_id, data DESC);

-- aportes_investimentos
CREATE INDEX IF NOT EXISTS idx_aportes_inv_user_data 
  ON public.aportes_investimentos (user_id, data DESC);

-- audit_logs admin
CREATE INDEX IF NOT EXISTS idx_audit_logs_created 
  ON public.audit_logs (created_at DESC);

-- household_members: lookup por user_id
CREATE INDEX IF NOT EXISTS idx_hh_members_user 
  ON public.household_members (user_id)
  WHERE user_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 2. UNIQUE CONSTRAINTS ANTI-DUPLICATA — SNAPSHOTS
-- ─────────────────────────────────────────────

-- atlas_score_snapshots: 1 snapshot por (user, period_start, period_end, snapshot_date)
ALTER TABLE public.atlas_score_snapshots
  DROP CONSTRAINT IF EXISTS uq_atlas_score_snap_period;

ALTER TABLE public.atlas_score_snapshots
  ADD CONSTRAINT uq_atlas_score_snap_period
  UNIQUE (user_id, period_start, period_end, snapshot_date);

-- portfolio_snapshots: 1 snapshot por (user, month_ref)
ALTER TABLE public.portfolio_snapshots
  DROP CONSTRAINT IF EXISTS uq_portfolio_snap_month;

ALTER TABLE public.portfolio_snapshots
  ADD CONSTRAINT uq_portfolio_snap_month
  UNIQUE (user_id, month_ref);

-- ─────────────────────────────────────────────
-- 3. TABELA DE RESUMOS MENSAIS MATERIALIZADOS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.monthly_financial_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  month_ref       TEXT NOT NULL,
  total_receitas  NUMERIC NOT NULL DEFAULT 0,
  total_despesas  NUMERIC NOT NULL DEFAULT 0,
  total_economias NUMERIC NOT NULL DEFAULT 0,
  saldo_mensal    NUMERIC GENERATED ALWAYS AS (total_receitas - total_despesas) STORED,
  taxa_poupanca   NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_receitas > 0
      THEN ROUND(((total_receitas - total_despesas) / total_receitas) * 100, 2)
      ELSE 0
    END
  ) STORED,
  computed_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_monthly_summary_user_month UNIQUE (user_id, month_ref)
);

ALTER TABLE public.monthly_financial_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own monthly summaries"
  ON public.monthly_financial_summaries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_monthly_summaries_user_month
  ON public.monthly_financial_summaries (user_id, month_ref DESC);

-- ─────────────────────────────────────────────
-- 4. LIMITE DE CACHE POR USUÁRIO (500 entradas — LRU automático)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_ai_cache_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cache_count INT;
BEGIN
  SELECT COUNT(*) INTO cache_count
  FROM public.ai_inference_cache
  WHERE user_id = NEW.user_id;

  IF cache_count >= 500 THEN
    DELETE FROM public.ai_inference_cache
    WHERE id IN (
      SELECT id FROM public.ai_inference_cache
      WHERE user_id = NEW.user_id
      ORDER BY created_at ASC
      LIMIT 50
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_cache_limit ON public.ai_inference_cache;
CREATE TRIGGER trg_ai_cache_limit
  BEFORE INSERT ON public.ai_inference_cache
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_cache_limit();

-- ─────────────────────────────────────────────
-- 5. LIMITE DE UPLOAD — bucket faturas (10 MB, mime types restritos)
-- ─────────────────────────────────────────────

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'text/csv'
    ]
WHERE id = 'faturas';

-- ─────────────────────────────────────────────
-- 6. FUNÇÕES DE RETENÇÃO (chamadas pela data-retention-cleanup)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_old_import_logs(months_to_keep INT DEFAULT 12)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.fatura_import_logs
  WHERE created_at < NOW() - (months_to_keep || ' months')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_score_snapshots(months_to_keep INT DEFAULT 24)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.atlas_score_snapshots
  WHERE snapshot_date < (CURRENT_DATE - (months_to_keep || ' months')::INTERVAL)::DATE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_portfolio_snapshots(months_to_keep INT DEFAULT 36)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.portfolio_snapshots
  WHERE created_at < NOW() - (months_to_keep || ' months')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_audit_events(months_to_keep INT DEFAULT 24)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.credit_card_audit_events
  WHERE created_at < NOW() - (months_to_keep || ' months')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;
