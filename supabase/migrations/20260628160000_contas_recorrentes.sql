-- PeJota — contas recorrentes (aluguel, salários, assinaturas)
create table if not exists public.business_recurring_bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid,
  kind text not null,                 -- 'receber' | 'pagar'
  description text not null,
  amount numeric not null default 0,
  day_of_month int not null default 5,
  payer_name text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists idx_recurring_company on public.business_recurring_bills (company_id, kind);
alter table public.business_recurring_bills enable row level security;
drop policy if exists recurring_all on public.business_recurring_bills;
create policy recurring_all on public.business_recurring_bills
  for all to authenticated
  using (public.is_company_member(company_id))
  with check (public.is_company_member(company_id));

-- liga a conta gerada ao modelo recorrente (evita duplicar no mês)
alter table public.business_bills add column if not exists recurring_id uuid;
