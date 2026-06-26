
-- Allow authenticated users to update indicadores (admin manual edit)
CREATE POLICY "Authenticated users can update indicators"
ON public.indicadores_economicos
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Allow authenticated users to insert indicators (for edge function fallback)
CREATE POLICY "Authenticated users can insert indicators"
ON public.indicadores_economicos
FOR INSERT
TO authenticated
WITH CHECK (true);
