
-- Add plano_liberdade feature exclusively to atlas_elite plan
INSERT INTO public.plan_features (plan_id, feature_key)
SELECT id, 'plano_liberdade'
FROM public.plans
WHERE slug = 'atlas_elite'
ON CONFLICT (plan_id, feature_key) DO NOTHING;
