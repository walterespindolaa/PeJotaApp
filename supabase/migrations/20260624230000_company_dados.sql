-- Dados cadastrais da empresa (tela de configurações)
alter table public.companies
  add column if not exists cnpj text,
  add column if not exists endereco text,
  add column if not exists telefone text;
