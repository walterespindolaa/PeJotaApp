-- Migration: stripe_events_processed
-- Stores processed Stripe webhook event IDs for idempotency check.
-- Prevents duplicate side effects when Stripe retries webhook delivery.

CREATE TABLE IF NOT EXISTS public.stripe_events_processed (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  stripe_object_id text,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON public.stripe_events_processed (processed_at);
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_type ON public.stripe_events_processed (event_type);

ALTER TABLE public.stripe_events_processed ENABLE ROW LEVEL SECURITY;

-- No public policies: this table is service_role only.

COMMENT ON TABLE public.stripe_events_processed IS 'Stripe webhook event IDs already processed. Used for idempotency check in webhook-stripe Edge Function. Service role only.';
