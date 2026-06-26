
-- credit_card_installments for reconciliation (Topic 22)
CREATE TABLE public.credit_card_installments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint text NOT NULL,
  merchant text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  total_installments integer NOT NULL DEFAULT 1,
  started_at text NOT NULL,
  last_seen_at text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, fingerprint)
);
ALTER TABLE public.credit_card_installments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cc_installments" ON public.credit_card_installments FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cc_installments" ON public.credit_card_installments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cc_installments" ON public.credit_card_installments FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cc_installments" ON public.credit_card_installments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- merchant_rules for learning (Topic 23) — replaces/extends merchant_category_learning
CREATE TABLE public.merchant_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  merchant_norm text NOT NULL,
  category text NOT NULL,
  type text NOT NULL DEFAULT 'variavel',
  recurring_default boolean NOT NULL DEFAULT false,
  confidence numeric NOT NULL DEFAULT 0.5,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, merchant_norm)
);
ALTER TABLE public.merchant_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own merchant_rules" ON public.merchant_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own merchant_rules" ON public.merchant_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own merchant_rules" ON public.merchant_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own merchant_rules" ON public.merchant_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- pattern_rules for learning (Topic 23)
CREATE TABLE public.pattern_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  pattern text NOT NULL,
  category text NOT NULL,
  type text NOT NULL DEFAULT 'variavel',
  confidence numeric NOT NULL DEFAULT 0.5,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pattern_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pattern_rules" ON public.pattern_rules FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pattern_rules" ON public.pattern_rules FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pattern_rules" ON public.pattern_rules FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pattern_rules" ON public.pattern_rules FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ai_inference_cache for cost reduction (Topic 24)
CREATE TABLE public.ai_inference_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  fingerprint text NOT NULL,
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, fingerprint)
);
ALTER TABLE public.ai_inference_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ai_cache" ON public.ai_inference_cache FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own ai_cache" ON public.ai_inference_cache FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own ai_cache" ON public.ai_inference_cache FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- fatura_import_logs for observability (Topic 24)
CREATE TABLE public.fatura_import_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  file_name text,
  provider_used text,
  total_transactions integer NOT NULL DEFAULT 0,
  resolved_by_rules integer NOT NULL DEFAULT 0,
  resolved_by_cache integer NOT NULL DEFAULT 0,
  sent_to_ai integer NOT NULL DEFAULT 0,
  ai_fallback_used boolean NOT NULL DEFAULT false,
  estimated_tokens integer NOT NULL DEFAULT 0,
  processing_ms integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fatura_import_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own import_logs" ON public.fatura_import_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own import_logs" ON public.fatura_import_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all import_logs" ON public.fatura_import_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
