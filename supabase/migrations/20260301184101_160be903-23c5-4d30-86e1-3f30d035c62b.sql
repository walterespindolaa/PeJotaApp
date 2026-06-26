
-- Create cashflow_entries ledger table
CREATE TABLE public.cashflow_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  type text NOT NULL DEFAULT 'expense',
  category text NOT NULL DEFAULT '',
  description text DEFAULT '',
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cashflow_entries ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own cashflow" ON public.cashflow_entries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cashflow" ON public.cashflow_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cashflow" ON public.cashflow_entries
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cashflow" ON public.cashflow_entries
  FOR DELETE USING (auth.uid() = user_id);

-- Index for fast period queries
CREATE INDEX idx_cashflow_entries_user_date ON public.cashflow_entries (user_id, date);
