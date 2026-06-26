
-- Add theme preferences to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS tema_sidebar text NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS tema_destaque text NOT NULL DEFAULT 'default',
ADD COLUMN IF NOT EXISTS tema_modo text NOT NULL DEFAULT 'system';
