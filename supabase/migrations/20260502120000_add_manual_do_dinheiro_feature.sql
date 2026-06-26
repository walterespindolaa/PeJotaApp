-- Add manual_do_dinheiro feature to Pro and Elite plans (course is Pro+Elite, not Elite-only).
INSERT INTO public.plan_features (plan_id, feature_key)
SELECT id, 'manual_do_dinheiro'
FROM public.plans
WHERE slug IN ('atlas_pro', 'atlas_elite')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
