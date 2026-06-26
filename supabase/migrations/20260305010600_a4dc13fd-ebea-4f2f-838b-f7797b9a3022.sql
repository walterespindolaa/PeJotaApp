
-- Credit cards table
CREATE TABLE public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  issuer text NOT NULL DEFAULT '',
  last_four_digits text,
  limit_amount numeric NOT NULL DEFAULT 0,
  closing_day integer NOT NULL DEFAULT 1,
  due_day integer NOT NULL DEFAULT 10,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own credit_cards" ON public.credit_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add card_id to statements
ALTER TABLE public.credit_card_statements ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.credit_cards(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON public.credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_statements_card ON public.credit_card_statements(card_id);
CREATE INDEX IF NOT EXISTS idx_cc_audit_statement ON public.credit_card_audit_events(statement_id);
CREATE INDEX IF NOT EXISTS idx_cc_lines_statement ON public.credit_card_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_cc_lines_fingerprint ON public.credit_card_statement_lines(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_cc_statements_user ON public.credit_card_statements(user_id, created_at DESC);
