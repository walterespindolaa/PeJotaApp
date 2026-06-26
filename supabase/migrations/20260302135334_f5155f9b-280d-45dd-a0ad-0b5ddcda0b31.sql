
CREATE TABLE public.planejamento_negocio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mes_ano text NOT NULL,
  receita_planejada numeric NOT NULL DEFAULT 0,
  despesa_planejada numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes_ano)
);

ALTER TABLE public.planejamento_negocio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan_neg" ON public.planejamento_negocio FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own plan_neg" ON public.planejamento_negocio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plan_neg" ON public.planejamento_negocio FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plan_neg" ON public.planejamento_negocio FOR DELETE USING (auth.uid() = user_id);
