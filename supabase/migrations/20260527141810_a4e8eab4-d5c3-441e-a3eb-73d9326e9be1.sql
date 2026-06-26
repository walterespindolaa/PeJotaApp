
-- 1. ticker_cache: remove permissive ALL policy, replace with service_role only
DROP POLICY IF EXISTS ticker_cache_service_write ON public.ticker_cache;
CREATE POLICY ticker_cache_service_write ON public.ticker_cache
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 2. rate_limit_register: service_role only (currently has no policies)
DROP POLICY IF EXISTS rate_limit_register_service ON public.rate_limit_register;
CREATE POLICY rate_limit_register_service ON public.rate_limit_register
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 3. stripe_events_processed: service_role only
DROP POLICY IF EXISTS stripe_events_processed_service ON public.stripe_events_processed;
CREATE POLICY stripe_events_processed_service ON public.stripe_events_processed
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 4. account_invite_tokens: explicit deny for client roles (consumption via SECURITY DEFINER RPCs only)
DROP POLICY IF EXISTS account_invite_tokens_no_client_read ON public.account_invite_tokens;
CREATE POLICY account_invite_tokens_no_client_read ON public.account_invite_tokens
  FOR SELECT TO anon, authenticated USING (false);
DROP POLICY IF EXISTS account_invite_tokens_service ON public.account_invite_tokens;
CREATE POLICY account_invite_tokens_service ON public.account_invite_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. Pin search_path on functions missing it
ALTER FUNCTION public.get_effective_plan_state_for_user(uuid) SET search_path = public;
ALTER FUNCTION public.increment_rate_limit(uuid, text) SET search_path = public;
