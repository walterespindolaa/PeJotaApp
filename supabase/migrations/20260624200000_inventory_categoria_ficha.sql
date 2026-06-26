-- Categoria do insumo (agrupa a lista de compras: hortifruti, açougue, secos...)
-- e ficha técnica simples (anotação em texto livre por produto)
alter table public.business_inventory_items
  add column if not exists categoria text,
  add column if not exists ficha_descricao text;
