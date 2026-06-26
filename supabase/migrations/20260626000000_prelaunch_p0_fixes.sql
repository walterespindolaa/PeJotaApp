-- ============================================================
-- Correções P0 pré-lançamento (segurança + billing)
-- ============================================================

-- 1) Constraint: permitir 'cancelled_grace' (o webhook grava esse valor ao cancelar)
alter table public.user_subscriptions drop constraint if exists user_subscriptions_access_state_check;
alter table public.user_subscriptions add constraint user_subscriptions_access_state_check
  check (access_state = any (array['trial','grace','active','restricted','awaiting_payment','cancelled_grace']));

-- 2) Funções SECURITY DEFINER que confiam em parâmetro do chamador:
--    revogar do público e deixar só service_role (todas só são chamadas por
--    edge functions com service role, ou não são usadas pelo frontend).
revoke execute on function public.find_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_user_id_by_email(text) to service_role;

revoke execute on function public.get_user_tier(uuid) from public, anon, authenticated;
grant execute on function public.get_user_tier(uuid) to service_role;

revoke execute on function public.has_planejamento_360(uuid) from public, anon, authenticated;
grant execute on function public.has_planejamento_360(uuid) to service_role;

revoke execute on function public.get_effective_plan_state_for_user(uuid) from public, anon, authenticated;
grant execute on function public.get_effective_plan_state_for_user(uuid) to service_role;

revoke execute on function public.increment_coupon_usage(uuid) from public, anon, authenticated;
grant execute on function public.increment_coupon_usage(uuid) to service_role;

-- 3) despesas_skip: remover policies permissivas residuais (household-wide sem
--    filtro de status). As policies own-only ("...own skips") cobrem o acesso legítimo.
drop policy if exists "Users can view own despesas_skip" on public.despesas_skip;
drop policy if exists "Users can insert own despesas_skip" on public.despesas_skip;
drop policy if exists "Users can delete own despesas_skip" on public.despesas_skip;

-- 3b) Substituição ATÔMICA dos itens da proposta (evita perda de dado no "editar":
--     delete + insert numa transação única; se algo falha, nada é aplicado).
create or replace function public.replace_proposal_items(_proposal_id uuid, _items jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid := auth.uid();
begin
  if _uid is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.business_proposals p
    where p.id = _proposal_id and (p.user_id = _uid or public.is_company_member(p.company_id))
  ) then
    raise exception 'not_authorized';
  end if;

  delete from public.business_proposal_items where proposal_id = _proposal_id;

  insert into public.business_proposal_items
    (user_id, proposal_id, product_id, label, descricao, valor, quantidade, sort_order)
  select _uid, _proposal_id,
         nullif(i->>'product_id','')::uuid,
         coalesce(i->>'label',''),
         nullif(i->>'descricao',''),
         coalesce((i->>'valor')::numeric, 0),
         coalesce((i->>'quantidade')::numeric, 1),
         (ord::int - 1)
  from jsonb_array_elements(coalesce(_items, '[]'::jsonb)) with ordinality as t(i, ord);
end; $$;
grant execute on function public.replace_proposal_items(uuid, jsonb) to authenticated;

-- 4) business_proposal_items: fortalecer a policy "owner" para que o WITH CHECK
--    exija que o item pertença a uma proposta do próprio usuário/empresa
--    (fecha injeção de item em proposta de outro tenant). Leitura segue own-only.
drop policy if exists "business_proposal_items owner" on public.business_proposal_items;
create policy "business_proposal_items owner" on public.business_proposal_items
  for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.business_proposals p
      where p.id = proposal_id
        and (p.user_id = auth.uid() or public.is_company_member(p.company_id))
    )
  );
