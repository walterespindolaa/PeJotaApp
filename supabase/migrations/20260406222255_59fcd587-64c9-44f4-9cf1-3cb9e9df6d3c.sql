-- Add client_id column to business_transactions
ALTER TABLE public.business_transactions
ADD COLUMN client_id UUID REFERENCES public.business_clients(id) ON DELETE SET NULL DEFAULT NULL;

-- Index for filtering transactions by client
CREATE INDEX idx_business_transactions_client_id ON public.business_transactions(client_id);