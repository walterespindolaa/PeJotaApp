-- Permite convites de membro de empresa (source 'business') nos tokens de convite
alter table public.account_invite_tokens drop constraint if exists account_invite_tokens_source_check;
alter table public.account_invite_tokens
  add constraint account_invite_tokens_source_check check (source in ('household', 'admin', 'business'));
