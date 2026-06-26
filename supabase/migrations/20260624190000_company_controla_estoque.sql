-- Define se a empresa controla estoque/produção (mostra Estoque + ficha técnica).
-- NULL = automático pelo tipo de negócio (serviço/autônomo = não; demais = sim).
alter table public.companies
  add column if not exists controla_estoque boolean;
