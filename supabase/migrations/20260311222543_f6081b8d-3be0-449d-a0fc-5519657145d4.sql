-- Resolve effective plan owner for household members and activate invited memberships on first access
CREATE OR REPLACE FUNCTION public.resolve_effective_plan_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _activated_count integer := 0;
  _is_member boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- First access for invited members: activate membership
  UPDATE public.household_members
  SET
    status = 'active',
    joined_at = COALESCE(joined_at, now()),
    updated_at = now()
  WHERE user_id = _uid
    AND role = 'member'
    AND status = 'invited';

  GET DIAGNOSTICS _activated_count = ROW_COUNT;

  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE user_id = _uid
      AND role = 'member'
      AND status IN ('active', 'invited')
  )
  INTO _is_member;

  -- Mark subscription origin correctly for invited household users
  IF _is_member THEN
    UPDATE public.user_subscriptions
    SET
      origin = 'household_invite',
      updated_at = now()
    WHERE user_id = _uid
      AND COALESCE(origin, 'direct') IN ('direct', 'manual');
  END IF;

  -- Apply first-experience theme only when membership has just been activated
  IF _activated_count > 0 THEN
    UPDATE public.profiles
    SET
      tema_sidebar = CASE WHEN COALESCE(tema_sidebar, 'default') = 'default' THEN 'white' ELSE tema_sidebar END,
      tema_destaque = CASE WHEN COALESCE(tema_destaque, 'default') = 'default' THEN 'sand' ELSE tema_destaque END,
      tema_modo = CASE WHEN COALESCE(tema_modo, 'system') = 'system' THEN 'light' ELSE tema_modo END,
      updated_at = now()
    WHERE user_id = _uid;
  END IF;

  -- Household members inherit owner's plan
  SELECT h.owner_id
  INTO _owner
  FROM public.household_members hm
  JOIN public.households h ON h.id = hm.household_id
  WHERE hm.user_id = _uid
    AND hm.role = 'member'
    AND hm.status IN ('active', 'invited')
  ORDER BY hm.updated_at DESC
  LIMIT 1;

  RETURN COALESCE(_owner, _uid);
END;
$$;

-- Ensure authenticated users can call this helper
GRANT EXECUTE ON FUNCTION public.resolve_effective_plan_user_id() TO authenticated;

-- First-access theme defaults should be off-white + dourado + light
ALTER TABLE public.profiles ALTER COLUMN tema_sidebar SET DEFAULT 'white';
ALTER TABLE public.profiles ALTER COLUMN tema_destaque SET DEFAULT 'sand';
ALTER TABLE public.profiles ALTER COLUMN tema_modo SET DEFAULT 'light';