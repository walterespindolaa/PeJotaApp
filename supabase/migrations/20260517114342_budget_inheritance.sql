-- RPC 1: busca orçamento com fallback pro último mês com dados.
-- Comportamento: retorna SEMPRE as linhas reais do mês solicitado +
-- complementa categorias faltantes com herança do último mês anterior
-- com dados (cada herança marcada is_inherited=true).
-- Mix é necessário pra suportar edição parcial sem perder o preview
-- das outras categorias (test case "edita 1 linha sem confirmar →
-- banner continua nas outras herdadas").
CREATE OR REPLACE FUNCTION public.get_budget_with_fallback(
  p_user_id uuid,
  p_mes_ano text
)
RETURNS TABLE (
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
  SELECT oc.categoria, oc.valor_limite, false, null::text
  FROM public.orcamentos_categorias oc
  WHERE oc.user_id = p_user_id AND oc.mes_ano = p_mes_ano;

  IF v_fallback_mes IS NOT NULL THEN
    RETURN QUERY
    SELECT oc.categoria, oc.valor_limite, true, v_fallback_mes
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

-- RPC 2: confirma herança (insert massivo idempotente).
-- Copia todas as linhas do mês origem pro mês destino. ON CONFLICT
-- preserva linhas já editadas pelo usuário na sessão atual.
CREATE OR REPLACE FUNCTION public.confirm_inherited_budget(
  p_user_id uuid,
  p_mes_ano text,
  p_source_mes_ano text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  WITH inserted AS (
    INSERT INTO public.orcamentos_categorias (user_id, mes_ano, categoria, valor_limite)
    SELECT p_user_id, p_mes_ano, categoria, valor_limite
    FROM public.orcamentos_categorias
    WHERE user_id = p_user_id AND mes_ano = p_source_mes_ano
    ON CONFLICT (user_id, mes_ano, categoria) DO NOTHING
    RETURNING id
  )
  SELECT count(*) INTO v_inserted FROM inserted;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_inherited_budget(uuid, text, text) TO authenticated;
