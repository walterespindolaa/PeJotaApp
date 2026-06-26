
-- Prevent duplicate attributions per user per coupon
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_coupon_attribution 
ON public.user_partner_attributions (user_id, coupon_id) 
WHERE coupon_id IS NOT NULL;

-- Also prevent multiple attributions per user (one user = one partner max)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_user_partner_attribution 
ON public.user_partner_attributions (user_id);

-- Create an RPC function for atomic usage_count increment
CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.partner_coupons 
  SET usage_count = usage_count + 1, updated_at = now()
  WHERE id = p_coupon_id;
$$;
