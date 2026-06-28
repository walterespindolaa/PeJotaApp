-- PeJota — liga proposta à conta a receber gerada (evita duplicar)
alter table public.business_proposals add column if not exists bill_id uuid;
