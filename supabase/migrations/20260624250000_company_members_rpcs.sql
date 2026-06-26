-- Etapa 3: RPCs para o dono gerenciar membros da empresa (add/list/remove)
-- Teto de 10 usuários por empresa (1 dono + até 9 membros).

create or replace function public.add_company_member(_company_id uuid, _email text, _role text default 'editor')
returns jsonb language plpgsql security definer set search_path = public as $$
declare _uid uuid; _n int;
begin
  if not exists (select 1 from public.companies where id = _company_id and user_id = auth.uid()) then
    return jsonb_build_object('error', 'not_owner');
  end if;
  select id into _uid from auth.users where lower(email) = lower(trim(_email)) limit 1;
  if _uid is null then
    return jsonb_build_object('error', 'user_not_found');
  end if;
  if _uid = auth.uid() then
    return jsonb_build_object('error', 'self');
  end if;
  select count(*) into _n from public.company_members where company_id = _company_id;
  if _n >= 9 then
    return jsonb_build_object('error', 'limit');
  end if;
  insert into public.company_members (company_id, user_id, role)
    values (_company_id, _uid, coalesce(_role, 'editor'))
    on conflict (company_id, user_id) do update set role = excluded.role;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.remove_company_member(_company_id uuid, _user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.companies where id = _company_id and user_id = auth.uid()) then
    return jsonb_build_object('error', 'not_owner');
  end if;
  delete from public.company_members where company_id = _company_id and user_id = _user_id;
  return jsonb_build_object('ok', true);
end; $$;

-- Lista membros com e-mail/nome (dono ou membro pode ver)
create or replace function public.list_company_members(_company_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare _result jsonb;
begin
  if not public.is_company_member(_company_id) then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id', m.user_id,
           'email', u.email,
           'name', p.full_name,
           'role', m.role
         ) order by m.created_at), '[]'::jsonb)
    into _result
  from public.company_members m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.company_id = _company_id;
  return _result;
end; $$;

grant execute on function public.add_company_member(uuid, text, text) to authenticated;
grant execute on function public.remove_company_member(uuid, uuid) to authenticated;
grant execute on function public.list_company_members(uuid) to authenticated;
