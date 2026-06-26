ALTER TABLE public.advisory_leads ADD COLUMN status TEXT NOT NULL DEFAULT 'novo';

CREATE POLICY "Admins can update leads" ON public.advisory_leads
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
