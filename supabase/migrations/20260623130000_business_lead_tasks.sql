-- Tarefas por lead/cliente do funil (Atlas Negócios)
create table if not exists public.business_lead_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  lead_id uuid not null references public.business_leads(id) on delete cascade,
  titulo text not null,
  data_prevista date,
  concluida boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.business_lead_tasks enable row level security;

drop policy if exists "business_lead_tasks owner" on public.business_lead_tasks;
create policy "business_lead_tasks owner" on public.business_lead_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_business_lead_tasks_lead on public.business_lead_tasks (lead_id, concluida);
create index if not exists idx_business_lead_tasks_company on public.business_lead_tasks (company_id, concluida);
