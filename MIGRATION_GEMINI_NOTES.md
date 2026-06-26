# Migracao Gemini direto — notas pos-launch

Tentamos migrar 8 edge functions do Lovable AI Gateway pra Google Gemini API direto (endpoint OpenAI-compatible) em 04/maio/2026. Revertido por incompatibilidades comportamentais.

## O que tentamos
- URL: https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
- Auth: GEMINI_API_KEY (criada e ativa no Supabase secrets)
- Models: gemini-2.5-flash, gemini-2.5-flash-lite
- Tier: Nivel 1 (pago, billing configurado no Google Cloud)

## Por que reverteu
1. Gemini 2.5 Flash via API direta tem "thinking" por padrao, consome max_tokens em raciocinio invisivel, output util fica truncado.
2. Truncamento quebrou: parser do decision-simulator (regex de 4 blocos), reports (textos cortados no meio), atlas-chat (perdeu contexto).

## Pra retomar pos-launch
Adicionar nos request bodies:
- reasoning_effort: "none" (ou tentar como extra_body)
- Aumentar max_tokens em todas as 8 functions: 400 -> 1500, 4000 -> 6000
- Testar com 1 function isolada antes de migrar todas

Alternativa: usar o endpoint Gemini nativo (nao OpenAI-compatible) que da mais controle sobre thinking_config e safety_settings. URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent. Maior trabalho de adaptacao mas controle total.

## Estado dos secrets (apos rollback)
- LOVABLE_API_KEY: em uso (8 functions de IA + 2 functions de email)
- GEMINI_API_KEY: configurado mas nao usado por nenhuma function (manter pra retomada futura)
- AUTH_WEBHOOK_SECRET: nao foi criado (commit 54fc6dd ja tinha sido revertido por outro motivo)
