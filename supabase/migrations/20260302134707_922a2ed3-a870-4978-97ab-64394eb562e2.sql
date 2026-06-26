
-- Tabela de empresa do usuário (1 por user)
CREATE TABLE public.empresas_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome_empresa text NOT NULL DEFAULT 'Minha Empresa',
  percentual_imposto numeric NOT NULL DEFAULT 15,
  percentual_reinvestimento numeric NOT NULL DEFAULT 10,
  percentual_pro_labore numeric NOT NULL DEFAULT 40,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.empresas_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own empresa" ON public.empresas_usuario FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own empresa" ON public.empresas_usuario FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own empresa" ON public.empresas_usuario FOR UPDATE USING (auth.uid() = user_id);

-- Tabela de lançamentos do negócio
CREATE TABLE public.lancamentos_negocio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'entrada',
  descricao text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lancamentos_negocio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own lancamentos_neg" ON public.lancamentos_negocio FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own lancamentos_neg" ON public.lancamentos_negocio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own lancamentos_neg" ON public.lancamentos_negocio FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own lancamentos_neg" ON public.lancamentos_negocio FOR DELETE USING (auth.uid() = user_id);
