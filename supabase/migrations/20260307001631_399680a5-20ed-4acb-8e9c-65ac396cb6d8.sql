
CREATE TABLE public.dependentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  data_nascimento DATE,
  parentesco TEXT NOT NULL DEFAULT 'filho',
  tipo TEXT NOT NULL DEFAULT 'filho',
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.dependentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own dependentes"
  ON public.dependentes
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
