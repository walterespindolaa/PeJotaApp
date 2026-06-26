-- Permite que membros do household vejam as empresas do titular

-- 1. Função helper: retorna o user_id do titular do household do usuário atual
CREATE OR REPLACE FUNCTION public.get_household_owner_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
STABLE
AS $$
  SELECT hh.owner_id
  FROM household_members hm
  JOIN households hh ON hh.id = hm.household_id
  WHERE hm.user_id = auth.uid()
    AND hm.role = 'member'
    AND hm.status = 'active'
  LIMIT 1;
$$;

-- 2. Atualiza a policy de companies para incluir membros do household
DROP POLICY IF EXISTS "Users can manage own companies" ON public.companies;

CREATE POLICY "Users and household members can view companies"
  ON public.companies FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT hm.user_id
      FROM household_members hm
      JOIN households hh ON hh.id = hm.household_id
      WHERE hh.owner_id = companies.user_id
        AND hm.role = 'member'
        AND hm.status = 'active'
    )
  );

CREATE POLICY "Users can manage own companies"
  ON public.companies FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Mesma lógica para business_transactions
DROP POLICY IF EXISTS "Users can manage own business_transactions" ON public.business_transactions;

CREATE POLICY "Users and household members can view transactions"
  ON public.business_transactions FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT hm.user_id FROM household_members hm
      JOIN households hh ON hh.id = hm.household_id
      JOIN companies c ON c.id = business_transactions.company_id
      WHERE hh.owner_id = c.user_id
        AND hm.role = 'member' AND hm.status = 'active'
    )
  );

CREATE POLICY "Users can manage own business_transactions"
  ON public.business_transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. business_categories
DROP POLICY IF EXISTS "Users can manage own business_categories" ON public.business_categories;

CREATE POLICY "Users and household members can view categories"
  ON public.business_categories FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT hm.user_id FROM household_members hm
      JOIN households hh ON hh.id = hm.household_id
      JOIN companies c ON c.id = business_categories.company_id
      WHERE hh.owner_id = c.user_id
        AND hm.role = 'member' AND hm.status = 'active'
    )
  );

CREATE POLICY "Users can manage own business_categories"
  ON public.business_categories FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. allocation_rules
DROP POLICY IF EXISTS "Users can manage own allocation_rules" ON public.allocation_rules;

CREATE POLICY "Users and household members can view allocation_rules"
  ON public.allocation_rules FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR auth.uid() IN (
      SELECT hm.user_id FROM household_members hm
      JOIN households hh ON hh.id = hm.household_id
      JOIN companies c ON c.id = allocation_rules.company_id
      WHERE hh.owner_id = c.user_id
        AND hm.role = 'member' AND hm.status = 'active'
    )
  );

CREATE POLICY "Users can manage own allocation_rules"
  ON public.allocation_rules FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
