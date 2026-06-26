
-- Create meses_iniciados table to prevent duplication
CREATE TABLE public.meses_iniciados (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  mes_ano text NOT NULL,
  origem text NOT NULL DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.meses_iniciados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meses_iniciados" ON public.meses_iniciados FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own meses_iniciados" ON public.meses_iniciados FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_meses_iniciados_user_mes ON public.meses_iniciados (user_id, mes_ano);
