
-- Table to store monthly payment status for recurring/virtual items
CREATE TABLE public.pagamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ref_type text NOT NULL DEFAULT 'despesa', -- 'ganho' | 'despesa' | 'parcela'
  ref_id uuid NOT NULL,
  mes text NOT NULL, -- 'YYYY-MM'
  status text NOT NULL DEFAULT 'pendente', -- 'pendente' | 'pago' | 'recebido' | 'atrasado'
  pago_em date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint for upsert
CREATE UNIQUE INDEX idx_pagamentos_unique ON public.pagamentos (user_id, ref_type, ref_id, mes);

-- Enable RLS
ALTER TABLE public.pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pagamentos" ON public.pagamentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pagamentos" ON public.pagamentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pagamentos" ON public.pagamentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pagamentos" ON public.pagamentos FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_pagamentos_updated_at
  BEFORE UPDATE ON public.pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
