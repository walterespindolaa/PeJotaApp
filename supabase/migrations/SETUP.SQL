-- ATLAS FULL DATABASE SETUP
-- generated from migrations

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT DEFAULT '',
  age INTEGER,
  marital_status TEXT DEFAULT '',
  dependents INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Create plan enum and user_plans table for access control
CREATE TYPE public.plan_tier AS ENUM ('organiza_2026', 'planejamento_360');

CREATE TABLE public.user_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  tier plan_tier NOT NULL DEFAULT 'organiza_2026',
  active BOOLEAN NOT NULL DEFAULT true,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan" ON public.user_plans FOR SELECT USING (auth.uid() = user_id);

-- Helper function to check user tier
CREATE OR REPLACE FUNCTION public.get_user_tier(_user_id UUID)
RETURNS plan_tier
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tier FROM public.user_plans WHERE user_id = _user_id AND active = true LIMIT 1;
$$;

-- Helper function to check if user has planejamento 360
CREATE OR REPLACE FUNCTION public.has_planejamento_360(_user_id UUID)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_plans WHERE user_id = _user_id AND tier = 'planejamento_360' AND active = true
  );
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  
  INSERT INTO public.user_plans (user_id, tier)
  VALUES (NEW.id, 'organiza_2026');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



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


-- Enable required extensions for cron
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;



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



-- Add responsavel to receitas, despesas, economias
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT 'Pessoa 1';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT 'Pessoa 1';
ALTER TABLE public.economias ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT 'Pessoa 1';

-- Add tipo_parcelamento to despesas (divida or compra_parcelada)
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS tipo_parcelamento text NOT NULL DEFAULT 'compra_parcelada';

-- Add person names to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome_pessoa1 text NOT NULL DEFAULT 'Pessoa 1';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome_pessoa2 text NOT NULL DEFAULT 'Pessoa 2';



-- Add responsavel and imagem_url to objetivos
ALTER TABLE public.objetivos ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT 'Pessoa 1';
ALTER TABLE public.objetivos ADD COLUMN IF NOT EXISTS imagem_url text;



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


-- Add foto_url columns for person avatars
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_pessoa1 text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_pessoa2 text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vinculo_pessoa2 text DEFAULT 'Cônjuge';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pessoa2_participa_geral boolean DEFAULT true;



-- Add theme preferences to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tema_sidebar text NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS tema_destaque text NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS tema_modo text NOT NULL DEFAULT 'system';


-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Allow authenticated users to upload their own avatars
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow anyone to view avatars (public bucket)
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Allow users to update/delete their own avatars
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);



-- Table to store monthly payment status for recurring/virtual items
CREATE TABLE public.pagamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ref_type text NOT NULL DEFAULT 'despesa', -- 'ganho' | 'despesa' | 'parcela'
  ref_id uuid NOT NULL,
  mes text NOT NULL, -- 'YYYY-MM'
  status text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'pago' | 'recebido' | 'atrasado'
  pago_em date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint for upsert
CREATE UNIQUE INDEX idx_pagamentos_unique ON public.pagamentos (user_id, ref_type, ref_id, mes);

-- Enable RLS
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pagamentos" ON public.pagamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pagamentos" ON public.pagamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pagamentos" ON public.pagamentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pagamentos" ON public.pagamentos FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();



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



-- Allow authenticated users to update indicadores (admin manual edit)
CREATE POLICY "Authenticated users can update indicators"
ON public.indicadores_economicos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert indicators (for edge function fallback)
CREATE POLICY "Authenticated users can insert indicators"
ON public.indicadores_economicos
FOR INSERT
TO authenticated
WITH CHECK (true);



-- 1) ENUMs
CREATE TYPE public.subscription_status AS ENUM ('active', 'expired', 'grace', 'blocked', 'canceled');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2) user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3) has_role function FIRST (before policies that use it)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 4) RLS policies for user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 5) subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan text NOT NULL DEFAULT 'organiza_2026',
  source text NOT NULL DEFAULT 'manual',
  status subscription_status NOT NULL DEFAULT 'active',
  start_at timestamptz NOT NULL DEFAULT now(),
  end_at timestamptz NOT NULL DEFAULT (now() + interval '12 months'),
  grace_end_at timestamptz NOT NULL DEFAULT (now() + interval '18 months'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subscription"
  ON public.subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all subscriptions"
  ON public.subscriptions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 6) audit_logs table
CREATE TABLE public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON public.audit_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert audit logs"
  ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert audit logs"
  ON public.audit_logs FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Service can select audit logs"
  ON public.audit_logs FOR SELECT TO service_role
  USING (true);

-- 7) Update handle_new_user to assign 'user' role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_plans (user_id, tier)
  VALUES (NEW.id, 'organiza_2026');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

-- 8) updated_at trigger for subscriptions
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);



-- Table for custom password reset tokens
CREATE TABLE public.password_resets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);

-- Enable RLS
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Only service role (edge functions) can read/write
CREATE POLICY "Service role full access" ON public.password_resets
  FOR ALL USING (true) WITH CHECK (true);

-- Index for fast token lookup
CREATE INDEX idx_password_resets_token_hash ON public.password_resets(token_hash);
CREATE INDEX idx_password_resets_email ON public.password_resets(email);

-- Auto-cleanup: delete used/expired tokens older than 24h
-- (can be run via cron later)



-- Add columns to persist incluir_bens toggle and renda_passiva_atual
ALTER TABLE public.aposentadoria
  ADD COLUMN IF NOT EXISTS incluir_bens boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renda_passiva_atual numeric DEFAULT 0;



-- Create cashflow_entries ledger table
CREATE TABLE public.cashflow_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL DEFAULT 'expense',
  category text NOT NULL DEFAULT '',
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cashflow_entries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own cashflow" ON public.cashflow_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cashflow" ON public.cashflow_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cashflow" ON public.cashflow_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cashflow" ON public.cashflow_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast period queries
CREATE INDEX idx_cashflow_entries_user_date ON public.cashflow_entries (user_id, date);




-- Add missing columns to cashflow_entries
ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS payment_method text NULL,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_rule text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Add more useful indexes
CREATE INDEX IF NOT EXISTS idx_cashflow_type_date ON public.cashflow_entries (user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_cashflow_category ON public.cashflow_entries (user_id, category);

-- Add updated_at trigger
CREATE TRIGGER update_cashflow_entries_updated_at
  BEFORE UPDATE ON public.cashflow_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();



-- Add is_reserva_emergencia column to investimentos_financeiros
ALTER TABLE public.investimentos_financeiros 
ADD COLUMN is_reserva_emergencia boolean NOT NULL DEFAULT false;

-- Create portfolio_snapshots table for monthly portfolio history
CREATE TABLE public.portfolio_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month_ref text NOT NULL,
  total_value numeric NOT NULL DEFAULT 0,
  total_contributions numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one snapshot per user per month
ALTER TABLE public.portfolio_snapshots ADD CONSTRAINT portfolio_snapshots_user_month UNIQUE (user_id, month_ref);

-- Enable RLS
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON public.portfolio_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own snapshots" ON public.portfolio_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshots" ON public.portfolio_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own snapshots" ON public.portfolio_snapshots FOR DELETE USING (auth.uid() = user_id);


-- Create storage bucket for email assets
INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "Email assets are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');



ALTER TABLE public.investimentos_nao_financeiros
  ADD COLUMN IF NOT EXISTS tipo_renda text DEFAULT '',
  ADD COLUMN IF NOT EXISTS observacao_renda text DEFAULT '';



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



-- =============================================
-- 1) LOCK DOWN password_resets table
-- =============================================
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Remove existing permissive policy
DROP POLICY IF EXISTS "Service role full access" ON public.password_resets;
DROP POLICY IF EXISTS "Enable read for all" ON public.password_resets;
DROP POLICY IF EXISTS "public read" ON public.password_resets;

-- Only service_role can access
CREATE POLICY "service_role_full_access_password_resets"
ON public.password_resets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Explicitly deny authenticated users
CREATE POLICY "deny_select_authenticated_password_resets"
ON public.password_resets
FOR SELECT
TO authenticated
USING (false);

-- =============================================
-- 2) LOCK DOWN indicadores_economicos write
-- =============================================
ALTER TABLE public.indicadores_economicos ENABLE ROW LEVEL SECURITY;

-- Remove permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert indicators" ON public.indicadores_economicos;
DROP POLICY IF EXISTS "Authenticated users can update indicators" ON public.indicadores_economicos;
DROP POLICY IF EXISTS "Anyone can read indicators" ON public.indicadores_economicos;

-- Public read stays open
CREATE POLICY "anyone_can_read_indicators"
ON public.indicadores_economicos
FOR SELECT
TO public
USING (true);

-- Only admins can insert
CREATE POLICY "admins_can_insert_indicators"
ON public.indicadores_economicos
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "admins_can_update_indicators"
ON public.indicadores_economicos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role full access (for edge functions)
CREATE POLICY "service_role_full_access_indicators"
ON public.indicadores_economicos
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);



-- Create user_subscriptions table for SaaS trial system
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  plan_tier text NOT NULL DEFAULT 'free' CHECK (plan_tier IN ('free', 'full')),
  access_state text NOT NULL DEFAULT 'trial' CHECK (access_state IN ('trial', 'grace', 'active', 'restricted')),
  origin text NOT NULL DEFAULT 'manual',
  trial_started_at timestamptz NOT NULL DEFAULT now(),
  trial_expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  grace_finance_until timestamptz NOT NULL DEFAULT (now() + interval '28 days'),
  restricted_at timestamptz,
  scheduled_deletion_at timestamptz NOT NULL DEFAULT (now() + interval '88 days'),
  deleted_at timestamptz,
  bonus_days_full int NOT NULL DEFAULT 0,
  bonus_days_grace int NOT NULL DEFAULT 0,
  retention_extra_days int NOT NULL DEFAULT 0,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own user_subscription"
ON public.user_subscriptions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access user_subscriptions"
ON public.user_subscriptions FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Admins can manage all
CREATE POLICY "Admins can manage user_subscriptions"
ON public.user_subscriptions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
BEFORE UPDATE ON public.user_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user to also create user_subscriptions row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_plans (user_id, tier)
  VALUES (NEW.id, 'organiza_2026');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin)
  VALUES (NEW.id, 'free', 'trial', 'manual');

  RETURN NEW;
END;
$$;

-- Migrate existing users with active subscriptions to 'full' + 'active'
INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin, trial_started_at, trial_expires_at, grace_finance_until, restricted_at, scheduled_deletion_at)
SELECT
  s.user_id,
  'full',
  'active',
  s.source,
  s.start_at,
  s.start_at, -- trial already expired (they paid)
  s.start_at, -- not in grace
  NULL,
  s.end_at + interval '60 days'
FROM public.subscriptions s
WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = s.user_id)
ON CONFLICT (user_id) DO NOTHING;

-- Also create for users who have no subscription at all (set as trial)
INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin)
SELECT u.id, 'free', 'trial', 'manual'
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = u.id);



-- Fix existing admins: ensure they have full/active user_subscriptions
INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin, trial_expires_at, grace_finance_until, scheduled_deletion_at)
SELECT ur.user_id, 'full', 'active', 'admin',
  now() + interval '999 years',
  now() + interval '999 years',
  now() + interval '999 years'
FROM public.user_roles ur
WHERE ur.role = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_subscriptions us WHERE us.user_id = ur.user_id
  );

-- Update existing admin subscriptions to full/active
UPDATE public.user_subscriptions us
SET plan_tier = 'full',
    access_state = 'active',
    updated_at = now()
FROM public.user_roles ur
WHERE ur.user_id = us.user_id
  AND ur.role = 'admin'
  AND (us.plan_tier != 'full' OR us.access_state != 'active');



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




CREATE TABLE public.planejamento_negocio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mes_ano text NOT NULL,
  receita_planejada numeric NOT NULL DEFAULT 0,
  despesa_planejada numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, mes_ano)
);

ALTER TABLE public.planejamento_negocio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan_neg" ON public.planejamento_negocio FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own plan_neg" ON public.planejamento_negocio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plan_neg" ON public.planejamento_negocio FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plan_neg" ON public.planejamento_negocio FOR DELETE USING (auth.uid() = user_id);



CREATE TABLE public.atlas_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  score integer NOT NULL,
  label text NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_atlas_score_unique ON public.atlas_score_snapshots (user_id, period_start, period_end, snapshot_date);

ALTER TABLE public.atlas_score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own atlas snapshots"
ON public.atlas_score_snapshots FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own atlas snapshots"
ON public.atlas_score_snapshots FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own atlas snapshots"
ON public.atlas_score_snapshots FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own atlas snapshots"
ON public.atlas_score_snapshots FOR DELETE
USING (auth.uid() = user_id);



-- Table: investment_expense_links (vincular despesa a investimento)
CREATE TABLE public.investment_expense_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investment_id uuid NOT NULL REFERENCES public.investimentos_financeiros(id) ON DELETE CASCADE,
  expense_id uuid NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  valor_vinculado numeric NOT NULL DEFAULT 0,
  tipo_despesa text NOT NULL DEFAULT 'fixa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(investment_id, expense_id)
);

ALTER TABLE public.investment_expense_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own links" ON public.investment_expense_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own links" ON public.investment_expense_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own links" ON public.investment_expense_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own links" ON public.investment_expense_links FOR DELETE USING (auth.uid() = user_id);

-- Table: custom_despesa_categories (categorias customizadas de despesas)
CREATE TABLE public.custom_despesa_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'ambas', -- fixa, variavel, ambas
  ordem integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE public.custom_despesa_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.custom_despesa_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own categories" ON public.custom_despesa_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.custom_despesa_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.custom_despesa_categories FOR DELETE USING (auth.uid() = user_id);



-- Add full_expires_at and full_expire_action to user_subscriptions
ALTER TABLE public.user_subscriptions
  ADD COLUMN IF NOT EXISTS full_expires_at timestamp with time zone DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS full_expire_action text NOT NULL DEFAULT 'restrict';

-- Comment for clarity
COMMENT ON COLUMN public.user_subscriptions.full_expires_at IS 'When FULL plan expires. Must be set when plan_tier=full.';
COMMENT ON COLUMN public.user_subscriptions.full_expire_action IS 'Action on FULL expiry: restrict (default)';



-- Create installment_instances table for per-month parcela tracking
CREATE TABLE public.installment_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  installment_id UUID NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL, -- YYYY-MM
  due_date DATE NOT NULL,
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(installment_id, competencia)
);

-- Enable RLS
ALTER TABLE public.installment_instances ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own installment_instances"
ON public.installment_instances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own installment_instances"
ON public.installment_instances FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own installment_instances"
ON public.installment_instances FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own installment_instances"
ON public.installment_instances FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_installment_instances_updated_at
BEFORE UPDATE ON public.installment_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_installment_instances_user_comp ON public.installment_instances(user_id, competencia);
CREATE INDEX idx_installment_instances_installment ON public.installment_instances(installment_id);



-- Payment alerts table
CREATE TABLE public.payment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source_type text NOT NULL DEFAULT 'fixed_expense',
  source_id uuid NOT NULL,
  due_date date NOT NULL,
  reminder_offsets integer[] NOT NULL DEFAULT '{7,3,1}',
  custom_message text,
  linked_investment_id uuid,
  status text NOT NULL DEFAULT 'scheduled',
  triggered_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own payment_alerts" ON public.payment_alerts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own payment_alerts" ON public.payment_alerts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own payment_alerts" ON public.payment_alerts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own payment_alerts" ON public.payment_alerts FOR DELETE USING (auth.uid() = user_id);

-- Payment alert events (one per offset to avoid duplicates)
CREATE TABLE public.payment_alert_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES public.payment_alerts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  offset_days integer NOT NULL,
  scheduled_for date NOT NULL,
  sent_at timestamptz,
  dismissed_at timestamptz,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_alert_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own alert_events" ON public.payment_alert_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own alert_events" ON public.payment_alert_events FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own alert_events" ON public.payment_alert_events FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own alert_events" ON public.payment_alert_events FOR DELETE USING (auth.uid() = user_id);

-- Index for fast lookups
CREATE INDEX idx_payment_alerts_user_status ON public.payment_alerts(user_id, status);
CREATE INDEX idx_payment_alert_events_scheduled ON public.payment_alert_events(user_id, scheduled_for);



CREATE TABLE public.merchant_category_learning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant text NOT NULL,
  categoria text NOT NULL,
  confidence numeric NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, merchant)
);

ALTER TABLE public.merchant_category_learning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning" ON public.merchant_category_learning
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can create own learning" ON public.merchant_category_learning
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning" ON public.merchant_category_learning
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning" ON public.merchant_category_learning
  FOR DELETE TO authenticated USING (auth.uid() = user_id);



-- credit_card_installments for reconciliation (Topic 22)
CREATE TABLE public.credit_card_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint text NOT NULL,
  merchant text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  total_installments integer NOT NULL DEFAULT 1,
  started_at text NOT NULL,
  last_seen_at text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, fingerprint)
);
ALTER TABLE public.credit_card_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cc_installments" ON public.credit_card_installments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cc_installments" ON public.credit_card_installments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cc_installments" ON public.credit_card_installments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cc_installments" ON public.credit_card_installments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- merchant_rules for learning (Topic 23) — replaces/extends merchant_category_learning
CREATE TABLE public.merchant_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant_norm text NOT NULL,
  category text NOT NULL,
  type text NOT NULL DEFAULT 'variavel',
  recurring_default boolean NOT NULL DEFAULT false,
  confidence numeric NOT NULL DEFAULT 0.5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, merchant_norm)
);
ALTER TABLE public.merchant_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own merchant_rules" ON public.merchant_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own merchant_rules" ON public.merchant_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own merchant_rules" ON public.merchant_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own merchant_rules" ON public.merchant_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- pattern_rules for learning (Topic 23)
CREATE TABLE public.pattern_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pattern text NOT NULL,
  category text NOT NULL,
  type text NOT NULL DEFAULT 'variavel',
  confidence numeric NOT NULL DEFAULT 0.5,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pattern_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pattern_rules" ON public.pattern_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pattern_rules" ON public.pattern_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pattern_rules" ON public.pattern_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pattern_rules" ON public.pattern_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ai_inference_cache for cost reduction (Topic 24)
CREATE TABLE public.ai_inference_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint text NOT NULL,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, fingerprint)
);
ALTER TABLE public.ai_inference_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ai_cache" ON public.ai_inference_cache FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own ai_cache" ON public.ai_inference_cache FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_cache" ON public.ai_inference_cache FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- fatura_import_logs for observability (Topic 24)
CREATE TABLE public.fatura_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text,
  provider_used text,
  total_transactions integer NOT NULL DEFAULT 0,
  resolved_by_rules integer NOT NULL DEFAULT 0,
  resolved_by_cache integer NOT NULL DEFAULT 0,
  sent_to_ai integer NOT NULL DEFAULT 0,
  ai_fallback_used boolean NOT NULL DEFAULT false,
  estimated_tokens integer NOT NULL DEFAULT 0,
  processing_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fatura_import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own import_logs" ON public.fatura_import_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own import_logs" ON public.fatura_import_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all import_logs" ON public.fatura_import_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));



-- Create storage bucket for statement PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('faturas', 'faturas', false)
ON CONFLICT (id) DO NOTHING;

-- RLS for storage: only owner can access their files
CREATE POLICY "Users can upload own faturas"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'faturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own faturas"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'faturas' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own faturas"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'faturas' AND (storage.foldername(name))[1] = auth.uid()::text);

-- credit_card_statements table
CREATE TABLE public.credit_card_statements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  statement_month text NOT NULL,
  source_name text NOT NULL DEFAULT 'Manual',
  file_path text,
  file_hash text,
  status text NOT NULL DEFAULT 'uploading',
  total_amount numeric NOT NULL DEFAULT 0,
  total_items integer NOT NULL DEFAULT 0,
  detected_installments integer NOT NULL DEFAULT 0,
  duplicates_skipped integer NOT NULL DEFAULT 0,
  tokens_in integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  ai_calls integer NOT NULL DEFAULT 0,
  estimated_cost_usd numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own statements" ON public.credit_card_statements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own statements" ON public.credit_card_statements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own statements" ON public.credit_card_statements FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own statements" ON public.credit_card_statements FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- credit_card_statement_lines table
CREATE TABLE public.credit_card_statement_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.credit_card_statements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  line_index integer NOT NULL DEFAULT 0,
  raw_text text,
  purchase_date date NOT NULL DEFAULT CURRENT_DATE,
  merchant_raw text,
  merchant_norm text,
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BRL',
  category text,
  expense_type text,
  recurring boolean NOT NULL DEFAULT false,
  installment_total integer,
  installment_current integer,
  fingerprint text,
  status text NOT NULL DEFAULT 'pending_review',
  confidence numeric NOT NULL DEFAULT 0,
  origin text NOT NULL DEFAULT 'parser',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_statement_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own statement_lines" ON public.credit_card_statement_lines FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own statement_lines" ON public.credit_card_statement_lines FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own statement_lines" ON public.credit_card_statement_lines FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own statement_lines" ON public.credit_card_statement_lines FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Audit events table for statements
CREATE TABLE public.credit_card_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id uuid NOT NULL REFERENCES public.credit_card_statements(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_type text NOT NULL,
  detail jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_card_audit_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create own audit_events" ON public.credit_card_audit_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own audit_events" ON public.credit_card_audit_events FOR SELECT TO authenticated USING (auth.uid() = user_id);



-- Credit cards table
CREATE TABLE public.credit_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  issuer text NOT NULL DEFAULT '',
  last_four_digits text,
  limit_amount numeric NOT NULL DEFAULT 0,
  closing_day integer NOT NULL DEFAULT 1,
  due_day integer NOT NULL DEFAULT 10,
  currency text NOT NULL DEFAULT 'BRL',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own credit_cards" ON public.credit_cards FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Add card_id to statements
ALTER TABLE public.credit_card_statements ADD COLUMN IF NOT EXISTS card_id uuid REFERENCES public.credit_cards(id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_cards_user ON public.credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_cc_statements_card ON public.credit_card_statements(card_id);
CREATE INDEX IF NOT EXISTS idx_cc_audit_statement ON public.credit_card_audit_events(statement_id);
CREATE INDEX IF NOT EXISTS idx_cc_lines_statement ON public.credit_card_statement_lines(statement_id);
CREATE INDEX IF NOT EXISTS idx_cc_lines_fingerprint ON public.credit_card_statement_lines(user_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_cc_statements_user ON public.credit_card_statements(user_id, created_at DESC);



-- 1) Rate limit table
CREATE TABLE public.user_rate_limits (
  user_id uuid NOT NULL PRIMARY KEY,
  minute_key text NOT NULL DEFAULT '',
  minute_count int NOT NULL DEFAULT 0,
  day_key text NOT NULL DEFAULT '',
  day_count int NOT NULL DEFAULT 0,
  ai_minute_key text NOT NULL DEFAULT '',
  ai_minute_count int NOT NULL DEFAULT 0,
  ai_day_key text NOT NULL DEFAULT '',
  ai_day_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_rate_limits_day_key ON public.user_rate_limits(day_key);
CREATE INDEX idx_user_rate_limits_minute_key ON public.user_rate_limits(minute_key);

ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rate limits" ON public.user_rate_limits
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rate limits" ON public.user_rate_limits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rate limits" ON public.user_rate_limits
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2) Fingerprint v2 columns on credit_card_statements
ALTER TABLE public.credit_card_statements
  ADD COLUMN IF NOT EXISTS statement_fingerprint_v2 text,
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS card_last4 text,
  ADD COLUMN IF NOT EXISTS top5_signature text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_statements_fingerprint_v2
  ON public.credit_card_statements(user_id, statement_fingerprint_v2)
  WHERE statement_fingerprint_v2 IS NOT NULL;

-- 3) Idempotency key on statement lines
ALTER TABLE public.credit_card_statement_lines
  ADD COLUMN IF NOT EXISTS idempotency_key text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_lines_idempotency_key
  ON public.credit_card_statement_lines(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;


ALTER TABLE public.ai_inference_cache ADD COLUMN IF NOT EXISTS statement_id uuid DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_inference_cache_statement_id ON public.ai_inference_cache(statement_id);



ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pt-BR',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;



CREATE OR REPLACE FUNCTION public.validate_profile_preferences()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.language NOT IN ('pt-BR', 'en', 'es') THEN
    RAISE EXCEPTION 'Invalid language value';
  END IF;
  IF NEW.currency NOT IN ('BRL', 'USD', 'EUR', 'GBP') THEN
    RAISE EXCEPTION 'Invalid currency value';
  END IF;
  IF NEW.onboarding_completed = true AND (NEW.full_name IS NULL OR trim(NEW.full_name) = '') THEN
    RAISE EXCEPTION 'full_name required for onboarding';
  END IF;
  RETURN NEW;
END;
$$



DROP TRIGGER IF EXISTS trg_validate_profile_preferences ON public.profiles;
CREATE TRIGGER trg_validate_profile_preferences
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_preferences();

UPDATE public.profiles SET onboarding_completed = true, onboarding_completed_at = now() WHERE full_name IS NOT NULL AND trim(full_name) != ''



-- 1) Companies table (multi-business, max 3 per user)
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'Minha Empresa',
  business_type text NOT NULL DEFAULT 'other',
  currency text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own companies" ON public.companies FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 2) Allocation rules (percentage provisioning with base)
CREATE TABLE public.allocation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'expense',
  base text NOT NULL DEFAULT 'revenue',
  percentage numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.allocation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own allocation_rules" ON public.allocation_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 3) Business categories
CREATE TABLE public.business_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '❓',
  direction text NOT NULL DEFAULT 'out',
  description text,
  sort_order integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own business_categories" ON public.business_categories FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4) Business transactions (company-scoped)
CREATE TABLE public.business_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  direction text NOT NULL DEFAULT 'in',
  category_id uuid REFERENCES public.business_categories(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual',
  external_hash text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own business_transactions" ON public.business_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Unique constraint for dedup
CREATE UNIQUE INDEX idx_biz_tx_dedup ON public.business_transactions (company_id, external_hash) WHERE external_hash IS NOT NULL;

-- 5) Business imports log
CREATE TABLE public.business_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  filename text,
  rows_imported integer NOT NULL DEFAULT 0,
  rows_skipped integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.business_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own business_imports" ON public.business_imports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 6) Selected company preference on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS selected_company_id uuid;


-- Weekly email preferences on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS weekly_email_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_email_day integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weekly_email_hour integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS weekly_email_timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  ADD COLUMN IF NOT EXISTS last_weekly_email_sent_at timestamptz;

-- AI usage tracking table
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  questions_used integer NOT NULL DEFAULT 0,
  daily_limit integer NOT NULL DEFAULT 5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own ai_usage"
  ON public.ai_usage FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);



-- 1) business_recurring_templates
CREATE TABLE public.business_recurring_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'out',
  title text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  category_id uuid REFERENCES public.business_categories(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'monthly',
  due_day integer NOT NULL DEFAULT 1,
  start_month date NOT NULL DEFAULT (date_trunc('month', CURRENT_DATE))::date,
  end_month date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT due_day_range CHECK (due_day >= 1 AND due_day <= 28)
);

ALTER TABLE public.business_recurring_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own brt" ON public.business_recurring_templates
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2) business_recurring_instances
CREATE TABLE public.business_recurring_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.business_recurring_templates(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  month_ref date NOT NULL,
  due_date date NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  confirmed_at timestamptz,
  transaction_id uuid REFERENCES public.business_transactions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, month_ref)
);

ALTER TABLE public.business_recurring_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bri" ON public.business_recurring_instances
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- updated_at triggers
CREATE TRIGGER update_brt_updated_at BEFORE UPDATE ON public.business_recurring_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bri_updated_at BEFORE UPDATE ON public.business_recurring_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



-- Cross-ledger links: PJ → PF integration
CREATE TABLE public.cross_ledger_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  pj_transaction_id UUID NOT NULL REFERENCES public.business_transactions(id) ON DELETE CASCADE,
  pf_entry_type TEXT NOT NULL DEFAULT 'receita',
  pf_category TEXT NOT NULL DEFAULT 'Pró-labore',
  pf_amount NUMERIC NOT NULL DEFAULT 0,
  type TEXT NOT NULL DEFAULT 'prolabore',
  month_ref DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cross_ledger_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own cross_ledger_links"
  ON public.cross_ledger_links
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


ALTER TABLE public.allocation_rules ADD COLUMN IF NOT EXISTS category_ids uuid[] DEFAULT '{}'::uuid[];


-- Households table
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Minha Família',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Household members table
CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('active', 'invited', 'removed')),
  invited_email text,
  display_name text,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Function to check household membership
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE user_id = _user_id
      AND household_id = _household_id
      AND status = 'active'
  )
$$;

-- Function to check household ownership
CREATE OR REPLACE FUNCTION public.is_household_owner(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = _household_id
      AND owner_id = _user_id
  )
$$;

-- RLS policies for households
CREATE POLICY "Owners can manage own households"
  ON public.households FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view their households"
  ON public.households FOR SELECT
  TO authenticated
  USING (public.is_household_member(auth.uid(), id));

-- RLS policies for household_members
CREATE POLICY "Owners can manage household members"
  ON public.household_members FOR ALL
  TO authenticated
  USING (public.is_household_owner(auth.uid(), household_id))
  WITH CHECK (public.is_household_owner(auth.uid(), household_id));

CREATE POLICY "Members can view household members"
  ON public.household_members FOR SELECT
  TO authenticated
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can view own membership"
  ON public.household_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Auto-create household for existing users trigger
CREATE OR REPLACE FUNCTION public.auto_create_household()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.households (owner_id, name)
  VALUES (NEW.id, 'Minha Família');

  INSERT INTO public.household_members (household_id, user_id, role, status, display_name, joined_at)
  SELECT h.id, NEW.id, 'owner', 'active', COALESCE(NEW.raw_user_meta_data->>'full_name', ''), now()
  FROM public.households h WHERE h.owner_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Updated at trigger
CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_household_members_updated_at
  BEFORE UPDATE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();



-- bank_accounts table
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  bank_name text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT 'checking',
  last_four text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own bank_accounts" ON public.bank_accounts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- transactions table
CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid REFERENCES public.bank_accounts(id) ON DELETE SET NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Outros',
  type text NOT NULL DEFAULT 'expense',
  source text NOT NULL DEFAULT 'manual',
  responsavel text NOT NULL DEFAULT 'Pessoa 1',
  fit_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- unique constraint to prevent duplicate OFX imports
CREATE UNIQUE INDEX idx_transactions_fit_id ON public.transactions(user_id, account_id, fit_id) WHERE fit_id IS NOT NULL;



-- 1. Create plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plans" ON public.plans FOR SELECT USING (true);

-- 2. Create plan_features table
CREATE TABLE public.plan_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  UNIQUE(plan_id, feature_key)
);

ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read plan_features" ON public.plan_features FOR SELECT USING (true);

-- 3. Add plan_id and metadata columns to user_plans
ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS plan_id uuid REFERENCES public.plans(id),
  ADD COLUMN IF NOT EXISTS assigned_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- 4. Insert the 3 plans
INSERT INTO public.plans (name, slug, description) VALUES
  ('Atlas Essencial', 'atlas_essencial', 'Controle financeiro e organização da vida financeira.'),
  ('Atlas Pro', 'atlas_pro', 'Planejamento financeiro completo e gestão patrimonial.'),
  ('Atlas Elite', 'atlas_elite', 'Planejamento financeiro completo + gestão empresarial.');

-- 5. Insert plan_features
-- Atlas Essencial
INSERT INTO public.plan_features (plan_id, feature_key)
SELECT p.id, f.key FROM public.plans p,
  unnest(ARRAY[
    'planejamento_controle','lancamentos','calendario_pagamentos','analises',
    'extrato_bancario','express_objetivos','express_aposentadoria','relatorio_controle',
    'importar_ofx','importar_planilha','fatura_cartao'
  ]) AS f(key)
WHERE p.slug = 'atlas_essencial';

-- Atlas Pro = Essencial + extras
INSERT INTO public.plan_features (plan_id, feature_key)
SELECT p.id, f.key FROM public.plans p,
  unnest(ARRAY[
    'planejamento_controle','lancamentos','calendario_pagamentos','analises',
    'extrato_bancario','express_objetivos','express_aposentadoria','relatorio_controle',
    'importar_ofx','importar_planilha','fatura_cartao',
    'objetivos_de_vida','aposentadoria','investimentos','bens_imoveis',
    'protecao_seguros','relatorio_atlas','evolucao_patrimonial'
  ]) AS f(key)
WHERE p.slug = 'atlas_pro';

-- Atlas Elite = Pro + negocios
INSERT INTO public.plan_features (plan_id, feature_key)
SELECT p.id, f.key FROM public.plans p,
  unnest(ARRAY[
    'planejamento_controle','lancamentos','calendario_pagamentos','analises',
    'extrato_bancario','express_objetivos','express_aposentadoria','relatorio_controle',
    'importar_ofx','importar_planilha','fatura_cartao',
    'objetivos_de_vida','aposentadoria','investimentos','bens_imoveis',
    'protecao_seguros','relatorio_atlas','evolucao_patrimonial',
    'atlas_negocios'
  ]) AS f(key)
WHERE p.slug = 'atlas_elite';

-- 6. Assign Atlas Elite to ALL existing users
UPDATE public.user_plans
SET plan_id = (SELECT id FROM public.plans WHERE slug = 'atlas_elite'),
    assigned_by_admin = true,
    assigned_at = now()
WHERE plan_id IS NULL;

-- 7. Update handle_new_user to assign atlas_essencial by default
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));

  INSERT INTO public.user_plans (user_id, tier, plan_id, assigned_by_admin)
  VALUES (NEW.id, 'organiza_2026', (SELECT id FROM public.plans WHERE slug = 'atlas_essencial'), false);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  INSERT INTO public.user_subscriptions (user_id, plan_tier, access_state, origin)
  VALUES (NEW.id, 'free', 'trial', 'manual');

  RETURN NEW;
END;
$function$;



CREATE TABLE public.upgrade_triggers_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trigger_key text NOT NULL,
  shown_count integer NOT NULL DEFAULT 0,
  last_shown_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, trigger_key)
);

ALTER TABLE public.upgrade_triggers_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own trigger logs"
  ON public.upgrade_triggers_log
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);



CREATE TABLE public.dependentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  data_nascimento DATE,
  parentesco TEXT NOT NULL DEFAULT 'filho',
  tipo TEXT NOT NULL DEFAULT 'filho',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dependentes"
  ON public.dependentes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);



CREATE TABLE public.life_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX life_reports_user_id_idx ON public.life_reports (user_id);

ALTER TABLE public.life_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own life_reports"
ON public.life_reports FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);


ALTER TABLE public.life_reports ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'planejamento_360';
DROP INDEX IF EXISTS life_reports_user_id_idx;
CREATE UNIQUE INDEX life_reports_user_type_idx ON public.life_reports (user_id, report_type);



CREATE TABLE public.advisory_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  patrimonio TEXT NOT NULL DEFAULT '',
  tempo_investindo TEXT NOT NULL DEFAULT '',
  teve_assessor TEXT NOT NULL DEFAULT '',
  objetivo TEXT NOT NULL DEFAULT '',
  observacoes TEXT DEFAULT '',
  score INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.advisory_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own leads" ON public.advisory_leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own leads" ON public.advisory_leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all leads" ON public.advisory_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


ALTER TABLE public.advisory_leads ADD COLUMN status TEXT NOT NULL DEFAULT 'novo';

CREATE POLICY "Admins can update leads" ON public.advisory_leads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));



-- Insurance leads table
CREATE TABLE public.insurance_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  dependentes INTEGER NOT NULL DEFAULT 0,
  patrimonio_investido TEXT NOT NULL DEFAULT '',
  patrimonio_imobiliario TEXT NOT NULL DEFAULT '',
  renda_mensal TEXT NOT NULL DEFAULT '',
  heranca_esperada TEXT NOT NULL DEFAULT 'não',
  seguro_atual TEXT NOT NULL DEFAULT '',
  objetivo TEXT NOT NULL DEFAULT '',
  observacoes TEXT DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;

-- Users can insert own leads
CREATE POLICY "Users can insert own insurance_leads" ON public.insurance_leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read own leads
CREATE POLICY "Users can read own insurance_leads" ON public.insurance_leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all
CREATE POLICY "Admins can read all insurance_leads" ON public.insurance_leads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update
CREATE POLICY "Admins can update insurance_leads" ON public.insurance_leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));


ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS foto_casal text DEFAULT '',
  ADD COLUMN IF NOT EXISTS foto_geral text DEFAULT '';


  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS greeting_emoji text NOT NULL DEFAULT '👋';

  DELETE FROM public.plan_features 
WHERE feature_key = 'projecao_patrimonial' 
AND plan_id IN (SELECT id FROM public.plans WHERE slug = 'atlas_pro');


ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emoji_pessoa1 text NOT NULL DEFAULT '👋',
  ADD COLUMN IF NOT EXISTS emoji_pessoa2 text NOT NULL DEFAULT '👋',
  ADD COLUMN IF NOT EXISTS emoji_casal text NOT NULL DEFAULT '❤️',
  ADD COLUMN IF NOT EXISTS emoji_geral text NOT NULL DEFAULT '📊';

-- Migrate existing greeting_emoji to pessoa1 (most likely the active view when it was set)
UPDATE public.profiles
SET emoji_pessoa1 = greeting_emoji
WHERE greeting_emoji IS NOT NULL AND greeting_emoji != '👋';


CREATE OR REPLACE FUNCTION public.find_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM auth.users WHERE email = lower(_email) LIMIT 1;
$$;



-- ============================================================
-- ATLAS SCALABILITY AUDIT — Migration
-- Índices, constraints anti-duplicata, retenção e resumos mensais
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. ÍNDICES CRÍTICOS DE PERFORMANCE
-- ─────────────────────────────────────────────

-- despesas: queries filtram por user_id + data e user_id + tipo
CREATE INDEX IF NOT EXISTS idx_despesas_user_data 
  ON public.despesas (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_despesas_user_tipo 
  ON public.despesas (user_id, tipo);

CREATE INDEX IF NOT EXISTS idx_despesas_user_mes_ref 
  ON public.despesas (user_id, mes_referencia)
  WHERE mes_referencia IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_despesas_user_recorrente 
  ON public.despesas (user_id, recorrente)
  WHERE recorrente = true;

-- receitas: mesma lógica
CREATE INDEX IF NOT EXISTS idx_receitas_user_data 
  ON public.receitas (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_receitas_user_tipo 
  ON public.receitas (user_id, tipo);

-- economias
CREATE INDEX IF NOT EXISTS idx_economias_user_data 
  ON public.economias (user_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_economias_user_destino 
  ON public.economias (user_id, destino_tipo);

-- investimentos_financeiros: carregado no scorecard e dashboard sem filtro de data
CREATE INDEX IF NOT EXISTS idx_investimentos_fin_user 
  ON public.investimentos_financeiros (user_id);

-- atlas_score_snapshots: comparação temporal
CREATE INDEX IF NOT EXISTS idx_atlas_score_snap_user_date 
  ON public.atlas_score_snapshots (user_id, snapshot_date DESC);

CREATE INDEX IF NOT EXISTS idx_atlas_score_snap_user_period 
  ON public.atlas_score_snapshots (user_id, period_start, period_end);

-- portfolio_snapshots: lido no score e dashboard
CREATE INDEX IF NOT EXISTS idx_portfolio_snap_user_month 
  ON public.portfolio_snapshots (user_id, month_ref DESC);

-- credit_card_statement_lines: filtra por statement_id E user_id frequentemente
CREATE INDEX IF NOT EXISTS idx_cc_lines_stmt_user 
  ON public.credit_card_statement_lines (statement_id, user_id);

CREATE INDEX IF NOT EXISTS idx_cc_lines_user_date 
  ON public.credit_card_statement_lines (user_id, purchase_date DESC);

-- credit_card_statements: filtra por user_id + statement_month
CREATE INDEX IF NOT EXISTS idx_cc_stmts_user_month 
  ON public.credit_card_statements (user_id, statement_month DESC);

-- ai_inference_cache: lookup por fingerprint + user_id
CREATE INDEX IF NOT EXISTS idx_ai_cache_user_fp 
  ON public.ai_inference_cache (user_id, fingerprint);

-- fatura_import_logs: retenção e admin queries
CREATE INDEX IF NOT EXISTS idx_fatura_logs_user_created 
  ON public.fatura_import_logs (user_id, created_at DESC);

-- credit_card_audit_events: retenção
CREATE INDEX IF NOT EXISTS idx_cc_audit_user_created 
  ON public.credit_card_audit_events (user_id, created_at DESC);

-- business_transactions: filtros por company + date
CREATE INDEX IF NOT EXISTS idx_bizz_tx_company_date 
  ON public.business_transactions (company_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_bizz_tx_user_date 
  ON public.business_transactions (user_id, date DESC);

-- installment_instances: competencia + user_id
CREATE INDEX IF NOT EXISTS idx_inst_instances_user_comp 
  ON public.installment_instances (user_id, competencia);

-- objetivos: consulta frequente por user
CREATE INDEX IF NOT EXISTS idx_objetivos_user 
  ON public.objetivos (user_id);

-- aportes_objetivos: join com objetivos
CREATE INDEX IF NOT EXISTS idx_aportes_obj_user_data 
  ON public.aportes_objetivos (user_id, data DESC);

-- aportes_investimentos
CREATE INDEX IF NOT EXISTS idx_aportes_inv_user_data 
  ON public.aportes_investimentos (user_id, data DESC);

-- audit_logs admin
CREATE INDEX IF NOT EXISTS idx_audit_logs_created 
  ON public.audit_logs (created_at DESC);

-- household_members: lookup por user_id
CREATE INDEX IF NOT EXISTS idx_hh_members_user 
  ON public.household_members (user_id)
  WHERE user_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 2. UNIQUE CONSTRAINTS ANTI-DUPLICATA — SNAPSHOTS
-- ─────────────────────────────────────────────

-- atlas_score_snapshots: 1 snapshot por (user, period_start, period_end, snapshot_date)
ALTER TABLE public.atlas_score_snapshots
  DROP CONSTRAINT IF EXISTS uq_atlas_score_snap_period;

ALTER TABLE public.atlas_score_snapshots
  ADD CONSTRAINT uq_atlas_score_snap_period
  UNIQUE (user_id, period_start, period_end, snapshot_date);

-- portfolio_snapshots: 1 snapshot por (user, month_ref)
ALTER TABLE public.portfolio_snapshots
  DROP CONSTRAINT IF EXISTS uq_portfolio_snap_month;

ALTER TABLE public.portfolio_snapshots
  ADD CONSTRAINT uq_portfolio_snap_month
  UNIQUE (user_id, month_ref);

-- ─────────────────────────────────────────────
-- 3. TABELA DE RESUMOS MENSAIS MATERIALIZADOS
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.monthly_financial_summaries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  month_ref       TEXT NOT NULL,
  total_receitas  NUMERIC NOT NULL DEFAULT 0,
  total_despesas  NUMERIC NOT NULL DEFAULT 0,
  total_economias NUMERIC NOT NULL DEFAULT 0,
  saldo_mensal    NUMERIC GENERATED ALWAYS AS (total_receitas - total_despesas) STORED,
  taxa_poupanca   NUMERIC GENERATED ALWAYS AS (
    CASE WHEN total_receitas > 0
      THEN ROUND(((total_receitas - total_despesas) / total_receitas) * 100, 2)
      ELSE 0
    END
  ) STORED,
  computed_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT uq_monthly_summary_user_month UNIQUE (user_id, month_ref)
);

ALTER TABLE public.monthly_financial_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own monthly summaries"
  ON public.monthly_financial_summaries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_monthly_summaries_user_month
  ON public.monthly_financial_summaries (user_id, month_ref DESC);

-- ─────────────────────────────────────────────
-- 4. LIMITE DE CACHE POR USUÁRIO (500 entradas — LRU automático)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.enforce_ai_cache_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cache_count INT;
BEGIN
  SELECT COUNT(*) INTO cache_count
  FROM public.ai_inference_cache
  WHERE user_id = NEW.user_id;

  IF cache_count >= 500 THEN
    DELETE FROM public.ai_inference_cache
    WHERE id IN (
      SELECT id FROM public.ai_inference_cache
      WHERE user_id = NEW.user_id
      ORDER BY created_at ASC
      LIMIT 50
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_cache_limit ON public.ai_inference_cache;
CREATE TRIGGER trg_ai_cache_limit
  BEFORE INSERT ON public.ai_inference_cache
  FOR EACH ROW EXECUTE FUNCTION public.enforce_ai_cache_limit();

-- ─────────────────────────────────────────────
-- 5. LIMITE DE UPLOAD — bucket faturas (10 MB, mime types restritos)
-- ─────────────────────────────────────────────

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain',
      'text/csv'
    ]
WHERE id = 'faturas';

-- ─────────────────────────────────────────────
-- 6. FUNÇÕES DE RETENÇÃO (chamadas pela data-retention-cleanup)
-- ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_old_import_logs(months_to_keep INT DEFAULT 12)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.fatura_import_logs
  WHERE created_at < NOW() - (months_to_keep || ' months')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_score_snapshots(months_to_keep INT DEFAULT 24)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.atlas_score_snapshots
  WHERE snapshot_date < (CURRENT_DATE - (months_to_keep || ' months')::INTERVAL)::DATE;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_portfolio_snapshots(months_to_keep INT DEFAULT 36)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.portfolio_snapshots
  WHERE created_at < NOW() - (months_to_keep || ' months')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_old_audit_events(months_to_keep INT DEFAULT 24)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE deleted_count INT;
BEGIN
  DELETE FROM public.credit_card_audit_events
  WHERE created_at < NOW() - (months_to_keep || ' months')::INTERVAL;
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;


-- Legal acceptance hardening for Atlas
CREATE TABLE IF NOT EXISTS public.user_terms_acceptance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  accepted_at timestamp with time zone NOT NULL DEFAULT now(),
  ip_address text,
  user_agent text
);

ALTER TABLE public.user_terms_acceptance ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_terms_acceptance' AND policyname='Users can view their own terms acceptance'
  ) THEN
    CREATE POLICY "Users can view their own terms acceptance"
      ON public.user_terms_acceptance
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='user_terms_acceptance' AND policyname='Users can insert their own terms acceptance'
  ) THEN
    CREATE POLICY "Users can insert their own terms acceptance"
      ON public.user_terms_acceptance
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_terms_acceptance_user_version
  ON public.user_terms_acceptance (user_id, terms_version);

CREATE INDEX IF NOT EXISTS idx_user_terms_acceptance_user_version_date
  ON public.user_terms_acceptance (user_id, terms_version, accepted_at DESC);



-- Create atlas_quotes table
CREATE TABLE public.atlas_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  author text NOT NULL DEFAULT 'Equipe Atlas',
  category text NOT NULL DEFAULT 'general',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS (public read, service write)
ALTER TABLE public.atlas_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active quotes"
  ON public.atlas_quotes FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage quotes"
  ON public.atlas_quotes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient random-per-category queries
CREATE INDEX idx_atlas_quotes_category_active ON public.atlas_quotes (category, active);



-- Fix: add 'awaiting_payment' to the access_state CHECK constraint
ALTER TABLE public.user_subscriptions DROP CONSTRAINT user_subscriptions_access_state_check;
ALTER TABLE public.user_subscriptions ADD CONSTRAINT user_subscriptions_access_state_check
  CHECK (access_state = ANY (ARRAY['trial'::text, 'grace'::text, 'active'::text, 'restricted'::text, 'awaiting_payment'::text]));


  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;


  -- Resolve effective plan owner for household members and activate invited memberships on first access
CREATE OR REPLACE FUNCTION public.resolve_effective_plan_user_id()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid;
  _activated_count integer := 0;
  _is_member boolean := false;
BEGIN
  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  -- First access for invited members: activate membership
  UPDATE public.household_members
  SET
    status = 'active',
    joined_at = COALESCE(joined_at, now()),
    updated_at = now()
  WHERE user_id = _uid
    AND role = 'member'
    AND status = 'invited';

  GET DIAGNOSTICS _activated_count = ROW_COUNT;

  SELECT EXISTS (
    SELECT 1
    FROM public.household_members
    WHERE user_id = _uid
      AND role = 'member'
      AND status IN ('active', 'invited')
  )
  INTO _is_member;

  -- Mark subscription origin correctly for invited household users
  IF _is_member THEN
    UPDATE public.user_subscriptions
    SET
      origin = 'household_invite',
      updated_at = now()
    WHERE user_id = _uid
      AND COALESCE(origin, 'direct') IN ('direct', 'manual');
  END IF;

  -- Apply first-experience theme only when membership has just been activated
  IF _activated_count > 0 THEN
    UPDATE public.profiles
    SET
      tema_sidebar = CASE WHEN COALESCE(tema_sidebar, 'default') = 'default' THEN 'white' ELSE tema_sidebar END,
      tema_destaque = CASE WHEN COALESCE(tema_destaque, 'default') = 'default' THEN 'sand' ELSE tema_destaque END,
      tema_modo = CASE WHEN COALESCE(tema_modo, 'system') = 'system' THEN 'light' ELSE tema_modo END,
      updated_at = now()
    WHERE user_id = _uid;
  END IF;

  -- Household members inherit owner's plan
  SELECT h.owner_id
  INTO _owner
  FROM public.household_members hm
  JOIN public.households h ON h.id = hm.household_id
  WHERE hm.user_id = _uid
    AND hm.role = 'member'
    AND hm.status IN ('active', 'invited')
  ORDER BY hm.updated_at DESC
  LIMIT 1;

  RETURN COALESCE(_owner, _uid);
END;
$$;

-- Ensure authenticated users can call this helper
GRANT EXECUTE ON FUNCTION public.resolve_effective_plan_user_id() TO authenticated;

-- First-access theme defaults should be off-white + dourado + light
ALTER TABLE public.profiles ALTER COLUMN tema_sidebar SET DEFAULT 'white';
ALTER TABLE public.profiles ALTER COLUMN tema_destaque SET DEFAULT 'sand';
ALTER TABLE public.profiles ALTER COLUMN tema_modo SET DEFAULT 'light';



-- RPC that returns the effective subscription + plan data, bypassing RLS
CREATE OR REPLACE FUNCTION public.get_effective_plan_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _effective_uid uuid;
  _sub jsonb;
  _plan_slug text;
  _plan_id uuid;
BEGIN
  -- This internally activates invited members and resolves the titular's ID
  _effective_uid := public.resolve_effective_plan_user_id();
  
  IF _effective_uid IS NULL THEN
    RETURN jsonb_build_object('effective_user_id', null, 'subscription', '{}'::jsonb, 'plan_slug', null, 'plan_id', null);
  END IF;
  
  SELECT to_jsonb(s.*) INTO _sub
  FROM public.user_subscriptions s
  WHERE s.user_id = _effective_uid;
  
  SELECT up.plan_id, p.slug INTO _plan_id, _plan_slug
  FROM public.user_plans up
  JOIN public.plans p ON p.id = up.plan_id
  WHERE up.user_id = _effective_uid AND up.active = true
  LIMIT 1;
  
  RETURN jsonb_build_object(
    'effective_user_id', _effective_uid,
    'subscription', COALESCE(_sub, '{}'::jsonb),
    'plan_slug', _plan_slug,
    'plan_id', _plan_id
  );
END;
$$;



-- RPC to get the household owner's family profile data (bypasses RLS for members)
CREATE OR REPLACE FUNCTION public.get_household_owner_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner_id uuid;
  _owner_email text;
  _profile jsonb;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  -- Check if user is a member of someone else's household
  SELECT h.owner_id INTO _owner_id
  FROM public.household_members hm
  JOIN public.households h ON h.id = hm.household_id
  WHERE hm.user_id = _uid
    AND hm.role = 'member'
    AND hm.status IN ('active', 'invited')
  ORDER BY hm.updated_at DESC
  LIMIT 1;

  -- If not a member, return null (caller should use own profile)
  IF _owner_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'owner_id', _owner_id,
    'nome_pessoa1', COALESCE(p.nome_pessoa1, 'Pessoa 1'),
    'nome_pessoa2', COALESCE(p.nome_pessoa2, 'Pessoa 2'),
    'foto_pessoa1', COALESCE(p.foto_pessoa1, ''),
    'foto_pessoa2', COALESCE(p.foto_pessoa2, ''),
    'vinculo_pessoa2', COALESCE(p.vinculo_pessoa2, 'Cônjuge'),
    'pessoa2_participa_geral', COALESCE(p.pessoa2_participa_geral, true)
  ) INTO _profile
  FROM public.profiles p
  WHERE p.user_id = _owner_id;

  -- Get owner email
  SELECT email INTO _owner_email FROM auth.users WHERE id = _owner_id;

  RETURN jsonb_set(COALESCE(_profile, '{}'::jsonb), '{owner_email}', to_jsonb(COALESCE(_owner_email, '')));
END;
$$;



-- Extend the RPC to include foto_casal, foto_geral and emoji fields
CREATE OR REPLACE FUNCTION public.get_household_owner_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner_id uuid;
  _owner_email text;
  _profile jsonb;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  SELECT h.owner_id INTO _owner_id
  FROM public.household_members hm
  JOIN public.households h ON h.id = hm.household_id
  WHERE hm.user_id = _uid
    AND hm.role = 'member'
    AND hm.status IN ('active', 'invited')
  ORDER BY hm.updated_at DESC
  LIMIT 1;

  IF _owner_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'owner_id', _owner_id,
    'nome_pessoa1', COALESCE(p.nome_pessoa1, 'Pessoa 1'),
    'nome_pessoa2', COALESCE(p.nome_pessoa2, 'Pessoa 2'),
    'foto_pessoa1', COALESCE(p.foto_pessoa1, ''),
    'foto_pessoa2', COALESCE(p.foto_pessoa2, ''),
    'foto_casal', COALESCE(p.foto_casal, ''),
    'foto_geral', COALESCE(p.foto_geral, ''),
    'vinculo_pessoa2', COALESCE(p.vinculo_pessoa2, 'Cônjuge'),
    'pessoa2_participa_geral', COALESCE(p.pessoa2_participa_geral, true),
    'emoji_pessoa1', COALESCE(p.emoji_pessoa1, '👋'),
    'emoji_pessoa2', COALESCE(p.emoji_pessoa2, '👋'),
    'emoji_casal', COALESCE(p.emoji_casal, '❤️'),
    'emoji_geral', COALESCE(p.emoji_geral, '📊')
  ) INTO _profile
  FROM public.profiles p
  WHERE p.user_id = _owner_id;

  SELECT email INTO _owner_email FROM auth.users WHERE id = _owner_id;

  RETURN jsonb_set(COALESCE(_profile, '{}'::jsonb), '{owner_email}', to_jsonb(COALESCE(_owner_email, '')));
END;
$$;


CREATE TABLE IF NOT EXISTS public.user_rate_limits (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ai_minute_key text,
  ai_minute_count integer DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rate limits" ON public.user_rate_limits FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access on rate limits" ON public.user_rate_limits FOR ALL TO service_role USING (true) WITH CHECK (true);



CREATE TABLE public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  platform text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_success_at timestamptz,
  last_failure_at timestamptz,
  failure_reason text,
  UNIQUE (endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own push_subscriptions"
  ON public.push_subscriptions FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service can manage all push_subscriptions"
  ON public.push_subscriptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);



-- Notification history: records every push sent
CREATE TABLE public.notification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  notification_slug text NOT NULL,
  source_ref text DEFAULT NULL,
  title text NOT NULL,
  message text NOT NULL,
  route text NOT NULL DEFAULT '/dashboard',
  priority text NOT NULL DEFAULT 'medium',
  block text NOT NULL DEFAULT 'habito',
  delivery_status text NOT NULL DEFAULT 'sent',
  error_message text DEFAULT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification_history"
  ON public.notification_history FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can manage notification_history"
  ON public.notification_history FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE INDEX idx_notif_history_user_slug ON public.notification_history (user_id, notification_slug);
CREATE INDEX idx_notif_history_sent_at ON public.notification_history (sent_at);

-- Notification preferences: per-user category toggles
CREATE TABLE public.notification_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category)
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notification_preferences"
  ON public.notification_preferences FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());




CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;




-- Partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'parceiro',
  status text NOT NULL DEFAULT 'active',
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage partners" ON public.partners
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Partner coupons table
CREATE TABLE public.partner_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  description text,
  status text NOT NULL DEFAULT 'active',
  pricing_model text NOT NULL DEFAULT 'client_discount',
  plan_slug text,
  client_discount_type text DEFAULT 'none',
  client_discount_value numeric DEFAULT 0,
  partner_commission_type text DEFAULT 'none',
  partner_commission_value numeric DEFAULT 0,
  partner_pays_full boolean NOT NULL DEFAULT false,
  client_cost_zero boolean NOT NULL DEFAULT false,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coupons" ON public.partner_coupons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read active coupons" ON public.partner_coupons
  FOR SELECT TO public
  USING (status = 'active');

-- User partner attributions table
CREATE TABLE public.user_partner_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  coupon_id uuid REFERENCES public.partner_coupons(id),
  coupon_code text,
  attribution_source text NOT NULL DEFAULT 'coupon',
  assigned_plan_slug text,
  pricing_model_snapshot text,
  client_discount_snapshot jsonb DEFAULT '{}',
  partner_commission_snapshot jsonb DEFAULT '{}',
  client_cost_zero boolean NOT NULL DEFAULT false,
  partner_pays_full boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_partner_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage attributions" ON public.user_partner_attributions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own attribution" ON public.user_partner_attributions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert attributions" ON public.user_partner_attributions
  FOR INSERT TO service_role
  WITH CHECK (true);



-- Prevent duplicate attributions per user per coupon
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_coupon_attribution 
ON public.user_partner_attributions (user_id, coupon_id) 
WHERE coupon_id IS NOT NULL;

-- Also prevent multiple attributions per user (one user = one partner max)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_partner_attribution 
ON public.user_partner_attributions (user_id);

-- Create an RPC function for atomic usage_count increment
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.partner_coupons 
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE id = p_coupon_id;
$$;

