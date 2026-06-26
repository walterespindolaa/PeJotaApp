
-- Manual credit card tracking (not connected to bank, just user input)
CREATE TABLE public.cartoes_credito (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  mes_ano TEXT NOT NULL,
  valor_fatura NUMERIC NOT NULL DEFAULT 0,
  observacao TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cartoes_credito ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cartoes" ON public.cartoes_credito FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cartoes" ON public.cartoes_credito FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cartoes" ON public.cartoes_credito FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cartoes" ON public.cartoes_credito FOR DELETE USING (auth.uid() = user_id);
