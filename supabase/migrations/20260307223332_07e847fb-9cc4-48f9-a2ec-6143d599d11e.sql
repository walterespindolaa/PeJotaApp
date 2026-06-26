ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS foto_casal text DEFAULT '',
  ADD COLUMN IF NOT EXISTS foto_geral text DEFAULT '';