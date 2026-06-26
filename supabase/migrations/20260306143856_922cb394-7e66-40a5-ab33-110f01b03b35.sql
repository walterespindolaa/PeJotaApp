
-- Households table
CREATE TABLE public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Minha Família',
  owner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;

-- Household members table
CREATE TABLE public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  status text NOT NULL DEFAULT 'invited' CHECK (status IN ('active', 'invited', 'removed')),
  invited_email text,
  display_name text,
  invited_at timestamptz DEFAULT now(),
  joined_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;

-- Function to check household membership
CREATE OR REPLACE FUNCTION public.is_household_member(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE user_id = _user_id
      AND household_id = _household_id
      AND status = 'active'
  )
$$;

-- Function to check household ownership
CREATE OR REPLACE FUNCTION public.is_household_owner(_user_id uuid, _household_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.households
    WHERE id = _household_id
      AND owner_id = _user_id
  )
$$;

-- RLS policies for households
CREATE POLICY "Owners can manage own households"
  ON public.households FOR ALL
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Members can view their households"
  ON public.households FOR SELECT
  TO authenticated
  USING (public.is_household_member(auth.uid(), id));

-- RLS policies for household_members
CREATE POLICY "Owners can manage household members"
  ON public.household_members FOR ALL
  TO authenticated
  USING (public.is_household_owner(auth.uid(), household_id))
  WITH CHECK (public.is_household_owner(auth.uid(), household_id));

CREATE POLICY "Members can view household members"
  ON public.household_members FOR SELECT
  TO authenticated
  USING (public.is_household_member(auth.uid(), household_id));

CREATE POLICY "Users can view own membership"
  ON public.household_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Auto-create household for existing users trigger
CREATE OR REPLACE FUNCTION public.auto_create_household()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.households (owner_id, name)
  VALUES (NEW.id, 'Minha Família');

  INSERT INTO public.household_members (household_id, user_id, role, status, display_name, joined_at)
  SELECT h.id, NEW.id, 'owner', 'active', COALESCE(NEW.raw_user_meta_data->>'full_name', ''), now()
  FROM public.households h WHERE h.owner_id = NEW.id;

  RETURN NEW;
END;
$$;

-- Updated at trigger
CREATE TRIGGER update_households_updated_at
  BEFORE UPDATE ON public.households
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_household_members_updated_at
  BEFORE UPDATE ON public.household_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
