
-- Protect sensitive profile columns from client-side modification
CREATE OR REPLACE FUNCTION public.protect_sensitive_profile_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Only enforce for non-service-role callers
  IF current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Admin bypass
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Prevent modification of sensitive columns
  NEW.must_change_password := OLD.must_change_password;
  NEW.stripe_customer_id := OLD.stripe_customer_id;
  NEW.stripe_subscription_id := OLD.stripe_subscription_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_profile_sensitive_cols
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION protect_sensitive_profile_columns();
