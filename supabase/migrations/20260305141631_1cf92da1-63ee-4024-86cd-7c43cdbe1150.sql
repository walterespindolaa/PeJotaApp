
-- 1) Companies table (multi-business, max 3 per user)
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Minha Empresa',
  business_type text NOT NULL DEFAULT 'other',
  currency text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own companies" ON public.companies FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) Allocation rules (percentage provisioning with base)
CREATE TABLE public.allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  base text NOT NULL DEFAULT 'revenue',
  percentage numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own allocation_rules" ON public.allocation_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) Business categories
CREATE TABLE public.business_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '❓',
  direction text NOT NULL DEFAULT 'out',
  description text,
  sort_order integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own business_categories" ON public.business_categories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) Business transactions (company-scoped)
CREATE TABLE public.business_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'in',
  category_id uuid REFERENCES public.business_categories(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  external_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own business_transactions" ON public.business_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Unique constraint for dedup
CREATE UNIQUE INDEX idx_biz_tx_dedup ON public.business_transactions (company_id, external_hash) WHERE external_hash IS NOT NULL;

-- 5) Business imports log
CREATE TABLE public.business_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  filename text,
  rows_imported integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own business_imports" ON public.business_imports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6) Selected company preference on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selected_company_id uuid;
