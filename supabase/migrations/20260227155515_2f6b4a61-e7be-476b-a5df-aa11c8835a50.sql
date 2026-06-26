
-- Add responsavel to receitas, despesas, economias
ALTER TABLE public.receitas ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT 'Pessoa 1';
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT 'Pessoa 1';
ALTER TABLE public.economias ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT 'Pessoa 1';

-- Add tipo_parcelamento to despesas (divida or compra_parcelada)
ALTER TABLE public.despesas ADD COLUMN IF NOT EXISTS tipo_parcelamento text NOT NULL DEFAULT 'compra_parcelada';

-- Add person names to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome_pessoa1 text NOT NULL DEFAULT 'Pessoa 1';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome_pessoa2 text NOT NULL DEFAULT 'Pessoa 2';
