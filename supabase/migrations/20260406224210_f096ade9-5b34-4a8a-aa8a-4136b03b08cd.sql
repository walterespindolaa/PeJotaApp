-- Recorrências templates: SELECT para membros do household
DROP POLICY IF EXISTS "Users can manage own brt" ON public.business_recurring_templates;

CREATE POLICY "Users and household members can view brt"
  ON public.business_recurring_templates FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT hm.user_id FROM household_members hm
      JOIN households hh ON hh.id = hm.household_id
      JOIN companies c ON c.id = business_recurring_templates.company_id
      WHERE hh.owner_id = c.user_id
        AND hm.role = 'member' AND hm.status = 'active'
    )
  );

CREATE POLICY "Users can manage own brt"
  ON public.business_recurring_templates FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Recorrências instâncias: SELECT para membros do household
DROP POLICY IF EXISTS "Users can manage own bri" ON public.business_recurring_instances;

CREATE POLICY "Users and household members can view bri"
  ON public.business_recurring_instances FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT hm.user_id FROM household_members hm
      JOIN households hh ON hh.id = hm.household_id
      JOIN companies c ON c.id = business_recurring_instances.company_id
      WHERE hh.owner_id = c.user_id
        AND hm.role = 'member' AND hm.status = 'active'
    )
  );

CREATE POLICY "Users can manage own bri"
  ON public.business_recurring_instances FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- business_clients: SELECT para membros do household
CREATE POLICY "Users and household members can view clients"
  ON public.business_clients FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT hm.user_id FROM household_members hm
      JOIN households hh ON hh.id = hm.household_id
      JOIN companies c ON c.id = business_clients.company_id
      WHERE hh.owner_id = c.user_id
        AND hm.role = 'member' AND hm.status = 'active'
    )
  );