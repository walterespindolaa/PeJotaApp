-- ============================================================
-- PeJota — Integração Asaas (cobranças boleto/PIX) multiempresa
-- Cada empresa pluga a PRÓPRIA conta Asaas. A chave é um SEGREDO:
-- fica em company_integrations, SEM SELECT para o cliente — só o
-- service_role (Edge Functions) e as funções SECURITY DEFINER leem.
-- O cliente nunca recebe a chave; só sabe se está "configurado".
-- ============================================================

create extension if not exists pgcrypto;

-- 1) Credenciais por empresa (segredo) ------------------------
create table if not exists public.company_integrations (
  company_id   uuid primary key references public.companies(id) on delete cascade,
  asaas_api_key text,                       -- SEGREDO (nunca exposto ao cliente)
  asaas_env    text not null default 'sandbox',  -- 'sandbox' | 'prod'
  asaas_wallet_id text,                     -- opcional (split/conta)
  asaas_webhook_token text,                 -- valida o webhook recebido
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);
alter table public.company_integrations enable row level security;
-- Sem políticas de SELECT/INSERT/UPDATE para anon/authenticated:
-- o acesso passa só pelas funções abaixo (definer) e pelo service_role.
revoke all on public.company_integrations from anon, authenticated;

-- 2) Campos da cobrança Asaas na conta a receber/pagar --------
alter table public.business_bills add column if not exists payer_name        text;
alter table public.business_bills add column if not exists payer_doc         text;  -- CPF/CNPJ
alter table public.business_bills add column if not exists payer_email       text;
alter table public.business_bills add column if not exists payer_phone       text;
alter table public.business_bills add column if not exists asaas_customer_id text;
alter table public.business_bills add column if not exists asaas_charge_id   text;
alter table public.business_bills add column if not exists asaas_invoice_url text;  -- página de pagamento
alter table public.business_bills add column if not exists asaas_bank_slip_url text; -- PDF do boleto
alter table public.business_bills add column if not exists asaas_pix_payload text;  -- copia-e-cola PIX
alter table public.business_bills add column if not exists asaas_pix_image   text;  -- QR base64
alter table public.business_bills add column if not exists asaas_status      text;  -- PENDING/RECEIVED/...
create index if not exists idx_bills_asaas_charge on public.business_bills (asaas_charge_id);

-- 3) Helper de papel: é dono OU editor da empresa? ------------
create or replace function public.can_manage_company(p_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = p_company_id
      and m.user_id = auth.uid()
      and m.role in ('owner','editor')
  ) or exists (
    select 1 from public.companies c
    where c.id = p_company_id and c.user_id = auth.uid()
  );
$$;

-- 4) Salvar credenciais Asaas (sem nunca devolver a chave) -----
create or replace function public.set_asaas_credentials(
  p_company_id uuid, p_key text, p_env text default 'sandbox', p_wallet text default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_company(p_company_id) then
    raise exception 'sem permissao para gerenciar esta empresa';
  end if;
  insert into public.company_integrations (company_id, asaas_api_key, asaas_env, asaas_wallet_id, asaas_webhook_token, updated_at, updated_by)
  values (
    p_company_id, nullif(p_key, ''), coalesce(p_env,'sandbox'), p_wallet,
    encode(gen_random_bytes(24), 'hex'), now(), auth.uid()
  )
  on conflict (company_id) do update set
    -- mantém a chave atual se vier vazia (usuário só trocou ambiente/wallet)
    asaas_api_key = coalesce(nullif(excluded.asaas_api_key, ''), public.company_integrations.asaas_api_key),
    asaas_env     = excluded.asaas_env,
    asaas_wallet_id = excluded.asaas_wallet_id,
    asaas_webhook_token = coalesce(public.company_integrations.asaas_webhook_token, excluded.asaas_webhook_token),
    updated_at = now(), updated_by = auth.uid();
end;
$$;

-- 5) Status da integração (booleano, sem expor a chave) --------
create or replace function public.get_asaas_status(p_company_id uuid)
returns table(asaas_env text, configured boolean, wallet text, webhook_token text)
language plpgsql security definer set search_path = public as $$
begin
  if not public.can_manage_company(p_company_id) then
    raise exception 'sem permissao';
  end if;
  return query
    select ci.asaas_env,
           (ci.asaas_api_key is not null and length(ci.asaas_api_key) > 0),
           ci.asaas_wallet_id,
           ci.asaas_webhook_token
    from public.company_integrations ci
    where ci.company_id = p_company_id;
end;
$$;

grant execute on function public.set_asaas_credentials(uuid, text, text, text) to authenticated;
grant execute on function public.get_asaas_status(uuid) to authenticated;
grant execute on function public.can_manage_company(uuid) to authenticated;
