-- Migration: account_invite_tokens
-- Stores single-use tokens for passwordless onboarding (household invites + admin-created accounts).

CREATE TABLE IF NOT EXISTS public.account_invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  source text NOT NULL CHECK (source IN ('household', 'admin')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_invite_tokens_token ON public.account_invite_tokens (token);
CREATE INDEX IF NOT EXISTS idx_account_invite_tokens_user_id ON public.account_invite_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_account_invite_tokens_email ON public.account_invite_tokens (email);

-- RLS: only service role reads/writes. Frontend never queries this table.
ALTER TABLE public.account_invite_tokens ENABLE ROW LEVEL SECURITY;

-- No public policies: this table is service_role only.

-- Helper RPC to consume a token: validates and marks as used in single transaction.
CREATE OR REPLACE FUNCTION public.consume_invite_token(_token uuid)
RETURNS TABLE(user_id uuid, email text, source text, metadata jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  _record record;
BEGIN
  -- Find unused, non-expired token
  SELECT * INTO _record
  FROM public.account_invite_tokens
  WHERE account_invite_tokens.token = _token
    AND account_invite_tokens.used_at IS NULL
    AND account_invite_tokens.expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_or_expired_token' USING ERRCODE = 'P0001';
  END IF;

  -- Mark as used atomically
  UPDATE public.account_invite_tokens
  SET used_at = now()
  WHERE id = _record.id;

  RETURN QUERY SELECT _record.user_id, _record.email, _record.source, _record.metadata;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_invite_token(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_invite_token(uuid) TO service_role;

COMMENT ON TABLE public.account_invite_tokens IS 'Single-use tokens for passwordless onboarding (household invites + admin-created accounts). Service role only.';
COMMENT ON FUNCTION public.consume_invite_token(uuid) IS 'Atomically validates and consumes an invite token. Raises invalid_or_expired_token on failure.';
