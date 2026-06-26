-- Blindagem 1: view de usuários presos no loop de força-troca-de-senha há mais
-- de 24h. Útil para monitoramento diário — roda isso de vez em quando no SQL
-- Editor e libera manualmente quem está preso enquanto não descobre a causa raiz.

CREATE OR REPLACE VIEW public.v_users_stuck_password_change AS
SELECT
  p.user_id,
  u.email,
  p.full_name,
  p.must_change_password,
  u.created_at AS account_created_at,
  u.last_sign_in_at,
  EXTRACT(EPOCH FROM (NOW() - COALESCE(u.last_sign_in_at, u.created_at))) / 3600 AS hours_stuck,
  p.updated_at AS profile_last_updated
FROM profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE p.must_change_password = true
  AND COALESCE(u.last_sign_in_at, u.created_at) < NOW() - INTERVAL '24 hours'
ORDER BY hours_stuck DESC;

COMMENT ON VIEW public.v_users_stuck_password_change IS
  'Usuários com must_change_password=true há mais de 24h (indicador de loop). Conferir periodicamente no SQL Editor. Para liberar manualmente: UPDATE profiles SET must_change_password=false WHERE user_id=...';

-- Policy: só admins podem ler
ALTER VIEW public.v_users_stuck_password_change SET (security_invoker = on);
