-- Visão geral de uso/custo para o painel admin (gated por role admin).
create or replace function public.admin_usage_overview()
returns jsonb language plpgsql security definer set search_path = public as $$
declare _is_admin boolean; _month_start date := date_trunc('month', now())::date; _result jsonb;
begin
  select exists(select 1 from public.user_roles where user_id = auth.uid() and role = 'admin') into _is_admin;
  if not _is_admin then return jsonb_build_object('error', 'not_admin'); end if;

  select jsonb_build_object(
    'users',            (select count(*) from public.profiles),
    'paying',           (select count(*) from public.user_subscriptions where access_state = 'active' and origin = 'stripe'),
    'active_access',    (select count(*) from public.user_subscriptions where access_state = 'active'),
    'companies',        (select count(*) from public.companies where archived = false),
    'transactions',     (select count(*) from public.business_transactions),
    'clients',          (select count(*) from public.business_clients),
    'proposals',        (select count(*) from public.business_proposals),
    'company_members',  (select count(*) from public.company_members),
    'paid_seats',       (select coalesce(sum(paid_seats),0) from public.companies where archived = false),
    'ai_calls_month',   (select coalesce(sum(usage_count),0) from public.ai_usage_counter where period_start >= _month_start),
    'ai_by_feature',    (select coalesce(jsonb_object_agg(feature, total), '{}'::jsonb)
                          from (select feature, sum(usage_count) as total
                                from public.ai_usage_counter where period_start >= _month_start
                                group by feature) s)
  ) into _result;

  return _result;
end; $$;

grant execute on function public.admin_usage_overview() to authenticated;
