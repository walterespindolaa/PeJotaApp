-- Adiciona coluna `id` no retorno de get_budget_with_fallback.
-- Real rows trazem o UUID real; inherited rows trazem NULL.
-- Necessário porque o frontend precisa do UUID pra rodar UPDATE quando o
-- usuário edita uma linha já persistida (antes o id="" causava
-- "invalid input syntax for type uuid").
-- DROP é obrigatório porque CREATE OR REPLACE não permite mudar a
-- assinatura da RETURNS TABLE.
DROP FUNCTION IF EXISTS public.get_budget_with_fallback(uuid, text);

CREATE FUNCTION public.get_budget_with_fallback(
  p_user_id uuid,
  p_mes_ano text
)
RETURNS TABLE (
  id uuid,
  categoria text,
  valor_limite numeric,
  is_inherited boolean,
  inherited_from_month text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fallback_mes text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT oc.mes_ano INTO v_fallback_mes
  FROM public.orcamentos_categorias oc
  WHERE oc.user_id = p_user_id AND oc.mes_ano < p_mes_ano
  ORDER BY oc.mes_ano DESC
  LIMIT 1;

  RETURN QUERY
  SELECT oc.id, oc.categoria, oc.valor_limite, false, null::text
  FROM public.orcamentos_categorias oc
  WHERE oc.user_id = p_user_id AND oc.mes_ano = p_mes_ano;

  IF v_fallback_mes IS NOT NULL THEN
    RETURN QUERY
    SELECT null::uuid, oc.categoria, oc.valor_limite, true, v_fallback_mes
    FROM public.orcamentos_categorias oc
    WHERE oc.user_id = p_user_id
      AND oc.mes_ano = v_fallback_mes
      AND oc.categoria NOT IN (
        SELECT inner_oc.categoria
        FROM public.orcamentos_categorias inner_oc
        WHERE inner_oc.user_id = p_user_id AND inner_oc.mes_ano = p_mes_ano
      );
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_budget_with_fallback(uuid, text) TO authenticated;
