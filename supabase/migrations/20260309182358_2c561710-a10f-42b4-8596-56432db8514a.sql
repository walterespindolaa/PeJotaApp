-- Fix: add 'awaiting_payment' to the access_state CHECK constraint
ALTER TABLE public.user_subscriptions DROP CONSTRAINT user_subscriptions_access_state_check;
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_access_state_check
  CHECK (access_state = ANY (ARRAY['trial'::text, 'grace'::text, 'active'::text, 'restricted'::text, 'awaiting_payment'::text]));