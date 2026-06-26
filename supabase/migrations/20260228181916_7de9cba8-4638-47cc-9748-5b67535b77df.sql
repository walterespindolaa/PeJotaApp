
-- Create table for tracking individual contributions to objectives
CREATE TABLE public.aportes_objetivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  objetivo_id UUID NOT NULL REFERENCES public.objetivos(id) ON DELETE CASCADE,
  valor NUMERIC NOT NULL DEFAULT 0,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  responsavel TEXT NOT NULL DEFAULT 'Pessoa 1',
  observacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.aportes_objetivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aportes" ON public.aportes_objetivos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own aportes" ON public.aportes_objetivos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own aportes" ON public.aportes_objetivos FOR DELETE USING (auth.uid() = user_id);
