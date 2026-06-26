-- Padrão de cor de destaque dos novos usuários: Azul Atlas (antes era 'sand')
alter table public.profiles alter column tema_destaque set default 'default';

-- Convidados restritos não conseguem trocar tema sozinhos → aplica o padrão da marca
update public.profiles set tema_destaque = 'default' where access_scope = 'negocios' and tema_destaque = 'sand';
