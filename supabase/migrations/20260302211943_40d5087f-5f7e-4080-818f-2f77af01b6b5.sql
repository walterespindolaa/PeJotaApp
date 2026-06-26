
-- Add full_expires_at and full_expire_action to user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS full_expires_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS full_expire_action text NOT NULL DEFAULT 'restrict';

-- Comment for clarity
COMMENT ON COLUMN public.user_subscriptions.full_expires_at IS 'When FULL plan expires. Must be set when plan_tier=full.';
COMMENT ON COLUMN public.user_subscriptions.full_expire_action IS 'Action on FULL expiry: restrict (default)';
