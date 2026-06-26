# Prontidão de Lançamento — Atlas (go/no-go)

Auditoria em dois eixos (engenharia/ops e compliance/legal/pagamento), com evidência `arquivo:linha`. **Veredito: GO condicional.** Nenhum bloqueador de estabilidade; os pendentes reais são jurídicos/LGPD e devem ser fechados antes do lançamento público.

## Engenharia / Ops — sólido ✅
- **SPA + 404:** rewrite no `vercel.json:28-30`, catch-all `App.tsx:255`. Deep links e refresh funcionam.
- **Erro:** Sentry em produção (`main.tsx:28-79`) + ErrorBoundary global (`App.tsx:127,266`) com fallback amigável — sem tela branca.
- **Segredos:** só `VITE_*` + anon key pública do Supabase (`client.ts:5-6`); zero segredo hardcoded.
- **Build:** sourcemaps off, `drop_console`, chunks divididos (`vite.config.ts`).
- **PWA/SEO:** manifest completo + ícones, OG/Twitter/JSON-LD no `index.html`.

Pendências menores de ops (P1/P2, não bloqueiam): garantir `og:image` publicado na CDN (ou fallback `public/og-atlas.png`); traduzir o 404 (`NotFound.tsx`, está em inglês); sem analytics de produto (decisão de marketing).

## Compliance / Legal — fechar antes de lançar ⚠️

**Bloqueadores legais (recomendado resolver antes do público):**

1. **Exclusão de conta self-service (direito LGPD).** Não existe — a Política de Privacidade *promete* exclusão (`PoliticaDePrivacidadeContent.tsx:55`) mas o titular não tem como exercê-la (só delete administrativo). → Fluxo no Perfil (mínimo: solicitação registrada + e-mail; ideal: edge function `delete-account` autenticada).

2. **Consentimento de Termos/Privacidade no cadastro trial.** `Comece.tsx:337-348` só tem checkbox de marketing; o aceite de termos só é cobrado depois, por modal no dashboard (`TermsAcceptanceGate`). → Adicionar checkbox obrigatório com links para `/termos-de-uso` e `/politica-de-privacidade` no cadastro e registrar o aceite (versão+timestamp) já no `register-trial`. (Na compra avulsa o aceite já existe — `Comprar.tsx:305-332`.)

3. **Rodapé público com links legais.** A landing (`Index.tsx`) não tem rodapé com Termos/Privacidade. → Adicionar rodapé global (landing + `/comece`).

**Recomendado (P1):**
- **Exportação de dados (portabilidade LGPD)** também é prometida na política e não existe. → Export JSON/CSV ou canal documentado.
- **E-mail/DPO de privacidade** explícito na política (art. 41 LGPD), hoje genérico.
- **Disclaimer "não é recomendação de investimento"** está nos 4 relatórios de IA, mas falta nas **simulações** (`SimuladorDecisao`, `SimuladorFinanciamento`, `ProjecaoPatrimonial`, `Aposentadoria`) — justamente as mais sensíveis. → Incluir `<AIReportDisclaimer />`.
- **Aviso de falha de pagamento (dunning):** `webhook-stripe` trata `invoice.payment_failed` mas não notifica o cliente. → Disparar e-mail (infra `send-email`/`billing-notifier` já existe).

**Nice (P2):** centralizar o `PRICE_MAP` (hoje duplicado em `create-checkout` e `webhook-stripe`); trocar o `prompt()` nativo do "esqueci a senha" (`Auth.tsx:26`) por input; toast de erro no `TermsAcceptanceGate`.

## Pagamento (Stripe) — sólido ✅
Webhook com assinatura constant-time, idempotência, grace period de 30 dias e **sem downgrade silencioso** (`webhook-stripe`). Checkout valida dados, rate-limita e propaga `client_reference_id`/metadata. Front trata erro e destrava o botão.

## Recomendação
**Go** assim que os 3 bloqueadores legais forem resolvidos (exclusão de conta, consentimento no trial, rodapé legal). Estimo serem mudanças pequenas/médias. O resto (P1/P2) pode entrar logo após o lançamento.
