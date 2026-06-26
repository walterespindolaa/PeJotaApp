
-- Extend the RPC to include foto_casal, foto_geral and emoji fields
CREATE OR REPLACE FUNCTION public.get_household_owner_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner_id uuid;
  _owner_email text;
  _profile jsonb;
BEGIN
  IF _uid IS NULL THEN RETURN NULL; END IF;

  SELECT h.owner_id INTO _owner_id
  FROM public.household_members hm
  JOIN public.households h ON h.id = hm.household_id
  WHERE hm.user_id = _uid
    AND hm.role = 'member'
    AND hm.status IN ('active', 'invited')
  ORDER BY hm.updated_at DESC
  LIMIT 1;

  IF _owner_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'owner_id', _owner_id,
    'nome_pessoa1', COALESCE(p.nome_pessoa1, 'Pessoa 1'),
    'nome_pessoa2', COALESCE(p.nome_pessoa2, 'Pessoa 2'),
    'foto_pessoa1', COALESCE(p.foto_pessoa1, ''),
    'foto_pessoa2', COALESCE(p.foto_pessoa2, ''),
    'foto_casal', COALESCE(p.foto_casal, ''),
    'foto_geral', COALESCE(p.foto_geral, ''),
    'vinculo_pessoa2', COALESCE(p.vinculo_pessoa2, 'Cônjuge'),
    'pessoa2_participa_geral', COALESCE(p.pessoa2_participa_geral, true),
    'emoji_pessoa1', COALESCE(p.emoji_pessoa1, '👋'),
    'emoji_pessoa2', COALESCE(p.emoji_pessoa2, '👋'),
    'emoji_casal', COALESCE(p.emoji_casal, '❤️'),
    'emoji_geral', COALESCE(p.emoji_geral, '📊')
  ) INTO _profile
  FROM public.profiles p
  WHERE p.user_id = _owner_id;

  SELECT email INTO _owner_email FROM auth.users WHERE id = _owner_id;

  RETURN jsonb_set(COALESCE(_profile, '{}'::jsonb), '{owner_email}', to_jsonb(COALESCE(_owner_email, '')));
END;
$$;
