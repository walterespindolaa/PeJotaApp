
-- Update grace_finance_until default to 45 days (from 28)
ALTER TABLE public.user_subscriptions 
  ALTER COLUMN grace_finance_until SET DEFAULT (now() + interval '52 days');

-- Update scheduled_deletion_at to match (45 days grace + some buffer)
ALTER TABLE public.user_subscriptions 
  ALTER COLUMN scheduled_deletion_at SET DEFAULT (now() + interval '52 days');

-- Add cancelled_at column for tracking when a paid user cancelled
ALTER TABLE public.user_subscriptions 
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz DEFAULT NULL;

-- Update handle_new_user to set access_state to 'trial_expired' by default
-- Trial is only for users who enter via landing page
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
    INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin, trial_expires_at, grace_finance_until)
    VALUES (NEW.id, 'free', 'trial_expired', 'direct', now(), now() + interval '45 days');
  END IF;

  RETURN NEW;
END;
$function$;
