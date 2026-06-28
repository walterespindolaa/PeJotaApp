-- ============================================================
-- PeJota — Contas a receber e a pagar (business_bills)
-- Uma linha = uma obrigação (a receber de cliente ou a pagar a fornecedor).
-- Ao liquidar, a tela gera um business_transactions (entra/sai no caixa) e
-- guarda o tx_id aqui. Multiempresa (company_id) + RLS por membro.
-- ============================================================
create table if not exists public.business_bills (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  kind text not null check (kind in ('receber','pagar')),
  description text not null,
  client_id uuid references public.business_clients(id) on delete set null,
  category_id uuid references public.business_categories(id) on delete set null,
  amount numeric not null default 0,
  due_date date,
  status text not null default 'pendente' check (status in ('pendente','liquidado')),
  paid_date date,
  tx_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_business_bills_company on public.business_bills (company_id, kind, status);
create index if not exists idx_business_bills_due on public.business_bills (company_id, due_date);

alter table public.business_bills enable row level security;
drop policy if exists "members access business_bills" on public.business_bills;
create policy "members access business_bills" on public.business_bills for all to authenticated
  using (public.is_company_member(company_id)) with check (public.is_company_member(company_id));

grant all on public.business_bills to anon, authenticated, service_role;
