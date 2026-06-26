
-- Create atlas_quotes table
CREATE TABLE public.atlas_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text NOT NULL,
  author text NOT NULL DEFAULT 'Equipe Atlas',
  category text NOT NULL DEFAULT 'general',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS (public read, service write)
ALTER TABLE public.atlas_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active quotes"
  ON public.atlas_quotes FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can manage quotes"
  ON public.atlas_quotes FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient random-per-category queries
CREATE INDEX idx_atlas_quotes_category_active ON public.atlas_quotes (category, active);
