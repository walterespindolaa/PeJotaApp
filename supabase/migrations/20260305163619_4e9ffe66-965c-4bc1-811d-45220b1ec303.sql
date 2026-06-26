
-- 1) business_recurring_templates
CREATE TABLE public.business_recurring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'out',
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category_id uuid REFERENCES public.business_categories(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  due_day integer NOT NULL DEFAULT 1,
  start_month date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  end_month date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT due_day_range CHECK (due_day >= 1 AND due_day <= 28)
);

ALTER TABLE public.business_recurring_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own brt" ON public.business_recurring_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) business_recurring_instances
CREATE TABLE public.business_recurring_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.business_recurring_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month_ref date NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamptz,
  transaction_id uuid REFERENCES public.business_transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, month_ref)
);

ALTER TABLE public.business_recurring_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bri" ON public.business_recurring_instances
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER update_brt_updated_at BEFORE UPDATE ON public.business_recurring_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bri_updated_at BEFORE UPDATE ON public.business_recurring_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
