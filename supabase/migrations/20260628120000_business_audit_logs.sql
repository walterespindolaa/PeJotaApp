-- ============================================================
-- PeJota — Trilha de auditoria por empresa (dado financeiro é sensível)
-- Registra automaticamente INSERT/UPDATE/DELETE nas tabelas financeiras.
-- Insert SÓ pelo trigger (SECURITY DEFINER); usuários só LEEM (RLS).
-- ============================================================

create table if not exists public.business_audit_logs (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid,
  action      text not null,          -- INSERT | UPDATE | DELETE
  entity      text not null,          -- nome da tabela
  entity_id   uuid,
  summary     text,                   -- resumo legível
  details     jsonb,                  -- snapshot (old/new)
  created_at  timestamptz not null default now()
);
create index if not exists idx_bizaudit_company on public.business_audit_logs (company_id, created_at desc);

alter table public.business_audit_logs enable row level security;
-- Usuário só LÊ o que é da empresa dele; nunca escreve direto.
drop policy if exists bizaudit_select on public.business_audit_logs;
create policy bizaudit_select on public.business_audit_logs
  for select to authenticated using (public.is_company_member(company_id));
revoke insert, update, delete on public.business_audit_logs from anon, authenticated;

-- Função de auditoria genérica -------------------------------
create or replace function public.business_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid; eid uuid; j jsonb; summ text;
begin
  if (tg_op = 'DELETE') then j := to_jsonb(old); else j := to_jsonb(new); end if;
  cid := nullif(j->>'company_id','')::uuid;
  eid := nullif(j->>'id','')::uuid;
  if cid is null then return coalesce(new, old); end if;  -- sem empresa, não audita

  summ := tg_op
        || coalesce(' · ' || nullif(j->>'description',''), coalesce(' · ' || nullif(j->>'tipo',''), coalesce(' · ' || nullif(j->>'kind',''), '')))
        || coalesce(' · R$ ' || nullif(j->>'amount',''), '');

  insert into public.business_audit_logs (company_id, user_id, action, entity, entity_id, summary, details)
  values (
    cid, auth.uid(), tg_op, tg_table_name, eid, summ,
    jsonb_build_object(
      'new', case when tg_op <> 'DELETE' then to_jsonb(new) end,
      'old', case when tg_op <> 'INSERT' then to_jsonb(old) end
    )
  );
  return coalesce(new, old);
end; $$;

-- Anexa o trigger nas tabelas financeiras --------------------
do $$
declare t text;
begin
  foreach t in array array[
    'business_transactions','business_bills','business_taxes',
    'business_payouts','business_goals','business_planned_events',
    'business_cashflow_budget'
  ] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists trg_audit_%1$s on public.%1$s', t);
      execute format('create trigger trg_audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.business_audit()', t);
    end if;
  end loop;
end $$;
