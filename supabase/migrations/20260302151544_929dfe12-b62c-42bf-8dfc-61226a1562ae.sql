
CREATE TABLE public.atlas_score_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  score integer NOT NULL,
  label text NOT NULL,
  breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_atlas_score_unique ON public.atlas_score_snapshots (user_id, period_start, period_end, snapshot_date);

ALTER TABLE public.atlas_score_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own atlas snapshots"
ON public.atlas_score_snapshots FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own atlas snapshots"
ON public.atlas_score_snapshots FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own atlas snapshots"
ON public.atlas_score_snapshots FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own atlas snapshots"
ON public.atlas_score_snapshots FOR DELETE
USING (auth.uid() = user_id);
