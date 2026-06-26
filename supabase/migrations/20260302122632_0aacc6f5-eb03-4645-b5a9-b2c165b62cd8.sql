
-- =============================================
-- 1) LOCK DOWN password_resets table
-- =============================================
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Remove existing permissive policy
DROP POLICY IF EXISTS "Service role full access" ON public.password_resets;
DROP POLICY IF EXISTS "Enable read for all" ON public.password_resets;
DROP POLICY IF EXISTS "public read" ON public.password_resets;

-- Only service_role can access
CREATE POLICY "service_role_full_access_password_resets"
ON public.password_resets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Explicitly deny authenticated users
CREATE POLICY "deny_select_authenticated_password_resets"
ON public.password_resets
FOR SELECT
TO authenticated
USING (false);

-- =============================================
-- 2) LOCK DOWN indicadores_economicos write
-- =============================================
ALTER TABLE public.indicadores_economicos ENABLE ROW LEVEL SECURITY;

-- Remove permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert indicators" ON public.indicadores_economicos;
DROP POLICY IF EXISTS "Authenticated users can update indicators" ON public.indicadores_economicos;
DROP POLICY IF EXISTS "Anyone can read indicators" ON public.indicadores_economicos;

-- Public read stays open
CREATE POLICY "anyone_can_read_indicators"
ON public.indicadores_economicos
FOR SELECT
TO public
USING (true);

-- Only admins can insert
CREATE POLICY "admins_can_insert_indicators"
ON public.indicadores_economicos
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update
CREATE POLICY "admins_can_update_indicators"
ON public.indicadores_economicos
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role full access (for edge functions)
CREATE POLICY "service_role_full_access_indicators"
ON public.indicadores_economicos
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
