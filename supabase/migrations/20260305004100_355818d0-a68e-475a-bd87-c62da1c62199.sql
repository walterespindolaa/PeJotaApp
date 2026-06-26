
CREATE TABLE public.merchant_category_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant text NOT NULL,
  categoria text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, merchant)
);

ALTER TABLE public.merchant_category_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning" ON public.merchant_category_learning
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own learning" ON public.merchant_category_learning
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning" ON public.merchant_category_learning
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning" ON public.merchant_category_learning
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
