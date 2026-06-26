-- Migration: agenda smart-notifications via pg_cron pra rodar a cada hora.
-- Usa pg_net pra chamar a Edge Function via HTTP POST.

-- Garantir extensions disponiveis (já criadas em migrations anteriores, mas idempotente)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Função wrapper que faz a chamada HTTP — invocada pelo cron.
-- Mantida em SECURITY DEFINER pra acessar Vault e fazer net call.
CREATE OR REPLACE FUNCTION public.invoke_smart_notifications()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _project_url text;
  _service_key text;
  _request_id bigint;
BEGIN
  -- Lê do Vault. Se ausente, falha silenciosa pra não quebrar cron.
  -- Configurar via Supabase Dashboard → Settings → Vault:
  --   PROJECT_URL = https://zscnhrnsfsrxbjiuuvtm.supabase.co
  --   SERVICE_ROLE_KEY = <service_role_key>
  SELECT decrypted_secret INTO _project_url FROM vault.decrypted_secrets WHERE name = 'PROJECT_URL' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'SERVICE_ROLE_KEY' LIMIT 1;

  IF _project_url IS NULL OR _service_key IS NULL THEN
    RAISE WARNING 'invoke_smart_notifications: PROJECT_URL ou SERVICE_ROLE_KEY ausentes no Vault. Cron skipped.';
    RETURN NULL;
  END IF;

  SELECT extensions.http_post(
    url := _project_url || '/functions/v1/smart-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || _service_key
    ),
    body := '{}'::jsonb
  ) INTO _request_id;

  RETURN _request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_smart_notifications() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.invoke_smart_notifications() TO postgres;

COMMENT ON FUNCTION public.invoke_smart_notifications IS 'Chama Edge Function smart-notifications via pg_net. Invocada por cron jobname=smart-notifications-hourly.';

-- Remover job anterior (se existir, pra ser idempotente em re-runs)
SELECT cron.unschedule('smart-notifications-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'smart-notifications-hourly'
);

-- Agendar a cada hora, no minuto 5 (pra não bater com hora cheia onde outros jobs costumam rodar)
SELECT cron.schedule(
  'smart-notifications-hourly',
  '5 * * * *',
  $$ SELECT public.invoke_smart_notifications(); $$
);

COMMENT ON EXTENSION pg_cron IS 'Atlas: smart-notifications-hourly job agendado em /supabase/migrations/20260429140000_smart_notifications_cron.sql';
