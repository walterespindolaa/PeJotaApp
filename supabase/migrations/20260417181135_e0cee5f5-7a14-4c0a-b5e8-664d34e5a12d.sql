-- Create a table for course progress
CREATE TABLE IF NOT EXISTS public.user_course_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  course_slug TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  completed BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, course_slug, lesson_id)
);

-- Enable Row Level Security
ALTER TABLE public.user_course_progress ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_course_progress' AND policyname = 'Users can view their own progress') THEN
        CREATE POLICY "Users can view their own progress" 
        ON public.user_course_progress 
        FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_course_progress' AND policyname = 'Users can insert their own progress') THEN
        CREATE POLICY "Users can insert their own progress" 
        ON public.user_course_progress 
        FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_course_progress' AND policyname = 'Users can update their own progress') THEN
        CREATE POLICY "Users can update their own progress" 
        ON public.user_course_progress 
        FOR UPDATE 
        USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_course_progress' AND policyname = 'Users can delete their own progress') THEN
        CREATE POLICY "Users can delete their own progress" 
        ON public.user_course_progress 
        FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- Create trigger for automatic timestamp updates
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_course_progress_updated_at') THEN
        CREATE TRIGGER update_user_course_progress_updated_at
        BEFORE UPDATE ON public.user_course_progress
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Insert feature "curso_organizacao" for the 3 plans
-- Plan IDs:
-- Atlas Essencial: d495d243-1d7c-42d8-be51-5d4766ad0c5b
-- Atlas Pro: 0b00cc89-765f-4659-ae39-334fdf1a3545
-- Atlas Elite: b16fe681-6c75-42cf-9ba4-ea893b74e0d5

INSERT INTO public.plan_features (plan_id, feature_key)
SELECT id, 'curso_organizacao'
FROM public.plans
WHERE slug IN ('atlas_essencial', 'atlas_pro', 'atlas_elite')
ON CONFLICT (plan_id, feature_key) DO NOTHING;
