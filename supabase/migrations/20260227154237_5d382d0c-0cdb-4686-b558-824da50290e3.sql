
-- Table for monthly category budgets
CREATE TABLE public.orcamentos_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mes_ano TEXT NOT NULL,
  categoria TEXT NOT NULL,
  valor_limite NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes_ano, categoria)
);

ALTER TABLE public.orcamentos_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orcamentos" ON public.orcamentos_categorias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own orcamentos" ON public.orcamentos_categorias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own orcamentos" ON public.orcamentos_categorias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own orcamentos" ON public.orcamentos_categorias FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_orcamentos_updated_at
BEFORE UPDATE ON public.orcamentos_categorias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
