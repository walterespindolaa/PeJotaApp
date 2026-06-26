CREATE OR REPLACE FUNCTION public.get_effective_plan_state_for_user(target_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'plan_id', up.plan_id,
    'plan_slug', p.slug,
    'access_state', us.access_state,
    'plan_tier', us.plan_tier
  ) INTO result
  FROM user_plans up
  JOIN plans p ON p.id = up.plan_id
  LEFT JOIN user_subscriptions us ON us.user_id = up.user_id
  WHERE up.user_id = target_user_id AND up.active = true
  LIMIT 1;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;
