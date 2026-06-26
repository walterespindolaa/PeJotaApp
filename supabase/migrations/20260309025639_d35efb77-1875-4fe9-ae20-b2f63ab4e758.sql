
-- Fix handle_new_user: normal flow users get 'awaiting_payment', trial users get 'trial'
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

  -- Check if user signed up via trial landing page
  IF COALESCE(NEW.raw_user_meta_data->>'signup_source', '') = 'trial' THEN
    INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin)
    VALUES (NEW.id, 'free', 'trial', 'trial_landing');
  ELSE
    -- Normal flow: user needs to pay before accessing. No trial, no grace.
    INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin, trial_expires_at, grace_finance_until)
    VALUES (NEW.id, 'free', 'awaiting_payment', 'direct', NULL, NULL);
  END IF;

  RETURN NEW;
END;
$function$;
