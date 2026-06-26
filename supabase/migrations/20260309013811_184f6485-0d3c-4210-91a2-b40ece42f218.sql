-- Legal acceptance hardening for Atlas
CREATE TABLE IF NOT EXISTS public.user_terms_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.user_terms_acceptance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_terms_acceptance' AND policyname='Users can view their own terms acceptance'
  ) THEN
    CREATE POLICY "Users can view their own terms acceptance"
      ON public.user_terms_acceptance
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_terms_acceptance' AND policyname='Users can insert their own terms acceptance'
  ) THEN
    CREATE POLICY "Users can insert their own terms acceptance"
      ON public.user_terms_acceptance
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_terms_acceptance_user_version
  ON public.user_terms_acceptance (user_id, terms_version);

CREATE INDEX IF NOT EXISTS idx_user_terms_acceptance_user_version_date
  ON public.user_terms_acceptance (user_id, terms_version, accepted_at DESC);