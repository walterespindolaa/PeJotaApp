
-- Insurance leads table
CREATE TABLE public.insurance_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  telefone TEXT DEFAULT '',
  dependentes INTEGER NOT NULL DEFAULT 0,
  patrimonio_investido TEXT NOT NULL DEFAULT '',
  patrimonio_imobiliario TEXT NOT NULL DEFAULT '',
  renda_mensal TEXT NOT NULL DEFAULT '',
  heranca_esperada TEXT NOT NULL DEFAULT 'não',
  seguro_atual TEXT NOT NULL DEFAULT '',
  objetivo TEXT NOT NULL DEFAULT '',
  observacoes TEXT DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.insurance_leads ENABLE ROW LEVEL SECURITY;

-- Users can insert own leads
CREATE POLICY "Users can insert own insurance_leads" ON public.insurance_leads
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read own leads
CREATE POLICY "Users can read own insurance_leads" ON public.insurance_leads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all
CREATE POLICY "Admins can read all insurance_leads" ON public.insurance_leads
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update
CREATE POLICY "Admins can update insurance_leads" ON public.insurance_leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
