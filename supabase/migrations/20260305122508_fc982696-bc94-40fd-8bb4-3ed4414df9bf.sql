
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
