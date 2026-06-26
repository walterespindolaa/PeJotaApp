-- Marca quando a proposta aceita já teve baixa de estoque registrada (evita baixa dupla)
alter table public.business_proposals
  add column if not exists stock_done boolean not null default false;
