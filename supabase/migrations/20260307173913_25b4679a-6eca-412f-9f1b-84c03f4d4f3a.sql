
CREATE TABLE public.advisory_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  patrimonio TEXT NOT NULL DEFAULT '',
  tempo_investindo TEXT NOT NULL DEFAULT '',
  teve_assessor TEXT NOT NULL DEFAULT '',
  objetivo TEXT NOT NULL DEFAULT '',
  observacoes TEXT DEFAULT '',
  score INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.advisory_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own leads" ON public.advisory_leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can read own leads" ON public.advisory_leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can read all leads" ON public.advisory_leads
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
