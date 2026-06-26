
DROP POLICY IF EXISTS "Users and household members can view companies" ON public.companies;
DROP POLICY IF EXISTS "Users can manage own companies" ON public.companies;
DROP POLICY IF EXISTS "Household members share company access" ON public.companies;

CREATE POLICY "Household members share company access"
  ON public.companies FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM household_members hm1
      JOIN household_members hm2 ON hm1.household_id = hm2.household_id
      WHERE hm1.user_id = auth.uid()
        AND hm2.user_id = companies.user_id
        AND hm1.status = 'active'
        AND hm2.status = 'active'
    )
  );

CREATE POLICY "Users can manage own companies"
  ON public.companies FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
