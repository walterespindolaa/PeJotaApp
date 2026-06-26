
-- Add recurring fields to despesas
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dia_vencimento integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ajuste_variacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS valor_base numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mes_referencia text DEFAULT NULL;

-- Add recurring fields to receitas
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS recorrente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dia_recebimento integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS porcentagem_economia numeric DEFAULT NULL;

-- Create fechamentos_mensais table to track month closings
CREATE TABLE public.fechamentos_mensais (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  mes_ano text NOT NULL,
  fechado_em timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.fechamentos_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fechamentos" ON public.fechamentos_mensais FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own fechamentos" ON public.fechamentos_mensais FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Unique constraint: one closing per user per month
CREATE UNIQUE INDEX idx_fechamentos_user_mes ON public.fechamentos_mensais (user_id, mes_ano);
