
-- Expand investimentos_financeiros with full data structure
ALTER TABLE public.investimentos_financeiros
  ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'Renda Fixa',
  ADD COLUMN IF NOT EXISTS classe text NOT NULL DEFAULT 'Renda Fixa',
  ADD COLUMN IF NOT EXISTS quantidade numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preco_medio numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_atual numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_aportado numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indexador text DEFAULT '',
  ADD COLUMN IF NOT EXISTS taxa_contratada numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vencimento_data date,
  ADD COLUMN IF NOT EXISTS liquidez text DEFAULT 'D+0',
  ADD COLUMN IF NOT EXISTS perfil_risco text DEFAULT 'Conservador';

-- Expand investimentos_nao_financeiros for Bens e Imóveis
ALTER TABLE public.investimentos_nao_financeiros
  ADD COLUMN IF NOT EXISTS nome text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS divida_vinculada numeric DEFAULT 0;

-- Create table for cached economic indicators
CREATE TABLE IF NOT EXISTS public.indicadores_economicos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  indicador text NOT NULL UNIQUE,
  valor numeric NOT NULL DEFAULT 0,
  data_referencia date,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- indicadores_economicos is public read, no user-specific data
ALTER TABLE public.indicadores_economicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read indicators"
  ON public.indicadores_economicos
  FOR SELECT
  USING (true);

-- Create aportes_investimentos for investment contribution history
CREATE TABLE IF NOT EXISTS public.aportes_investimentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  investimento_id uuid NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.aportes_investimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aportes_inv"
  ON public.aportes_investimentos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own aportes_inv"
  ON public.aportes_investimentos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own aportes_inv"
  ON public.aportes_investimentos FOR DELETE
  USING (auth.uid() = user_id);
