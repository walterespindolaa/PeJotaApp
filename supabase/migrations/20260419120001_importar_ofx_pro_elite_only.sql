-- Restrict importar_ofx to Pro/Elite only.
-- Previously included in atlas_essencial by seed migration 20260306223349.

DELETE FROM public.plan_features
WHERE feature_key = 'importar_ofx'
  AND plan_id IN (SELECT id FROM public.plans WHERE slug = 'atlas_essencial');

-- Ensure the feature exists on Pro and Elite (idempotent).
INSERT INTO public.plan_features (plan_id, feature_key)
SELECT id, 'importar_ofx'
FROM public.plans
WHERE slug IN ('atlas_pro', 'atlas_elite')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
