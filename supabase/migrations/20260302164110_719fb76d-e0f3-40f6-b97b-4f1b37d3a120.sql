
-- Table: investment_expense_links (vincular despesa a investimento)
CREATE TABLE public.investment_expense_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investment_id uuid NOT NULL REFERENCES public.investimentos_financeiros(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  valor_vinculado numeric NOT NULL DEFAULT 0,
  tipo_despesa text NOT NULL DEFAULT 'fixa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(investment_id, expense_id)
);

ALTER TABLE public.investment_expense_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own links" ON public.investment_expense_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own links" ON public.investment_expense_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own links" ON public.investment_expense_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own links" ON public.investment_expense_links FOR DELETE USING (auth.uid() = user_id);

-- Table: custom_despesa_categories (categorias customizadas de despesas)
CREATE TABLE public.custom_despesa_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'ambas', -- fixa, variavel, ambas
  ordem integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE public.custom_despesa_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.custom_despesa_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own categories" ON public.custom_despesa_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.custom_despesa_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.custom_despesa_categories FOR DELETE USING (auth.uid() = user_id);
