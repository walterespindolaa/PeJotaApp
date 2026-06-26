
-- Add status and corresponde to receitas
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS corresponde text DEFAULT '';

-- Add vencimento, forma_pagamento, status, parcel fields to despesas
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS vencimento integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT '',
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'a_pagar',
  ADD COLUMN IF NOT EXISTS is_parcelada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_total numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_parcelas integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_atual integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS data_inicio_parcelas date DEFAULT NULL;

-- Create economias table
CREATE TABLE public.economias (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  destino_tipo text NOT NULL DEFAULT '',
  destino_id uuid DEFAULT NULL,
  descricao text DEFAULT '',
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.economias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own economias" ON public.economias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own economias" ON public.economias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own economias" ON public.economias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own economias" ON public.economias FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_economias_updated_at BEFORE UPDATE ON public.economias FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
