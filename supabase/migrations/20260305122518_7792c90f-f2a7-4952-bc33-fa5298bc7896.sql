
DROP TRIGGER IF EXISTS trg_validate_profile_preferences ON public.profiles;
CREATE TRIGGER trg_validate_profile_preferences
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_profile_preferences();

UPDATE public.profiles SET onboarding_completed = true, onboarding_completed_at = now() WHERE full_name IS NOT NULL AND trim(full_name) != ''
