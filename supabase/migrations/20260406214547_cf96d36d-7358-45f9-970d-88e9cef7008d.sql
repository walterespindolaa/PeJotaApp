CREATE TABLE public.business_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  document text,
  document_type text CHECK (document_type IN ('cpf', 'cnpj')) DEFAULT 'cpf',
  email text,
  phone text,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own clients"
  ON public.business_clients
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_business_clients_company ON public.business_clients(company_id);
CREATE INDEX idx_business_clients_user ON public.business_clients(user_id);