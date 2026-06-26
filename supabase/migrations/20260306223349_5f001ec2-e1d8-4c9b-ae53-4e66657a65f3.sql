
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
