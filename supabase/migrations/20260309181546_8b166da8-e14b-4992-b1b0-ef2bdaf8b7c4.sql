-- Fix: use past dates instead of NULL for NOT NULL columns
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_plans (user_id, tier, plan_id, assigned_by_admin)
  VALUES (NEW.id, 'organiza_2026', (SELECT id FROM public.plans WHERE slug = 'atlas_essencial'), false);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  IF COALESCE(NEW.raw_user_meta_data->>'signup_source', '') = 'trial' THEN
    INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin)
    VALUES (NEW.id, 'free', 'trial', 'trial_landing');
  ELSE
    INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin, trial_expires_at, grace_finance_until, scheduled_deletion_at)
    VALUES (NEW.id, 'free', 'awaiting_payment', 'direct', '2000-01-01T00:00:00Z'::timestamptz, '2000-01-01T00:00:00Z'::timestamptz, '2000-01-01T00:00:00Z'::timestamptz);
  END IF;

  RETURN NEW;
END;
$function$;