-- Exclusão DEFINITIVA de empresa (apaga tudo, não arquiva). Owner-gated.
create or replace function public.delete_company(_company_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare t text;
begin
  if not exists (select 1 from public.companies where id = _company_id and user_id = auth.uid()) then
    return jsonb_build_object('error', 'not_owner');
  end if;

  -- itens de proposta (ligam via proposal_id)
  delete from public.business_proposal_items
   where proposal_id in (select id from public.business_proposals where company_id = _company_id);

  -- tabelas com company_id
  foreach t in array array[
    'business_transactions','business_categories','business_clients','business_leads',
    'business_lead_tasks','business_client_notes','business_client_tasks','business_inventory_items',
    'business_recipes','business_stock_movements','business_proposals','business_recurring_templates',
    'business_recurring_instances','business_imports','allocation_rules','company_members'
  ] loop
    if to_regclass(format('public.%s', t)) is null then continue; end if;
    if not exists (select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='company_id') then continue; end if;
    execute format('delete from public.%1$s where company_id = $1', t) using _company_id;
  end loop;

  delete from public.companies where id = _company_id;
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.delete_company(uuid) to authenticated;

-- Reafirma a view de monitoramento como security_invoker (resolve o alerta do scanner)
alter view if exists public.v_users_stuck_password_change set (security_invoker = on);
