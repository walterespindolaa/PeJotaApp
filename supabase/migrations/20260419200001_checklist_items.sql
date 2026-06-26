-- Monthly customizable checklist
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mes_ano TEXT NOT NULL,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_checklist_items_user_mes
  ON public.checklist_items(user_id, mes_ano);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "checklist_items_select_own" ON public.checklist_items;
CREATE POLICY "checklist_items_select_own" ON public.checklist_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "checklist_items_insert_own" ON public.checklist_items;
CREATE POLICY "checklist_items_insert_own" ON public.checklist_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "checklist_items_update_own" ON public.checklist_items;
CREATE POLICY "checklist_items_update_own" ON public.checklist_items
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "checklist_items_delete_own" ON public.checklist_items;
CREATE POLICY "checklist_items_delete_own" ON public.checklist_items
  FOR DELETE USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS tr_checklist_items_touch ON public.checklist_items;
CREATE TRIGGER tr_checklist_items_touch
  BEFORE UPDATE ON public.checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
