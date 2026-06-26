-- ============================================================
-- Security Audit — RLS para tabelas desprotegidas
-- ============================================================

-- 1. user_feedback: usuário só vê/edita o próprio feedback
ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own feedback"
  ON public.user_feedback FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admin full access feedback"
  ON public.user_feedback FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service role feedback"
  ON public.user_feedback FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. admin_recados: todos leem, só admin gerencia
ALTER TABLE public.admin_recados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read recados"
  ON public.admin_recados FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admin manage recados"
  ON public.admin_recados FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin update recados"
  ON public.admin_recados FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin delete recados"
  ON public.admin_recados FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Service role recados"
  ON public.admin_recados FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 3. stock_guide: read-only para autenticados
ALTER TABLE public.stock_guide ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read stock_guide"
  ON public.stock_guide FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role stock_guide"
  ON public.stock_guide FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 4. fii_informes_cache: read-only para autenticados
ALTER TABLE public.fii_informes_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read fii_cache"
  ON public.fii_informes_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role fii_cache"
  ON public.fii_informes_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 5. ticker_quote_cache: read-only para autenticados
ALTER TABLE public.ticker_quote_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ticker_cache"
  ON public.ticker_quote_cache FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Service role ticker_cache"
  ON public.ticker_quote_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);
