ALTER TABLE public.business_transactions
  ADD COLUMN IF NOT EXISTS notes text;