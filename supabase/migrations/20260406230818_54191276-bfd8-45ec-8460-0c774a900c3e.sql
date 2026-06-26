DROP POLICY IF EXISTS "Users and household members can view transactions" ON public.business_transactions;
DROP POLICY IF EXISTS "Household members share transaction access" ON public.business_transactions;

CREATE POLICY "Household members share transaction access"
  ON public.business_transactions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = public.business_transactions.user_id
        AND hm1.status = 'active'
        AND hm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users and household members can view categories" ON public.business_categories;
DROP POLICY IF EXISTS "Household members share category access" ON public.business_categories;

CREATE POLICY "Household members share category access"
  ON public.business_categories FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = public.business_categories.user_id
        AND hm1.status = 'active'
        AND hm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users and household members can view brt" ON public.business_recurring_templates;
DROP POLICY IF EXISTS "Household members share brt access" ON public.business_recurring_templates;

CREATE POLICY "Household members share brt access"
  ON public.business_recurring_templates FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = public.business_recurring_templates.user_id
        AND hm1.status = 'active'
        AND hm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users and household members can view bri" ON public.business_recurring_instances;
DROP POLICY IF EXISTS "Household members share bri access" ON public.business_recurring_instances;

CREATE POLICY "Household members share bri access"
  ON public.business_recurring_instances FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = public.business_recurring_instances.user_id
        AND hm1.status = 'active'
        AND hm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users and household members can view allocation_rules" ON public.allocation_rules;
DROP POLICY IF EXISTS "Household members share allocation_rules access" ON public.allocation_rules;

CREATE POLICY "Household members share allocation_rules access"
  ON public.allocation_rules FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = public.allocation_rules.user_id
        AND hm1.status = 'active'
        AND hm2.status = 'active'
    )
  );

DROP POLICY IF EXISTS "Users and household members can view clients" ON public.business_clients;
DROP POLICY IF EXISTS "Household members share clients access" ON public.business_clients;

CREATE POLICY "Household members share clients access"
  ON public.business_clients FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.household_members hm1
      JOIN public.household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = public.business_clients.user_id
        AND hm1.status = 'active'
        AND hm2.status = 'active'
    )
  );