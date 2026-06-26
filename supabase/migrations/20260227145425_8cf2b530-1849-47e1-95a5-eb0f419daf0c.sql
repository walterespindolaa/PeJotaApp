
-- ============================================================
-- RECEITAS (income entries)
-- ============================================================
CREATE TABLE public.receitas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL DEFAULT '',
  descricao TEXT DEFAULT '',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'fixo', -- 'fixo' | 'variavel'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own receitas" ON public.receitas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own receitas" ON public.receitas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own receitas" ON public.receitas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own receitas" ON public.receitas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_receitas_updated_at BEFORE UPDATE ON public.receitas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- DESPESAS (expense entries)
-- ============================================================
CREATE TABLE public.despesas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  categoria TEXT NOT NULL DEFAULT '',
  subcategoria TEXT DEFAULT '',
  descricao TEXT DEFAULT '',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  tipo TEXT NOT NULL DEFAULT 'fixa', -- 'fixa' | 'variavel'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own despesas" ON public.despesas FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own despesas" ON public.despesas FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own despesas" ON public.despesas FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own despesas" ON public.despesas FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_despesas_updated_at BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- OBJETIVOS DE VIDA (life goals)
-- ============================================================
CREATE TABLE public.objetivos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  valor_objetivo NUMERIC(12,2) NOT NULL DEFAULT 0,
  data_objetivo DATE,
  frequencia TEXT DEFAULT '', -- '5x/ano', '1x/2 anos', etc.
  aporte_mensal NUMERIC(12,2) DEFAULT 0,
  valor_acumulado NUMERIC(12,2) DEFAULT 0,
  detalhes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.objetivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own objetivos" ON public.objetivos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own objetivos" ON public.objetivos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own objetivos" ON public.objetivos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own objetivos" ON public.objetivos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_objetivos_updated_at BEFORE UPDATE ON public.objetivos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- INVESTIMENTOS FINANCEIROS
-- ============================================================
CREATE TABLE public.investimentos_financeiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  instituicao TEXT NOT NULL DEFAULT '',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  rentabilidade_estimada NUMERIC(6,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investimentos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inv_fin" ON public.investimentos_financeiros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own inv_fin" ON public.investimentos_financeiros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inv_fin" ON public.investimentos_financeiros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inv_fin" ON public.investimentos_financeiros FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_inv_fin_updated_at BEFORE UPDATE ON public.investimentos_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- INVESTIMENTOS NÃO FINANCEIROS
-- ============================================================
CREATE TABLE public.investimentos_nao_financeiros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT '',
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  gera_renda BOOLEAN NOT NULL DEFAULT false,
  valor_renda NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.investimentos_nao_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own inv_nfin" ON public.investimentos_nao_financeiros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own inv_nfin" ON public.investimentos_nao_financeiros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own inv_nfin" ON public.investimentos_nao_financeiros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own inv_nfin" ON public.investimentos_nao_financeiros FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_inv_nfin_updated_at BEFORE UPDATE ON public.investimentos_nao_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- APOSENTADORIA (retirement planning settings per user)
-- ============================================================
CREATE TABLE public.aposentadoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  idade_atual INTEGER,
  idade_aposentadoria INTEGER DEFAULT 60,
  expectativa_vida INTEGER DEFAULT 90,
  patrimonio_atual NUMERIC(14,2) DEFAULT 0,
  renda_desejada NUMERIC(12,2) DEFAULT 0,
  taxa_nominal NUMERIC(6,4) DEFAULT 0.10,
  inflacao NUMERIC(6,4) DEFAULT 0.05,
  poupanca_mensal NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.aposentadoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own aposentadoria" ON public.aposentadoria FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own aposentadoria" ON public.aposentadoria FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own aposentadoria" ON public.aposentadoria FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_aposentadoria_updated_at BEFORE UPDATE ON public.aposentadoria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
