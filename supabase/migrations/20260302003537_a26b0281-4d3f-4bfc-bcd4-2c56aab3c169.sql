
-- Table for proventos
CREATE TABLE public.proventos_investimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investimento_id uuid NOT NULL,
  tipo_provento text NOT NULL DEFAULT 'Dividendo',
  valor numeric NOT NULL DEFAULT 0,
  mes_referencia date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  observacao text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.proventos_investimentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proventos" ON public.proventos_investimentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own proventos" ON public.proventos_investimentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own proventos" ON public.proventos_investimentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own proventos" ON public.proventos_investimentos FOR DELETE USING (auth.uid() = user_id);

-- Optional fields on investimentos_financeiros for proventos schedule
ALTER TABLE public.investimentos_financeiros
  ADD COLUMN IF NOT EXISTS recebe_proventos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS frequencia_proventos text NOT NULL DEFAULT 'sem_proventos',
  ADD COLUMN IF NOT EXISTS meses_proventos text DEFAULT '';
