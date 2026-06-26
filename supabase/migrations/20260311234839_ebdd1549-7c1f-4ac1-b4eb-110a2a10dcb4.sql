
-- RPC that returns the effective subscription + plan data, bypassing RLS
CREATE OR REPLACE FUNCTION public.get_effective_plan_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _effective_uid uuid;
  _sub jsonb;
  _plan_slug text;
  _plan_id uuid;
BEGIN
  -- This internally activates invited members and resolves the titular's ID
  _effective_uid := public.resolve_effective_plan_user_id();
  
  IF _effective_uid IS NULL THEN
    RETURN jsonb_build_object('effective_user_id', null, 'subscription', '{}'::jsonb, 'plan_slug', null, 'plan_id', null);
  END IF;
  
  SELECT to_jsonb(s.*) INTO _sub
  FROM public.user_subscriptions s
  WHERE s.user_id = _effective_uid;
  
  SELECT up.plan_id, p.slug INTO _plan_id, _plan_slug
  FROM public.user_plans up
  JOIN public.plans p ON p.id = up.plan_id
  WHERE up.user_id = _effective_uid AND up.active = true
  LIMIT 1;
  
  RETURN jsonb_build_object(
    'effective_user_id', _effective_uid,
    'subscription', COALESCE(_sub, '{}'::jsonb),
    'plan_slug', _plan_slug,
    'plan_id', _plan_id
  );
END;
$$;
