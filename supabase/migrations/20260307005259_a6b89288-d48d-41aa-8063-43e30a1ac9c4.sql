ALTER TABLE public.life_reports ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'planejamento_360';
DROP INDEX IF EXISTS life_reports_user_id_idx;
CREATE UNIQUE INDEX life_reports_user_type_idx ON public.life_reports (user_id, report_type);