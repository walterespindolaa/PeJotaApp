-- AI Quota System
-- Generalizes ai_usage (chat-only) into a per-feature quota system covering:
--   - chat       (daily)   atlas-chat
--   - report     (monthly) 4 relatorios compartilham a mesma quota
--   - simulator  (daily)   decision-simulator
-- Admins (user_roles.role = 'admin') bypassam.

-- ============================================================
-- 1) ai_quota_limits: configuracao dos limites por plano
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_quota_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  plan_tier TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('daily', 'monthly')),
  max_usage INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feature, plan_tier)
);

ALTER TABLE public.ai_quota_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_quota_limits_read_all" ON public.ai_quota_limits
  FOR SELECT USING (true);

CREATE POLICY "ai_quota_limits_admin_write" ON public.ai_quota_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================
-- 2) Seed dos limites
-- ============================================================
-- Plan tiers do Atlas hoje: 'free', 'full' (user_subscriptions.plan_tier).
-- Pro/Essencial nao sao distinguidos granularmente no schema atual.
-- Divida tecnica: granularizar plan_tier futuramente para suportar Pro intermediario.
-- Por ora: free = Essencial, full = Elite.

INSERT INTO public.ai_quota_limits (feature, plan_tier, period, max_usage) VALUES
  ('chat', 'free', 'daily', 10),
  ('chat', 'full', 'daily', 75),
  ('report', 'free', 'monthly', 1),
  ('report', 'full', 'monthly', 15),
  ('simulator', 'free', 'daily', 3),
  ('simulator', 'full', 'daily', 999)
ON CONFLICT (feature, plan_tier) DO NOTHING;

-- ============================================================
-- 3) ai_usage_counter: contador por user+feature+periodo
-- ============================================================

CREATE TABLE IF NOT EXISTS public.ai_usage_counter (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  period_start DATE NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 0,
  last_incremented_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, feature, period_start)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_counter_user_feature
  ON public.ai_usage_counter(user_id, feature, period_start);

ALTER TABLE public.ai_usage_counter ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_counter_self_read" ON public.ai_usage_counter
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ai_usage_counter_admin_read_all" ON public.ai_usage_counter
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Escrita apenas via service_role (Edge Functions chamam via SECURITY DEFINER RPC).

-- ============================================================
-- 4) RPC: check_and_increment_ai_quota
-- ============================================================
-- Edge Functions chamam ANTES de invocar o LLM. Retorna allowed=true/false
-- e incrementa o contador atomicamente se permitido.

CREATE OR REPLACE FUNCTION public.check_and_increment_ai_quota(_feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _plan_tier text;
  _is_admin boolean;
  _period text;
  _max_usage int;
  _period_start date;
  _current_count int;
  _resets_at timestamptz;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'not_authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) INTO _is_admin;

  IF _is_admin THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'is_admin', true,
      'used', 0,
      'limit', 999999,
      'remaining', 999999
    );
  END IF;

  SELECT COALESCE(plan_tier, 'free') INTO _plan_tier
  FROM public.user_subscriptions
  WHERE user_id = _user_id
  LIMIT 1;

  _plan_tier := COALESCE(_plan_tier, 'free');

  SELECT period, max_usage INTO _period, _max_usage
  FROM public.ai_quota_limits
  WHERE feature = _feature AND plan_tier = _plan_tier
  LIMIT 1;

  IF _period IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota_not_configured',
      'feature', _feature,
      'plan_tier', _plan_tier
    );
  END IF;

  IF _period = 'daily' THEN
    _period_start := CURRENT_DATE;
    _resets_at := (CURRENT_DATE + INTERVAL '1 day')::timestamptz;
  ELSIF _period = 'monthly' THEN
    _period_start := DATE_TRUNC('month', CURRENT_DATE)::date;
    _resets_at := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::timestamptz;
  END IF;

  INSERT INTO public.ai_usage_counter (user_id, feature, period_start, usage_count, last_incremented_at)
  VALUES (_user_id, _feature, _period_start, 0, NOW())
  ON CONFLICT (user_id, feature, period_start) DO NOTHING;

  SELECT usage_count INTO _current_count
  FROM public.ai_usage_counter
  WHERE user_id = _user_id AND feature = _feature AND period_start = _period_start;

  IF _current_count >= _max_usage THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason', 'quota_exceeded',
      'used', _current_count,
      'limit', _max_usage,
      'remaining', 0,
      'period', _period,
      'resets_at', _resets_at,
      'is_admin', false
    );
  END IF;

  UPDATE public.ai_usage_counter
  SET usage_count = usage_count + 1,
      last_incremented_at = NOW()
  WHERE user_id = _user_id AND feature = _feature AND period_start = _period_start
  RETURNING usage_count INTO _current_count;

  RETURN jsonb_build_object(
    'allowed', true,
    'used', _current_count,
    'limit', _max_usage,
    'remaining', _max_usage - _current_count,
    'period', _period,
    'resets_at', _resets_at,
    'is_admin', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_ai_quota(text) TO authenticated, service_role;

-- ============================================================
-- 5) RPC: get_ai_quota_status (leitura sem incrementar)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_ai_quota_status(_feature text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid;
  _plan_tier text;
  _is_admin boolean;
  _period text;
  _max_usage int;
  _period_start date;
  _current_count int;
  _resets_at timestamptz;
BEGIN
  _user_id := auth.uid();
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('used', 0, 'limit', 0, 'remaining', 0);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) INTO _is_admin;

  IF _is_admin THEN
    RETURN jsonb_build_object(
      'is_admin', true,
      'used', 0,
      'limit', 999999,
      'remaining', 999999
    );
  END IF;

  SELECT COALESCE(plan_tier, 'free') INTO _plan_tier
  FROM public.user_subscriptions
  WHERE user_id = _user_id
  LIMIT 1;

  _plan_tier := COALESCE(_plan_tier, 'free');

  SELECT period, max_usage INTO _period, _max_usage
  FROM public.ai_quota_limits
  WHERE feature = _feature AND plan_tier = _plan_tier
  LIMIT 1;

  IF _period IS NULL THEN
    RETURN jsonb_build_object('used', 0, 'limit', 0, 'remaining', 0);
  END IF;

  IF _period = 'daily' THEN
    _period_start := CURRENT_DATE;
    _resets_at := (CURRENT_DATE + INTERVAL '1 day')::timestamptz;
  ELSIF _period = 'monthly' THEN
    _period_start := DATE_TRUNC('month', CURRENT_DATE)::date;
    _resets_at := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month')::timestamptz;
  END IF;

  SELECT COALESCE(usage_count, 0) INTO _current_count
  FROM public.ai_usage_counter
  WHERE user_id = _user_id AND feature = _feature AND period_start = _period_start;

  _current_count := COALESCE(_current_count, 0);

  RETURN jsonb_build_object(
    'used', _current_count,
    'limit', _max_usage,
    'remaining', GREATEST(_max_usage - _current_count, 0),
    'period', _period,
    'resets_at', _resets_at,
    'is_admin', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_ai_quota_status(text) TO authenticated, service_role;

-- ============================================================
-- 6) Limpeza automatica (pode rodar via pg_cron depois)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_old_ai_counters()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.ai_usage_counter
  WHERE period_start < (CURRENT_DATE - INTERVAL '90 days');
$$;

GRANT EXECUTE ON FUNCTION public.cleanup_old_ai_counters() TO service_role;
