
-- Create storage bucket for statement PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('faturas', 'faturas', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage: only owner can access their files
CREATE POLICY "Users can upload own faturas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'faturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own faturas"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'faturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own faturas"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'faturas' AND (storage.foldername(name))[1] = auth.uid()::text);

-- credit_card_statements table
CREATE TABLE public.credit_card_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  statement_month text NOT NULL,
  source_name text NOT NULL DEFAULT 'Manual',
  file_path text,
  file_hash text,
  status text NOT NULL DEFAULT 'uploading',
  total_amount numeric NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  detected_installments integer NOT NULL DEFAULT 0,
  duplicates_skipped integer NOT NULL DEFAULT 0,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  ai_calls integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own statements" ON public.credit_card_statements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own statements" ON public.credit_card_statements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own statements" ON public.credit_card_statements FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own statements" ON public.credit_card_statements FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- credit_card_statement_lines table
CREATE TABLE public.credit_card_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.credit_card_statements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  line_index integer NOT NULL DEFAULT 0,
  raw_text text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  merchant_raw text,
  merchant_norm text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  category text,
  expense_type text,
  recurring boolean NOT NULL DEFAULT false,
  installment_total integer,
  installment_current integer,
  fingerprint text,
  status text NOT NULL DEFAULT 'pending_review',
  confidence numeric NOT NULL DEFAULT 0,
  origin text NOT NULL DEFAULT 'parser',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own statement_lines" ON public.credit_card_statement_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own statement_lines" ON public.credit_card_statement_lines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own statement_lines" ON public.credit_card_statement_lines FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own statement_lines" ON public.credit_card_statement_lines FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Audit events table for statements
CREATE TABLE public.credit_card_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.credit_card_statements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own audit_events" ON public.credit_card_audit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own audit_events" ON public.credit_card_audit_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
