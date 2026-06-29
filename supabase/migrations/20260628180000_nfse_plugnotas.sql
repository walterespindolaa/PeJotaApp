-- ============================================================
-- PeJota — NFS-e via PlugNotas (multiempresa)
-- Token PlugNotas é SEGREDO (em company_integrations, sem select p/ cliente).
-- A1 NÃO fica no nosso banco: vai para o PlugNotas via Edge Function.
-- ============================================================

-- 1) Credenciais/config NFS-e por empresa (reusa company_integrations)
alter table public.company_integrations add column if not exists plugnotas_token text;          -- SEGREDO
alter table public.company_integrations add column if not exists plugnotas_env text default 'sandbox';
alter table public.company_integrations add column if not exists nfse_settings jsonb;            -- IM, regime, item LC116, cnae, aliquota, descrição, município IBGE, cnpj
alter table public.company_integrations add column if not exists nfse_emitente_ok boolean default false;

-- 2) Notas emitidas
create table if not exists public.business_invoices (
  id           uuid primary key default gen_random_uuid(),
  company_id   uuid not null references public.companies(id) on delete cascade,
  user_id      uuid,
  bill_id      uuid,
  provider     text not null default 'plugnotas',
  provider_id  text,                       -- id da nota no PlugNotas
  status       text not null default 'processando',  -- processando|concluido|erro|cancelado
  numero       text,
  valor        numeric not null default 0,
  tomador_nome text,
  tomador_doc  text,
  descricao    text,
  pdf_url      text,
  xml_url      text,
  erro         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_invoices_company on public.business_invoices (company_id, created_at desc);
create index if not exists idx_invoices_provider on public.business_invoices (provider_id);

alter table public.business_invoices enable row level security;
drop policy if exists invoices_select on public.business_invoices;
create policy invoices_select on public.business_invoices
  for select to authenticated using (public.is_company_member(company_id));
-- escrita só via Edge Function (service_role)
revoke insert, update, delete on public.business_invoices from anon, authenticated;

-- 3) Salvar token PlugNotas (sem devolver ao cliente)
create or replace function public.set_plugnotas_credentials(p_company_id uuid, p_token text, p_env text default 'sandbox')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_company(p_company_id) then raise exception 'sem permissao'; end if;
  insert into public.company_integrations (company_id, plugnotas_token, plugnotas_env, updated_at, updated_by)
  values (p_company_id, nullif(p_token,''), coalesce(p_env,'sandbox'), now(), auth.uid())
  on conflict (company_id) do update set
    plugnotas_token = coalesce(nullif(excluded.plugnotas_token,''), public.company_integrations.plugnotas_token),
    plugnotas_env = excluded.plugnotas_env, updated_at = now(), updated_by = auth.uid();
end; $$;

-- 4) Salvar dados fiscais (não secretos)
create or replace function public.set_nfse_settings(p_company_id uuid, p_settings jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_company(p_company_id) then raise exception 'sem permissao'; end if;
  insert into public.company_integrations (company_id, nfse_settings, updated_at, updated_by)
  values (p_company_id, p_settings, now(), auth.uid())
  on conflict (company_id) do update set nfse_settings = excluded.nfse_settings, updated_at = now(), updated_by = auth.uid();
end; $$;

-- 5) Status NFS-e (booleano + settings, sem o token)
create or replace function public.get_nfse_status(p_company_id uuid)
returns table(plugnotas_configured boolean, plugnotas_env text, emitente_ok boolean, settings jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_company(p_company_id) then raise exception 'sem permissao'; end if;
  return query
    select (ci.plugnotas_token is not null and length(ci.plugnotas_token) > 0),
           coalesce(ci.plugnotas_env,'sandbox'), coalesce(ci.nfse_emitente_ok,false), ci.nfse_settings
    from public.company_integrations ci where ci.company_id = p_company_id;
end; $$;

grant execute on function public.set_plugnotas_credentials(uuid, text, text) to authenticated;
grant execute on function public.set_nfse_settings(uuid, jsonb) to authenticated;
grant execute on function public.get_nfse_status(uuid) to authenticated;
