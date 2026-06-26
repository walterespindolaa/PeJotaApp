
-- Add is_reserva_emergencia column to investimentos_financeiros
ALTER TABLE public.investimentos_financeiros 
ADD COLUMN is_reserva_emergencia boolean NOT NULL DEFAULT false;

-- Create portfolio_snapshots table for monthly portfolio history
CREATE TABLE public.portfolio_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month_ref text NOT NULL,
  total_value numeric NOT NULL DEFAULT 0,
  total_contributions numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Unique constraint: one snapshot per user per month
ALTER TABLE public.portfolio_snapshots ADD CONSTRAINT portfolio_snapshots_user_month UNIQUE (user_id, month_ref);

-- Enable RLS
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own snapshots" ON public.portfolio_snapshots FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own snapshots" ON public.portfolio_snapshots FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own snapshots" ON public.portfolio_snapshots FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own snapshots" ON public.portfolio_snapshots FOR DELETE USING (auth.uid() = user_id);
