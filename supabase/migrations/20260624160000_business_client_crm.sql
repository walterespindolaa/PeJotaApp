-- ===== CRM dentro do cliente: anotações/atividades + tarefas + campos extras =====

-- Campos extras do cliente (info que o dono quer manter salva)
alter table public.business_clients
  add column if not exists endereco text,
  add column if not exists tags text[],
  add column if not exists origem text,           -- como chegou (indicação, instagram, etc.)
  add column if not exists info text;              -- ficha livre (ex.: histórico clínico, preferências)

-- Anotações / histórico de conversas (timeline)
create table if not exists public.business_client_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  client_id uuid not null references public.business_clients(id) on delete cascade,
  content text not null,
  tipo text not null default 'nota',              -- nota | ligacao | reuniao | mensagem | atendimento
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.business_client_notes enable row level security;
drop policy if exists "business_client_notes owner" on public.business_client_notes;
create policy "business_client_notes owner" on public.business_client_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_business_client_notes_client on public.business_client_notes(client_id, created_at desc);

-- Tarefas do cliente
create table if not exists public.business_client_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  client_id uuid not null references public.business_clients(id) on delete cascade,
  title text not null,
  done boolean not null default false,
  due_date date,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
alter table public.business_client_tasks enable row level security;
drop policy if exists "business_client_tasks owner" on public.business_client_tasks;
create policy "business_client_tasks owner" on public.business_client_tasks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_business_client_tasks_client on public.business_client_tasks(client_id, done, due_date);
