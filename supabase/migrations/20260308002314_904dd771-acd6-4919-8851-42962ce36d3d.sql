DELETE FROM public.plan_features 
WHERE feature_key = 'projecao_patrimonial' 
AND plan_id IN (SELECT id FROM public.plans WHERE slug = 'atlas_pro');