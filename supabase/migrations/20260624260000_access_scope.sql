-- Etapa 3b: acesso restrito do convidado (só Atlas Negócios)
alter table public.profiles
  add column if not exists access_scope text not null default 'full';  -- full | negocios

-- add_company_member com opção de restringir o acesso do convidado
create or replace function public.add_company_member(_company_id uuid, _email text, _role text default 'editor', _restrict boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _uid uuid; _n int;
begin
  if not exists (select 1 from public.companies where id = _company_id and user_id = auth.uid()) then return jsonb_build_object('error','not_owner'); end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if _uid is null then return jsonb_build_object('error','user_not_found'); end if;
  if _uid = auth.uid() then return jsonb_build_object('error','self'); end if;
  select count(*) into _n from public.company_members where company_id = _company_id;
  if _n >= 9 then return jsonb_build_object('error','limit'); end if;
  insert into public.company_members (company_id, user_id, role) values (_company_id, _uid, coalesce(_role,'editor'))
    on conflict (company_id, user_id) do update set role = excluded.role;
  -- restringe só se a pessoa não for dona de nenhuma empresa própria (evita travar usuário real do Atlas)
  if _restrict and not exists (select 1 from public.companies where user_id = _uid and archived = false) then
    update public.profiles set access_scope = 'negocios', updated_at = now() where user_id = _uid;
  end if;
  return jsonb_build_object('ok', true);
end; $$;

-- ao remover, restaura o acesso completo
create or replace function public.remove_company_member(_company_id uuid, _user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.companies where id = _company_id and user_id = auth.uid()) then return jsonb_build_object('error','not_owner'); end if;
  delete from public.company_members where company_id = _company_id and user_id = _user_id;
  update public.profiles set access_scope = 'full', updated_at = now() where user_id = _user_id;
  return jsonb_build_object('ok', true);
end; $$;

grant execute on function public.add_company_member(uuid, text, text, boolean) to authenticated;
grant execute on function public.remove_company_member(uuid, uuid) to authenticated;
