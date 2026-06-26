
CREATE TABLE public.life_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content text NOT NULL DEFAULT '',
  generated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX life_reports_user_id_idx ON public.life_reports (user_id);

ALTER TABLE public.life_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own life_reports"
ON public.life_reports FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
