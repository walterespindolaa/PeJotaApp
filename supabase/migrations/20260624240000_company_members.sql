-- ============================================================
-- Etapa 2: membros de empresa + RLS por empresa (add-only, seguro)
-- Não remove nenhuma política existente. Como ninguém é membro ainda,
-- o comportamento atual não muda; apenas habilita acesso compartilhado
-- quando um membro for adicionado (etapa 3).
-- ============================================================

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor',           -- editor | viewer (futuro)
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
alter table public.company_members enable row level security;
create index if not exists idx_company_members_company on public.company_members(company_id);
create index if not exists idx_company_members_user on public.company_members(user_id);

-- ===== Helpers (SECURITY DEFINER evita recursão de RLS) =====
create or replace function public.is_company_owner(_company_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.companies c where c.id = _company_id and c.user_id = auth.uid());
$$;

create or replace function public.is_company_member(_company_id uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.companies c where c.id = _company_id and c.user_id = auth.uid())
      or exists (select 1 from public.company_members m where m.company_id = _company_id and m.user_id = auth.uid());
$$;

grant execute on function public.is_company_owner(uuid)  to authenticated;
grant execute on function public.is_company_member(uuid) to authenticated;

-- ===== RLS da company_members =====
-- Dono e membros enxergam a lista; só o dono adiciona/remove membros.
drop policy if exists "company_members select" on public.company_members;
create policy "company_members select" on public.company_members for select to authenticated
  using (public.is_company_member(company_id));

drop policy if exists "company_members manage owner" on public.company_members;
create policy "company_members manage owner" on public.company_members for all to authenticated
  using (public.is_company_owner(company_id)) with check (public.is_company_owner(company_id));

-- ===== Acesso de membro às tabelas de Negócios (company_id direto) =====
do $$
declare t text;
begin
  foreach t in array array[
    'business_transactions','business_categories','business_clients','business_leads',
    'business_lead_tasks','business_client_notes','business_client_tasks','business_inventory_items',
    'business_recipes','business_stock_movements','business_proposals','business_recurring_templates',
    'business_recurring_instances','business_imports','allocation_rules'
  ] loop
    if to_regclass(format('public.%s', t)) is null then continue; end if;
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='company_id') then continue; end if;
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists "members access %1$s" on public.%1$s', t);
    execute format(
      'create policy "members access %1$s" on public.%1$s for all to authenticated '
      'using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))', t);
  end loop;
end $$;

-- ===== Itens de proposta (ligam via proposal_id) =====
drop policy if exists "members access business_proposal_items" on public.business_proposal_items;
create policy "members access business_proposal_items" on public.business_proposal_items for all to authenticated
  using (exists (select 1 from public.business_proposals p where p.id = proposal_id and public.is_company_member(p.company_id)))
  with check (exists (select 1 from public.business_proposals p where p.id = proposal_id and public.is_company_member(p.company_id)));

-- ===== Membros leem o registro da empresa (settings/nome) =====
drop policy if exists "members read companies" on public.companies;
create policy "members read companies" on public.companies for select to authenticated
  using (public.is_company_member(id));
