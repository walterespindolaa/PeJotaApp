
-- bank_accounts table
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT 'checking',
  last_four text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bank_accounts" ON public.bank_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Outros',
  type text NOT NULL DEFAULT 'expense',
  source text NOT NULL DEFAULT 'manual',
  responsavel text NOT NULL DEFAULT 'Pessoa 1',
  fit_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- unique constraint to prevent duplicate OFX imports
CREATE UNIQUE INDEX idx_transactions_fit_id ON public.transactions(user_id, account_id, fit_id) WHERE fit_id IS NOT NULL;
