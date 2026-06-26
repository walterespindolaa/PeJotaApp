
-- Fix stock_guide policy: replace hardcoded uuid with has_role
DROP POLICY IF EXISTS "Only admin can modify stock_guide" ON public.stock_guide;
CREATE POLICY "Admins can modify stock_guide"
ON public.stock_guide
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Pin search_path on remaining functions flagged by linter
ALTER FUNCTION public.touch_user_feedback_updated_at() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
