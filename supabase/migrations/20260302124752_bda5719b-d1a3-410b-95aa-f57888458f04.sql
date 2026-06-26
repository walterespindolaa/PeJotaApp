
-- Create user_subscriptions table for SaaS trial system
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_tier text NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'full')),
  access_state text NOT NULL DEFAULT 'trial' CHECK (access_state IN ('trial', 'grace', 'active', 'restricted')),
  origin text NOT NULL DEFAULT 'manual',
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  grace_finance_until timestamptz NOT NULL DEFAULT (now() + interval '28 days'),
  restricted_at timestamptz,
  scheduled_deletion_at timestamptz NOT NULL DEFAULT (now() + interval '88 days'),
  deleted_at timestamptz,
  bonus_days_full int NOT NULL DEFAULT 0,
  bonus_days_grace int NOT NULL DEFAULT 0,
  retention_extra_days int NOT NULL DEFAULT 0,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own user_subscription"
ON public.user_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access user_subscriptions"
ON public.user_subscriptions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can manage all
CREATE POLICY "Admins can manage user_subscriptions"
ON public.user_subscriptions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user to also create user_subscriptions row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_plans (user_id, tier)
  VALUES (NEW.id, 'organiza_2026');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin)
  VALUES (NEW.id, 'free', 'trial', 'manual');

  RETURN NEW;
END;
$$;

-- Migrate existing users with active subscriptions to 'full' + 'active'
INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin, trial_started_at, trial_expires_at, grace_finance_until, restricted_at, scheduled_deletion_at)
SELECT
  s.user_id,
  'full',
  'active',
  s.source,
  s.start_at,
  s.start_at, -- trial already expired (they paid)
  s.start_at, -- not in grace
  NULL,
  s.end_at + interval '60 days'
FROM public.subscriptions s
WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = s.user_id)
ON CONFLICT (user_id) DO NOTHING;

-- Also create for users who have no subscription at all (set as trial)
INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin)
SELECT u.id, 'free', 'trial', 'manual'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = u.id);
