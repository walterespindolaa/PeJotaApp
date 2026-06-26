-- Lembretes de Negócios: aniversariantes do dia + clientes inativos (30–120 dias), por dono.
create or replace function public.business_reminders_today()
returns table(owner_id uuid, aniversariantes text[], inativos text[])
language sql security definer set search_path = public as $$
  with cl as (
    select c.id, c.name, c.company_id, c.data_nascimento, max(t.date) as last_tx
    from public.business_clients c
    left join public.business_transactions t on t.client_id = c.id
    where c.active = true
    group by c.id, c.name, c.company_id, c.data_nascimento
  )
  select comp.user_id,
    array_remove(array_agg(distinct cl.name) filter (
      where cl.data_nascimento is not null and to_char(cl.data_nascimento, 'MM-DD') = to_char(now(), 'MM-DD')
    ), null),
    array_remove(array_agg(distinct cl.name) filter (
      where cl.last_tx is not null
        and cl.last_tx < (now() - interval '30 days')::date
        and cl.last_tx > (now() - interval '120 days')::date
    ), null)
  from public.companies comp
  join cl on cl.company_id = comp.id
  where comp.archived = false
  group by comp.user_id;
$$;

grant execute on function public.business_reminders_today() to service_role;
