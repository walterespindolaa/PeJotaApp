-- Controle de estoque + ficha técnica (BOM) do Atlas Negócios

create table if not exists public.business_inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  nome text not null,
  tipo text not null default 'insumo',   -- 'insumo' | 'produto'
  unidade text default 'un',
  custo_unitario numeric not null default 0,
  preco_venda numeric not null default 0,
  saldo numeric not null default 0,
  estoque_minimo numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  produto_id uuid not null references public.business_inventory_items(id) on delete cascade,
  insumo_id uuid not null references public.business_inventory_items(id) on delete cascade,
  quantidade numeric not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.business_stock_movements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  item_id uuid not null references public.business_inventory_items(id) on delete cascade,
  tipo text not null,                     -- 'entrada' | 'saida' | 'ajuste' | 'venda'
  quantidade numeric not null default 0,
  custo numeric default 0,
  motivo text,
  created_at timestamptz not null default now()
);

alter table public.business_inventory_items enable row level security;
alter table public.business_recipes enable row level security;
alter table public.business_stock_movements enable row level security;

drop policy if exists "inv owner" on public.business_inventory_items;
create policy "inv owner" on public.business_inventory_items for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "rec owner" on public.business_recipes;
create policy "rec owner" on public.business_recipes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "mov owner" on public.business_stock_movements;
create policy "mov owner" on public.business_stock_movements for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_inv_company on public.business_inventory_items (company_id, tipo);
create index if not exists idx_rec_produto on public.business_recipes (produto_id);
create index if not exists idx_mov_item on public.business_stock_movements (item_id);
