
-- Fix existing admins: ensure they have full/active user_subscriptions
INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin, trial_expires_at, grace_finance_until, scheduled_deletion_at)
SELECT ur.user_id, 'full', 'active', 'admin',
  now() + interval '999 years',
  now() + interval '999 years',
  now() + interval '999 years'
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = ur.user_id
  );

-- Update existing admin subscriptions to full/active
UPDATE public.user_subscriptions us
SET plan_tier = 'full',
    access_state = 'active',
    updated_at = now()
FROM public.user_roles ur
WHERE ur.user_id = us.user_id
  AND ur.role = 'admin'
  AND (us.plan_tier != 'full' OR us.access_state != 'active');
