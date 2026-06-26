-- Progresso do aluno nos cursos Atlas
CREATE TABLE IF NOT EXISTS public.user_course_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  lesson_number TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_slug, lesson_number)
);

CREATE INDEX IF NOT EXISTS idx_user_course_progress_user
  ON public.user_course_progress (user_id, course_slug);

ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own course progress"
  ON public.user_course_progress FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own course progress"
  ON public.user_course_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own course progress"
  ON public.user_course_progress FOR DELETE
  USING (auth.uid() = user_id);

-- curso_organizacao: disponível em Essencial, Pro e Elite
-- planejamento_financeiro_curso já existe em plan_features e não é tocado aqui
INSERT INTO public.plan_features (plan_id, feature_key)
SELECT id, 'curso_organizacao'
FROM public.plans
WHERE slug IN ('atlas_essencial', 'atlas_pro', 'atlas_elite')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
