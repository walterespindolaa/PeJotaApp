ALTER TABLE public.business_transactions
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.business_clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS notes text;
