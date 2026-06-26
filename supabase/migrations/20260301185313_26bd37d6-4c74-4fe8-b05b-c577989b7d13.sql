
-- Add missing columns to cashflow_entries
ALTER TABLE public.cashflow_entries
  ADD COLUMN IF NOT EXISTS payment_method text NULL,
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurring_rule text NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone NOT NULL DEFAULT now();

-- Add more useful indexes
CREATE INDEX IF NOT EXISTS idx_cashflow_type_date ON public.cashflow_entries (user_id, type, date DESC);
CREATE INDEX IF NOT EXISTS idx_cashflow_category ON public.cashflow_entries (user_id, category);

-- Add updated_at trigger
CREATE TRIGGER update_cashflow_entries_updated_at
  BEFORE UPDATE ON public.cashflow_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
