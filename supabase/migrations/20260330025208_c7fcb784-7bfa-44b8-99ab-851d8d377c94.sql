
DROP FUNCTION public.validate_coupon(text);

CREATE FUNCTION public.validate_coupon(coupon_code text)
RETURNS TABLE(
  id uuid,
  code text,
  is_valid boolean,
  plan_slug text,
  client_cost_zero boolean,
  client_discount_type text,
  client_discount_value numeric,
  pricing_model text,
  usage_limit integer,
  usage_count integer,
  valid_from timestamptz,
  valid_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pc.id,
    pc.code,
    (pc.status = 'active') as is_valid,
    pc.plan_slug,
    pc.client_cost_zero,
    pc.client_discount_type,
    pc.client_discount_value,
    pc.pricing_model,
    pc.usage_limit,
    pc.usage_count,
    pc.valid_from,
    pc.valid_until
  FROM partner_coupons pc
  WHERE pc.code = coupon_code;
END;
$$;
