-- ===== Propostas do Atlas Negócios (link público estilo Collabs do Cria) =====

-- Branding da empresa (usado na proposta pública)
alter table public.companies
  add column if not exists logo_url text,
  add column if not exists brand_color text,
  add column if not exists media_kit_url text,
  add column if not exists pix_key text;

-- Proposta (pode estar ligada a um lead OU a um cliente)
create table if not exists public.business_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null,
  lead_id uuid references public.business_leads(id) on delete set null,
  client_id uuid references public.business_clients(id) on delete set null,
  token text unique,
  status text not null default 'rascunho',
  titulo text,
  terms text,
  valid_until date,
  desconto numeric not null default 0,
  sent_at timestamptz,
  viewed_at timestamptz,
  responded_at timestamptz,
  client_comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_proposals_status_chk
    check (status in ('rascunho','enviada','vista','aceita','recusada','ajuste'))
);
alter table public.business_proposals enable row level security;
drop policy if exists "business_proposals owner" on public.business_proposals;
create policy "business_proposals owner" on public.business_proposals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_business_proposals_company on public.business_proposals(company_id, status);
create unique index if not exists idx_business_proposals_token on public.business_proposals(token) where token is not null;

-- Itens da proposta (produtos do estoque ou livres)
create table if not exists public.business_proposal_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  proposal_id uuid not null references public.business_proposals(id) on delete cascade,
  product_id uuid,
  label text not null,
  descricao text,
  valor numeric not null default 0,
  quantidade numeric not null default 1,
  sort_order int not null default 0
);
alter table public.business_proposal_items enable row level security;
drop policy if exists "business_proposal_items owner" on public.business_proposal_items;
create policy "business_proposal_items owner" on public.business_proposal_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_business_proposal_items_prop on public.business_proposal_items(proposal_id);

-- ===== RPCs públicas por token (anon) =====

-- Lê a proposta e marca "vista" no 1º acesso
create or replace function public.get_business_proposal(_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _p public.business_proposals; _items jsonb; _company jsonb;
begin
  select * into _p from public.business_proposals where token = _token and status <> 'rascunho';
  if not found then return null; end if;
  if _p.status = 'enviada' then
    update public.business_proposals set status = 'vista', viewed_at = now() where id = _p.id;
    _p.status := 'vista';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'label', i.label, 'descricao', i.descricao, 'valor', i.valor, 'quantidade', i.quantidade
         ) order by i.sort_order), '[]'::jsonb)
    into _items from public.business_proposal_items i where i.proposal_id = _p.id;
  select jsonb_build_object('name', c.name, 'logo_url', c.logo_url,
           'brand_color', c.brand_color, 'media_kit_url', c.media_kit_url)
    into _company from public.companies c where c.id = _p.company_id;
  return jsonb_build_object(
    'titulo', _p.titulo, 'terms', _p.terms, 'valid_until', _p.valid_until,
    'desconto', _p.desconto, 'status', _p.status, 'client_comment', _p.client_comment,
    'items', _items, 'company', _company);
end; $$;

-- Aceitar: marca aceita; se for lead, move o card pra "ganho"
create or replace function public.accept_business_proposal(_token text)
returns void language plpgsql security definer set search_path = public as $$
declare _lead uuid;
begin
  update public.business_proposals
     set status = 'aceita', responded_at = now(), updated_at = now()
   where token = _token and status in ('enviada','vista','ajuste')
   returning lead_id into _lead;
  if _lead is not null then
    update public.business_leads set estagio = 'ganho', updated_at = now()
     where id = _lead and estagio not in ('ganho','perdido');
  end if;
end; $$;

create or replace function public.reject_business_proposal(_token text, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.business_proposals
     set status = 'recusada', responded_at = now(), client_comment = _motivo, updated_at = now()
   where token = _token and status in ('enviada','vista','ajuste');
end; $$;

create or replace function public.request_business_proposal_change(_token text, _comment text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.business_proposals
     set status = 'ajuste', client_comment = _comment, updated_at = now()
   where token = _token and status in ('enviada','vista');
end; $$;

grant execute on function public.get_business_proposal(text)               to anon, authenticated;
grant execute on function public.accept_business_proposal(text)            to anon, authenticated;
grant execute on function public.reject_business_proposal(text, text)      to anon, authenticated;
grant execute on function public.request_business_proposal_change(text, text) to anon, authenticated;
