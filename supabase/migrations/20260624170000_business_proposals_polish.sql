-- ===== Lapidação das propostas: storage (logo/media kit) + forma de pagamento =====

-- Bucket público para logos e media kits das empresas
insert into storage.buckets (id, name, public)
  values ('business-assets', 'business-assets', true)
  on conflict (id) do nothing;

drop policy if exists "business-assets insert own" on storage.objects;
create policy "business-assets insert own" on storage.objects for insert
  with check (bucket_id = 'business-assets' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "business-assets update own" on storage.objects;
create policy "business-assets update own" on storage.objects for update
  using (bucket_id = 'business-assets' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "business-assets delete own" on storage.objects;
create policy "business-assets delete own" on storage.objects for delete
  using (bucket_id = 'business-assets' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "business-assets public read" on storage.objects;
create policy "business-assets public read" on storage.objects for select
  using (bucket_id = 'business-assets');

-- Forma de pagamento por proposta
alter table public.business_proposals
  add column if not exists payment_method text,   -- pix | cartao | ambos
  add column if not exists installments int not null default 1;

-- Atualiza a RPC pública para devolver forma de pagamento
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
           'brand_color', c.brand_color, 'media_kit_url', c.media_kit_url, 'pix_key', c.pix_key)
    into _company from public.companies c where c.id = _p.company_id;
  return jsonb_build_object(
    'titulo', _p.titulo, 'terms', _p.terms, 'valid_until', _p.valid_until,
    'desconto', _p.desconto, 'status', _p.status, 'client_comment', _p.client_comment,
    'payment_method', _p.payment_method, 'installments', _p.installments,
    'items', _items, 'company', _company);
end; $$;

grant execute on function public.get_business_proposal(text) to anon, authenticated;
