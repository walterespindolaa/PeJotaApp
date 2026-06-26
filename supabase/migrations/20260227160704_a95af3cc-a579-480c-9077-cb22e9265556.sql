
-- Add responsavel and imagem_url to objetivos
ALTER TABLE public.objetivos ADD COLUMN IF NOT EXISTS responsavel text NOT NULL DEFAULT 'Pessoa 1';
ALTER TABLE public.objetivos ADD COLUMN IF NOT EXISTS imagem_url text;
