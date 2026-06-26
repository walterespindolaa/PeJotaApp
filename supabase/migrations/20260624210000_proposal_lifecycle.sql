-- Ciclo de vida da proposta: aceita (receita prevista) → entregue (receita realizada)
alter table public.business_proposals drop constraint if exists business_proposals_status_chk;
alter table public.business_proposals
  add constraint business_proposals_status_chk
  check (status in ('rascunho','enviada','vista','aceita','recusada','ajuste','entregue'));

alter table public.business_proposals
  add column if not exists revenue_done boolean not null default false,
  add column if not exists delivered_at timestamptz;
