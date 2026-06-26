
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emoji_pessoa1 text NOT NULL DEFAULT '👋',
  ADD COLUMN IF NOT EXISTS emoji_pessoa2 text NOT NULL DEFAULT '👋',
  ADD COLUMN IF NOT EXISTS emoji_casal text NOT NULL DEFAULT '❤️',
  ADD COLUMN IF NOT EXISTS emoji_geral text NOT NULL DEFAULT '📊';

-- Migrate existing greeting_emoji to pessoa1 (most likely the active view when it was set)
UPDATE public.profiles
SET emoji_pessoa1 = greeting_emoji
WHERE greeting_emoji IS NOT NULL AND greeting_emoji != '👋';
