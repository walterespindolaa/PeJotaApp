
-- Create installment_instances table for per-month parcela tracking
CREATE TABLE public.installment_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  installment_id UUID NOT NULL REFERENCES public.despesas(id) ON DELETE CASCADE,
  competencia TEXT NOT NULL, -- YYYY-MM
  due_date DATE NOT NULL,
  installment_number INTEGER NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(installment_id, competencia)
);

-- Enable RLS
ALTER TABLE public.installment_instances ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own installment_instances"
ON public.installment_instances FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own installment_instances"
ON public.installment_instances FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own installment_instances"
ON public.installment_instances FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own installment_instances"
ON public.installment_instances FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_installment_instances_updated_at
BEFORE UPDATE ON public.installment_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_installment_instances_user_comp ON public.installment_instances(user_id, competencia);
CREATE INDEX idx_installment_instances_installment ON public.installment_instances(installment_id);
