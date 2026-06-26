-- Migration: tabela genérica de rate limit por (user_id, scope, window_key).
CREATE TABLE IF NOT EXISTS public.rate_limit_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scope text NOT NULL,
  window_key text NOT NULL,
  count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, window_key)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_v2_user_scope ON public.rate_limit_v2 (user_id, scope);
CREATE INDEX IF NOT EXISTS idx_rate_limit_v2_created_at ON public.rate_limit_v2 (created_at);

ALTER TABLE public.rate_limit_v2 ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.check_and_increment_rate_limit(
  _user_id uuid,
  _scope text,
  _window_key text,
  _limit integer
)
RETURNS TABLE(allowed boolean, current_count integer, "limit" integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _new_count integer;
BEGIN
  INSERT INTO public.rate_limit_v2 (user_id, scope, window_key, count)
  VALUES (_user_id, _scope, _window_key, 1)
  ON CONFLICT (user_id, scope, window_key)
  DO UPDATE SET count = rate_limit_v2.count + 1, updated_at = now()
  RETURNING rate_limit_v2.count INTO _new_count;

  RETURN QUERY SELECT (_new_count <= _limit) AS allowed, _new_count AS current_count, _limit AS "limit";
END;
$$;

REVOKE ALL ON FUNCTION public.check_and_increment_rate_limit(uuid, text, text, integer) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_increment_rate_limit(uuid, text, text, integer) TO service_role;

COMMENT ON TABLE public.rate_limit_v2 IS 'Generic per-user rate limit (user_id + scope + window_key). Service role only via check_and_increment_rate_limit RPC.';
COMMENT ON FUNCTION public.check_and_increment_rate_limit IS 'Atomically increments counter and returns whether request is allowed.';