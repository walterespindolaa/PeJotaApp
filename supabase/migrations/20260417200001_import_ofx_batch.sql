-- Atlas — import_ofx_batch
-- Insere transactions + receitas/despesas atomicamente.
-- Type 'transfer' só escreve em transactions.
-- Dedupe por (user_id, fit_id).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'transactions_user_fit_unique'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_user_fit_unique
      UNIQUE (user_id, fit_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'merchant_category_learning_user_merchant_unique'
  ) THEN
    ALTER TABLE public.merchant_category_learning
      ADD CONSTRAINT merchant_category_learning_user_merchant_unique
      UNIQUE (user_id, merchant);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.import_ofx_batch(
  p_account_id uuid,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_item jsonb;
  v_inserted_tx int := 0;
  v_inserted_rec int := 0;
  v_inserted_desp int := 0;
  v_skipped int := 0;
  v_fit_id text;
  v_type text;
  v_was_inserted boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'inserted_transactions', 0,
      'inserted_receitas', 0,
      'inserted_despesas', 0,
      'skipped_duplicates', 0
    );
  END IF;

  IF jsonb_array_length(p_items) > 500 THEN
    RAISE EXCEPTION 'batch too large (max 500)';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_fit_id := v_item->>'fit_id';
    v_type := v_item->>'type';

    IF v_type NOT IN ('income', 'expense', 'transfer') THEN
      CONTINUE;
    END IF;

    IF v_fit_id IS NOT NULL AND v_fit_id <> '' THEN
      INSERT INTO transactions (
        user_id, account_id, date, description, amount,
        category, type, source, responsavel, fit_id
      )
      VALUES (
        v_user_id, p_account_id,
        (v_item->>'date')::date,
        v_item->>'description',
        (v_item->>'amount')::numeric,
        v_item->>'category', v_type, 'ofx',
        v_item->>'responsavel', v_fit_id
      )
      ON CONFLICT (user_id, fit_id) DO NOTHING;

      GET DIAGNOSTICS v_was_inserted = ROW_COUNT;
    ELSE
      INSERT INTO transactions (
        user_id, account_id, date, description, amount,
        category, type, source, responsavel, fit_id
      )
      VALUES (
        v_user_id, p_account_id,
        (v_item->>'date')::date,
        v_item->>'description',
        (v_item->>'amount')::numeric,
        v_item->>'category', v_type, 'ofx',
        v_item->>'responsavel', NULL
      );
      v_was_inserted := 1;
    END IF;

    IF v_was_inserted::int = 0 THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_inserted_tx := v_inserted_tx + 1;

    IF v_type = 'income' THEN
      INSERT INTO receitas (
        user_id, data, categoria, descricao, valor,
        tipo, status, responsavel, recorrente
      )
      VALUES (
        v_user_id,
        (v_item->>'date')::date,
        CASE WHEN v_item->>'category' = 'Receita'
          THEN 'Salário/Pró-labore'
          ELSE v_item->>'category'
        END,
        v_item->>'description',
        (v_item->>'amount')::numeric,
        'variavel', 'recebido',
        v_item->>'responsavel', false
      );
      v_inserted_rec := v_inserted_rec + 1;

    ELSIF v_type = 'expense' THEN
      INSERT INTO despesas (
        user_id, data, categoria, descricao, valor,
        tipo, status, responsavel, is_parcelada, recorrente
      )
      VALUES (
        v_user_id,
        (v_item->>'date')::date,
        v_item->>'category',
        v_item->>'description',
        (v_item->>'amount')::numeric,
        'variavel', 'pago',
        v_item->>'responsavel', false, false
      );
      v_inserted_desp := v_inserted_desp + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted_transactions', v_inserted_tx,
    'inserted_receitas', v_inserted_rec,
    'inserted_despesas', v_inserted_desp,
    'skipped_duplicates', v_skipped
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.import_ofx_batch(uuid, jsonb) TO authenticated;
