-- ============================================================
-- PeJota — Transplante financeiro do Zephyr (multiempresa)
-- Cria as tabelas do plano de transplante, todas escopadas por
-- company_id com RLS via is_company_member() (helper já existe
-- no Atlas/PeJota). Seguro rodar mais de uma vez.
-- ============================================================

-- ---------- Extensões em tabelas existentes ----------
-- Grupo na categoria (Receita | Custos Fixos | Folha | Dispensável | Deduções)
alter table public.business_categories add column if not exists grupo text;
-- Conciliação bancária (OFX) — marcação de conciliado + id do banco p/ dedup
alter table public.business_transactions add column if not exists reconciled boolean not null default false;
alter table public.business_transactions add column if not exists bank_fit_id text;

-- ---------- 1. Fluxo de caixa: orçamento/projetado por categoria ----------
create table if not exists public.business_cashflow_budget (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  ref_month date not null,                 -- 1º dia do mês
  category_id uuid references public.business_categories(id) on delete set null,
  grupo text,
  projected numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, ref_month, category_id)
);
create index if not exists idx_cashflow_budget_company on public.business_cashflow_budget (company_id, ref_month);

-- ---------- 2. Impostos (ledger a pagar/pago) ----------
create table if not exists public.business_taxes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  tipo text not null,                  -- DAS | ISSQN | IRPJ | CSLL | ...
  competencia date not null,
  due_date date,
  amount numeric not null default 0,
  status text not null default 'pendente',   -- pendente | pago
  paid_date date,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_business_taxes_company on public.business_taxes (company_id, competencia);

-- ---------- 3. Colaboradores / folha ----------
create table if not exists public.business_payroll_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  ref_month date not null,
  label text,
  created_at timestamptz not null default now()
);
create table if not exists public.business_payouts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  run_id uuid references public.business_payroll_runs(id) on delete cascade,
  user_id uuid not null,
  ref_month date not null,
  nome text not null,
  tipo text not null default 'colaborador',   -- colaborador | comissionado | socio
  valor_base numeric default 0,
  comissao numeric default 0,
  piso numeric default 0,
  total numeric default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_payroll_runs_company on public.business_payroll_runs (company_id, ref_month);
create index if not exists idx_payouts_company on public.business_payouts (company_id, ref_month);

-- ---------- 4. Projeção por eventos futuros ----------
create table if not exists public.business_planned_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  ref_month date not null,
  event_date date,
  description text not null,
  category_id uuid references public.business_categories(id) on delete set null,
  amount numeric not null default 0,        -- negativo=custo, positivo=entrada
  status text not null default 'previsto',  -- previsto | confirmado | descartado
  created_at timestamptz not null default now()
);
create index if not exists idx_planned_events_company on public.business_planned_events (company_id, ref_month);

-- ---------- 5. Metas (vendas/receita/resultado) ----------
create table if not exists public.business_goals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null,
  ref_month date not null,
  metric text not null default 'receita',   -- receita | resultado | vendas
  target numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (company_id, ref_month, metric)
);

-- ============================================================
-- RLS — acesso por membro da empresa (is_company_member já existe)
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'business_cashflow_budget','business_taxes','business_payroll_runs',
    'business_payouts','business_planned_events','business_goals'
  ] loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('drop policy if exists "members access %1$s" on public.%1$s', t);
    execute format(
      'create policy "members access %1$s" on public.%1$s for all to authenticated '
      'using (public.is_company_member(company_id)) with check (public.is_company_member(company_id))', t);
  end loop;
end $$;
