-- Funil de leads/prospects do Atlas Negócios (Kanban)
create table if not exists public.business_leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  nome text not null,
  contato text,
  valor_proposta numeric not null default 0,
  produto text,
  origem text,
  estagio text not null default 'lead',
  proximo_passo text,
  data_proximo_passo date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_leads enable row level security;

drop policy if exists "business_leads owner" on public.business_leads;
create policy "business_leads owner" on public.business_leads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_business_leads_company on public.business_leads (company_id, estagio);
