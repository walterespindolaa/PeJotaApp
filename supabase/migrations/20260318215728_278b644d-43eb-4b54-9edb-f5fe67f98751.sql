
-- Partners table
CREATE TABLE public.partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL DEFAULT 'parceiro',
  status text NOT NULL DEFAULT 'active',
  contact_email text,
  contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage partners" ON public.partners
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Partner coupons table
CREATE TABLE public.partner_coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  description text,
  status text NOT NULL DEFAULT 'active',
  pricing_model text NOT NULL DEFAULT 'client_discount',
  plan_slug text,
  client_discount_type text DEFAULT 'none',
  client_discount_value numeric DEFAULT 0,
  partner_commission_type text DEFAULT 'none',
  partner_commission_value numeric DEFAULT 0,
  partner_pays_full boolean NOT NULL DEFAULT false,
  client_cost_zero boolean NOT NULL DEFAULT false,
  usage_limit integer,
  usage_count integer NOT NULL DEFAULT 0,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage coupons" ON public.partner_coupons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read active coupons" ON public.partner_coupons
  FOR SELECT TO public
  USING (status = 'active');

-- User partner attributions table
CREATE TABLE public.user_partner_attributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  partner_id uuid NOT NULL REFERENCES public.partners(id),
  coupon_id uuid REFERENCES public.partner_coupons(id),
  coupon_code text,
  attribution_source text NOT NULL DEFAULT 'coupon',
  assigned_plan_slug text,
  pricing_model_snapshot text,
  client_discount_snapshot jsonb DEFAULT '{}',
  partner_commission_snapshot jsonb DEFAULT '{}',
  client_cost_zero boolean NOT NULL DEFAULT false,
  partner_pays_full boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_partner_attributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage attributions" ON public.user_partner_attributions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view own attribution" ON public.user_partner_attributions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Service can insert attributions" ON public.user_partner_attributions
  FOR INSERT TO service_role
  WITH CHECK (true);
