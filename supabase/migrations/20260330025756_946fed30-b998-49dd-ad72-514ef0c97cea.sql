
-- FIX 1: ai_usage - Remove ALL policy, add SELECT-only + increment RPC
DROP POLICY IF EXISTS "Users can manage own ai_usage" ON ai_usage;
CREATE POLICY "Users can view own ai_usage" ON ai_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role handles all writes
CREATE POLICY "Service can manage ai_usage" ON ai_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- RPC for safe increment (only increases, never resets)
CREATE OR REPLACE FUNCTION public.increment_ai_usage(_usage_date text, _daily_limit integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  INSERT INTO ai_usage (user_id, usage_date, questions_used, daily_limit)
  VALUES (_uid, _usage_date, 1, _daily_limit)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET 
    questions_used = ai_usage.questions_used + 1,
    updated_at = now();
END;
$$;

-- FIX 2: partner_coupons - Remove broad authenticated SELECT (RPC handles validation)
DROP POLICY IF EXISTS "Authenticated users can view active coupons" ON partner_coupons;

-- FIX 3: password_resets - Add explicit deny for anon role
CREATE POLICY "Deny anon access to password_resets" ON password_resets FOR ALL TO anon USING (false) WITH CHECK (false);

-- FIX 4: profiles - Create safe update function excluding sensitive columns
CREATE OR REPLACE FUNCTION public.update_own_profile(
  _full_name text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _age integer DEFAULT NULL,
  _marital_status text DEFAULT NULL,
  _dependents integer DEFAULT NULL,
  _nome_pessoa1 text DEFAULT NULL,
  _nome_pessoa2 text DEFAULT NULL,
  _foto_pessoa1 text DEFAULT NULL,
  _foto_pessoa2 text DEFAULT NULL,
  _foto_casal text DEFAULT NULL,
  _foto_geral text DEFAULT NULL,
  _vinculo_pessoa2 text DEFAULT NULL,
  _pessoa2_participa_geral boolean DEFAULT NULL,
  _tema_sidebar text DEFAULT NULL,
  _tema_destaque text DEFAULT NULL,
  _tema_modo text DEFAULT NULL,
  _language text DEFAULT NULL,
  _currency text DEFAULT NULL,
  _greeting_emoji text DEFAULT NULL,
  _emoji_pessoa1 text DEFAULT NULL,
  _emoji_pessoa2 text DEFAULT NULL,
  _emoji_casal text DEFAULT NULL,
  _emoji_geral text DEFAULT NULL,
  _onboarding_completed boolean DEFAULT NULL,
  _weekly_email_enabled boolean DEFAULT NULL,
  _weekly_email_day integer DEFAULT NULL,
  _weekly_email_hour integer DEFAULT NULL,
  _weekly_email_timezone text DEFAULT NULL,
  _selected_company_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  UPDATE profiles SET
    full_name = COALESCE(_full_name, full_name),
    phone = COALESCE(_phone, phone),
    age = COALESCE(_age, age),
    marital_status = COALESCE(_marital_status, marital_status),
    dependents = COALESCE(_dependents, dependents),
    nome_pessoa1 = COALESCE(_nome_pessoa1, nome_pessoa1),
    nome_pessoa2 = COALESCE(_nome_pessoa2, nome_pessoa2),
    foto_pessoa1 = COALESCE(_foto_pessoa1, foto_pessoa1),
    foto_pessoa2 = COALESCE(_foto_pessoa2, foto_pessoa2),
    foto_casal = COALESCE(_foto_casal, foto_casal),
    foto_geral = COALESCE(_foto_geral, foto_geral),
    vinculo_pessoa2 = COALESCE(_vinculo_pessoa2, vinculo_pessoa2),
    pessoa2_participa_geral = COALESCE(_pessoa2_participa_geral, pessoa2_participa_geral),
    tema_sidebar = COALESCE(_tema_sidebar, tema_sidebar),
    tema_destaque = COALESCE(_tema_destaque, tema_destaque),
    tema_modo = COALESCE(_tema_modo, tema_modo),
    language = COALESCE(_language, language),
    currency = COALESCE(_currency, currency),
    greeting_emoji = COALESCE(_greeting_emoji, greeting_emoji),
    emoji_pessoa1 = COALESCE(_emoji_pessoa1, emoji_pessoa1),
    emoji_pessoa2 = COALESCE(_emoji_pessoa2, emoji_pessoa2),
    emoji_casal = COALESCE(_emoji_casal, emoji_casal),
    emoji_geral = COALESCE(_emoji_geral, emoji_geral),
    onboarding_completed = COALESCE(_onboarding_completed, onboarding_completed),
    onboarding_completed_at = CASE WHEN _onboarding_completed = true AND onboarding_completed = false THEN now() ELSE onboarding_completed_at END,
    weekly_email_enabled = COALESCE(_weekly_email_enabled, weekly_email_enabled),
    weekly_email_day = COALESCE(_weekly_email_day, weekly_email_day),
    weekly_email_hour = COALESCE(_weekly_email_hour, weekly_email_hour),
    weekly_email_timezone = COALESCE(_weekly_email_timezone, weekly_email_timezone),
    selected_company_id = COALESCE(_selected_company_id, selected_company_id),
    updated_at = now()
  WHERE user_id = _uid;
END;
$$;
