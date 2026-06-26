-- Assentos pagos por empresa (cobrança por usuário extra via Stripe).
-- Default 0. Durante a fase de teste, a trava fica desligada (convite continua livre).
alter table public.companies
  add column if not exists paid_seats int not null default 0;
