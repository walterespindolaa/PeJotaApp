
-- Cross-ledger links: PJ → PF integration
CREATE TABLE public.cross_ledger_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pj_transaction_id UUID NOT NULL REFERENCES public.business_transactions(id) ON DELETE CASCADE,
  pf_entry_type TEXT NOT NULL DEFAULT 'receita',
  pf_category TEXT NOT NULL DEFAULT 'Pró-labore',
  pf_amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'prolabore',
  month_ref DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cross_ledger_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cross_ledger_links"
  ON public.cross_ledger_links
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
