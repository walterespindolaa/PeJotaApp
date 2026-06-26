-- Segmento/nicho da empresa (direciona as categorias de insumo, etc.)
alter table public.companies
  add column if not exists nicho text;
