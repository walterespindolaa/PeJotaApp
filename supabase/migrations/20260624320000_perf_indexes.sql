-- ============================================================
-- Auditoria de escala — índices em colunas quentes (P0 + P1)
-- Idempotente (if not exists). Tabelas ainda pequenas → lock breve, seguro.
-- ============================================================

-- P0 — query mais quente do Atlas Negócios (financeiro por empresa + período)
create index if not exists idx_biz_tx_company_date on public.business_transactions (company_id, date desc);

-- P0 — recorrências não tinham NENHUM índice
create index if not exists idx_biz_rec_templates_company on public.business_recurring_templates (company_id, active);
create index if not exists idx_biz_rec_instances_company on public.business_recurring_instances (company_id, month_ref desc);
create index if not exists idx_biz_rec_instances_status on public.business_recurring_instances (company_id, status);

-- P0 — RLS de household: 3 JOINs por linha sem índice de suporte
create index if not exists idx_household_members_household on public.household_members (household_id, status, role);
create index if not exists idx_household_members_user on public.household_members (user_id);

-- P1 — company_id faltando (suporte à RLS de membro + leitura)
create index if not exists idx_biz_stock_company on public.business_stock_movements (company_id, created_at desc);
create index if not exists idx_biz_client_notes_company on public.business_client_notes (company_id);
create index if not exists idx_biz_client_tasks_company on public.business_client_tasks (company_id);
create index if not exists idx_biz_recipes_company on public.business_recipes (company_id);
create index if not exists idx_biz_recipes_insumo on public.business_recipes (insumo_id);
create index if not exists idx_biz_categories_company on public.business_categories (company_id);
create index if not exists idx_biz_proposal_items_product on public.business_proposal_items (product_id);
