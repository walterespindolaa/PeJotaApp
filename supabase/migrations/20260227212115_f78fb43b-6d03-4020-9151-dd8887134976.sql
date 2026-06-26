-- Add foto_url columns for person avatars
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_pessoa1 text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_pessoa2 text DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS vinculo_pessoa2 text DEFAULT 'Cônjuge';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pessoa2_participa_geral boolean DEFAULT true;