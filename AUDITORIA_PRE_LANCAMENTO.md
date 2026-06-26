# Auditoria de Pré-Lançamento — Atlas

**Repo auditado:** `walterespindola/Use-Atlas-App` (código vivo conectado, branch `main`) — fonte da verdade, não o zip.
**Data:** 2026-06-17 · **Modo:** read-only, nenhuma correção aplicada.
**Eixos:** Segurança · Usabilidade · Conformidade/Consistência.

> Veredito geral: o sistema está em **boa forma** para pré-lançamento. RLS robusta, sem segredos hardcoded, auth das Edge Functions consistente, Stripe com assinatura+idempotência+Price IDs batendo. Os bugs já resolvidos continuam intactos. Há **1 P0** (authz cross-tenant), um punhado de **P1** (provisionamento de compra, estados de erro ausentes, i18n, marca) e o resto é **P2**.

---

## P0 — BLOQUEIA LANÇAMENTO

### P0-1 · [SEG] IDOR no `household-invite` (remove/resend não filtram por household)
- **Evidência:** `supabase/functions/household-invite/index.ts:268-272` (remove) e `:296-300` (resend). A checagem de dono em `:114-122` valida só que o chamador é dono do `household_id` que **ele mesmo enviou**; depois o membro é buscado por `.eq("id", member_id)` **sem** `.eq("household_id", household_id)`.
- **Impacto (simples):** qualquer titular de um household pode passar o `household_id` dele (passa na checagem) junto de um `member_id` de **outro** household. Em `remove`, marca o membro alheio como `removed` e força `signOut`. Em `resend` (`:307,327`), **rotaciona a senha** do membro alheio e o desloga — ou seja, takeover/lockout de conta entre tenants num app financeiro. Atenuante: `member_id` é UUID (não enumerável), então exige conhecer/vazar o ID.
- **Correção recomendada:** após buscar o membro, exigir `member.household_id === household_id` (e adicionar `.eq("household_id", household_id)` na query) antes de qualquer mutação; retornar 403/404 em divergência. → *pipe: Lovable (Deno), "NÃO alterar nenhuma outra seção".*

---

## P1 — IMPORTANTE

### P1-1 · [SEG/Stripe] `create-checkout` nunca recebe `client_reference_id` → compra provisiona conta errada
- **Evidência:** `src/pages/Comprar.tsx:118-120` envia só `{plano, nome, email, telefone}`. O webhook lê `clientRefId` (`webhook-stripe/index.ts:189`) e, na ausência, resolve o usuário **por email** ou **cria conta nova** (`:192-209`).
- **Impacto:** usuário logado que pagar com um email diferente do cadastro recebe o plano numa **conta nova/errada** — paga e não vê upgrade, em silêncio. É exatamente a classe "compra falha em silêncio".
- **Correção recomendada:** quando houver sessão, enviar `client_reference_id: session.user.id` no `Comprar.tsx`; no webhook, tratar `client_reference_id` como dica e validar contra o email do customer antes de conceder acesso a outra conta. → *pipe: Claude Code (frontend) + Lovable (webhook).*

### P1-2 · [SEG/Billing] `billing-notifier` aponta CTA de renovação para Cakto, não Stripe
- **Evidência:** `supabase/functions/billing-notifier/index.ts:10-11` — link `https://pay.cakto.com.br/q3phu7n_790379?cupom=RENOVA15`.
- **Impacto:** novas compras vão pro Stripe, mas a régua de renovação/trial manda o cliente pra **outro processador**. Risco de cobrança dupla / assinaturas órfãs entre dois sistemas, ou entitlements dessincronizados. Pode ser intencional (Cakto = renovação) — **confirmar intenção**.
- **Correção recomendada:** decidir provedor único do funil; se dual, documentar a reconciliação de entitlements. → *pipe: produto/decisão antes de código.*

### P1-3 · [UX] `DashboardHome` sem estado de erro
- **Evidência:** `src/pages/DashboardHome.tsx:213-317` — ~13 queries Supabase em paralelo, **sem try/catch e sem UI de erro**; em falha o `loading` pode ficar `true` (skeleton infinito, `:454`) ou renderizar tudo zerado parecendo "você não tem nada".
- **Impacto:** tela principal pode travar no skeleton ou mostrar dados falsos de zero. Correção: try/catch + estado de retry. → *pipe: Claude Code.*

### P1-4 · [UX] `InvestimentosContext` engole erros e dá toast de sucesso em escrita que falhou
- **Evidência:** `src/contexts/InvestimentosContext.tsx:166-203` (fetch ignora `.error`), `:407-411` (`handleSave`) e `:434-437` (`handleDelete`) mostram "sucesso" incondicionalmente.
- **Impacto:** usuário vê "Investimento adicionado" e nada foi salvo. Correção: checar `error` e tratar falha. → *pipe: Claude Code.*

### P1-5 · [UX] `OnboardingWizard` perde dados em silêncio
- **Evidência:** `src/components/onboarding/OnboardingWizard.tsx:81-83, 105-107, 147-149, 164-167` — todo save engole o erro e avança; o Atlas Score (step 4) é calculado sobre dados que podem não ter salvo.
- **Impacto:** primeiro contato do usuário gera score sobre base incompleta, sem aviso. Correção: toast de falha + permitir retry antes de avançar. → *pipe: Claude Code.*

### P1-6 · [UX] `/comece` — regra de senha contraditória + `validateCoupon` sem tratamento
- **Evidência:** `src/pages/Comece.tsx:105` valida `length < 8`, mas o placeholder em `:304` diz "Mínimo 6 caracteres". `validateCoupon` (`:82-83`) chama RPC sem try/catch.
- **Impacto:** usuário com 6-7 chars é rejeitado contrariando o rótulo; falha de rede no cupom deixa estado indeterminado. Correção: alinhar a regra (6 vs 8) e try/catch + feedback no cupom. → *pipe: Claude Code.*

### P1-7 · [UX/LGPD] Consentimento de marketing coletado e ignorado no checkout
- **Evidência:** `src/pages/Comprar.tsx:87, 324-332` coletam `aceitoMarketing`, mas o body em `:118-120` não envia.
- **Impacto:** ou é registro de consentimento perdido (LGPD), ou UI morta. Correção: persistir o flag ou remover o controle. → *pipe: Claude Code (+ Lovable se for gravar consentimento).*

### P1-8 · [UX] i18n praticamente inativo (en/es recebem app em pt-BR)
- **Evidência:** `useI18n`/`t()` é consumido por ~8 arquivos; os dicionários em `src/lib/i18n/*` são quase só `nav.*`. 80+ páginas/componentes têm pt-BR hardcoded em JSX (ex.: `Comece.tsx`, `Comprar.tsx`, `DashboardHome.tsx`, `VisaoGeral.tsx`, `AtlasChatFAB.tsx`).
- **Impacto:** o seletor de idioma é cosmético; só a sidebar troca. Correção (faseável): decidir se en/es é requisito de lançamento; se sim, extrair strings dos fluxos críticos primeiro. → *pipe: Claude Code, incremental.*

### P1-9 · [Acessibilidade] Botões só-ícone sem nome acessível
- **Evidência:** `src/components/AtlasChatFAB.tsx:204-210` (fechar/expandir sem `aria-label`); ações de linha em `src/pages/investimentos/VisaoGeral.tsx:1018-1073` usam só `title=` (não confiável para leitor de tela).
- **Impacto:** navegação por leitor de tela fica ambígua. Correção: `aria-label` nos botões de ícone. → *pipe: Claude Code.*

### P1-10 · [Marca] Emoji na UI em fluxos primários (regra: só Lucide)
- **Evidência (alta visibilidade):** `Comece.tsx:123` ("🚀" no toast de boas-vindas); `AtlasChatFAB.tsx:120,162` ("⚠️" em erros do chat); `DashboardHome.tsx:488` ("❤️"), `:1077` ("🐷"); `components/dashboard/AtlasConselheiro.tsx:21,28`; `investimentos/VisaoGeral.tsx:440,615,826,942`.
- **Impacto:** viola seu padrão de marca em telas centrais. Trivial de corrigir (trocar por ícone Lucide ou remover). **Você pode tratar como P0 por política de marca.** Lista P1/P2 completa de emojis no Apêndice B. → *pipe: Claude Code.*

---

## P2 — DESEJÁVEL

### Segurança
- **P2-1 · `confirm-password-reset` single-use não atômico** — `confirm-password-reset/index.ts:63-65` (lê `used_at`) vs `:106-109` (grava). Race entre check e update; mitigado por rate limit. Fix: update condicional `.is("used_at", null)` + checar rowCount (como o `consume_invite_token` faz).
- **P2-2 · Comparação de assinatura Stripe não constant-time** — `webhook-stripe/index.ts:44` (`computed !== expectedSig`). Timing oracle teórico. Fix: comparação constant-time ou `stripe.webhooks.constructEventAsync`.
- **P2-3 · Idempotência insere-antes-de-processar pode descartar evento que falhou** — `webhook-stripe/index.ts:104-122` (comentado no próprio código). Se o handler quebra após o insert, o retry do Stripe é bloqueado. Fix: marcar processado só após sucesso, ou job de reconciliação sobre `audit_logs`.
- **P2-4 · `send-email` grava email cru em `audit_logs`** — `send-email/index.ts:115,123`. `_shared/pii.ts` (`hashPii`) já existe e é usado noutros fluxos; aplicar aqui também (LGPD).
- **P2-5 · `checkRateLimit` falha aberto** — `_shared/rate-limit.ts:67-72` retorna `{allowed:true}` em erro de DB. Tradeoff de disponibilidade documentado; considerar fail-closed nos escopos mais sensíveis (checkout, reset de senha). *(Quota de IA já falha fechada — `quota-check.ts:34-43`.)*
- **P2-6 · `admin_recados` legível por todo autenticado** — migration `20260506120000_security_audit_rls.sql:24-26` (`USING (true)`). OK se for broadcast público; confirmar que o conteúdo não é sensível.
- **P2-7 · `criador-estudio/.env` commitado + `.gitignore` sem regra `.env`** — `criador-estudio/.env:2` (apenas a **anon key**, que é pública por design — não é vazamento de service_role). É um footgun: o dia que entrar um segredo real nesse arquivo, vai junto. Fix: ignorar `.env*` no subprojeto e `git rm --cached`.

### Conformidade / Dívida (só MAPEAR — correção pós-lançamento)
- **P2-8 · 14 arquivos órfãos** (nunca importados/montados). Lista no Apêndice C.
- **P2-9 · Dívida de tipos `any`/`as any` em `src/hooks/`** — 203 ocorrências. Piores: `useOrganiza.tsx` (33 `as any`), `usePaymentAlerts.tsx` (24), `useBusinessRecurring.tsx` (12), `useHousehold.tsx` (11), `useReportPersistence.tsx` (10). Causa raiz: `from("tabela" as any)` para tabelas ausentes em `types.ts`. Fix pós-launch: regenerar tipos do Supabase.
- **P2-10 · `console.*`** — muito limpo: 0 `console.log`, 2 `warn`, 12 `error`, todos em error-paths legítimos via `src/lib/log.ts`. Sem ação.

### UX (P2)
- **P2-11 · Larguras fixas em px** no `Comece.tsx` (`:200,239-246`) — frágil vs breakpoints Tailwind.
- **P2-12 · `Comprar.tsx` painel de marca `min-h-[280px]` em mobile** (`:143`) empurra o formulário pra baixo da dobra em telas pequenas.
- **P2-13 · Painel do chat sem `role="dialog"`/focus trap** — `AtlasChatFAB.tsx:176-189` (overlay custom fora do Dialog do shadcn).
- **P2-14 · Emoji-como-conteúdo** (🐷 reserva em `VisaoGeral.tsx:826,942`) — significado só via emoji; usar ícone + texto.

---

## CONFIRMADO INTACTO (não re-sinalizar)
- **Totais canônicos** — `src/lib/computeMonthTotals.ts:19-23` (totalDespesas COM dívida; despesaCorrente SEM; totalDividas separado). `atlas-chat/index.ts:234,511` espelha. ✔
- **`companies .limit(1)`** corrigido — `useAtlasScore.ts:66` (usa `fetchAllCompaniesTransactions`) e `DashboardHome.tsx:236`. Nenhum outro offender em `companies`. ✔
- **Calendário marca pago via `pagamentos`** — `src/pages/Calendario.tsx:10,78,122` (`upsertPagamentoMensal`). ✔
- **Sem `new Date("YYYY-MM-01")`** em `src/` — usa aritmética de string (`projectRecurring.ts:24`, `mergeRecurring.ts:22`). ✔
- **Sem double-count de recorrentes** — dedup em `projectRecurring.ts:27`, `mergeRecurring.ts:17-20`, `useProximosVencimentos` com `seen` Set. ✔
- **Segurança base** — RLS habilitada em todas as tabelas de usuário nas migrations; sem segredos hardcoded; frontend só com anon key (`src/integrations/supabase/client.ts:5-11`); `increment_rate_limit` via service-role (`_shared/rate-limit.ts:21-30,60`); CORS restrito a allowlist (`_shared/cors.ts:2-21`); sem PII em `console.*`; Price IDs batem 1:1 (essencial/pro/elite) entre `create-checkout` e `webhook-stripe`. ✔

---

## VERIFICAR AO VIVO (não dá pra confirmar pelo código — rode você)

**1. RLS de fato habilitada no banco vivo** (Supabase SQL Editor):
```sql
-- Tabelas em public SEM RLS:
SELECT c.relname AS tabela, c.relrowsecurity AS rls
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false
ORDER BY 1;

-- Policies com USING(true) em tabela de usuário (revisar):
SELECT tablename, policyname, cmd, qual
FROM pg_policies WHERE schemaname='public' AND qual='true'
ORDER BY 1;

-- Tabelas com user_id mas SEM policy citando auth.uid():
SELECT DISTINCT c.relname FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid AND a.attname='user_id' AND a.attnum>0
WHERE n.nspname='public' AND c.relkind='r'
AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public'
  AND p.tablename=c.relname AND (p.qual ILIKE '%auth.uid()%' OR p.with_check ILIKE '%auth.uid()%'))
ORDER BY 1;
```

**2. Provisionamento de planos** — confirmar que a tabela `plans` tem linhas com slug **exatamente** `atlas_essencial`, `atlas_pro`, `atlas_elite` (senão `user_plans` nunca é gravado, mesmo com `user_subscriptions=full` — `webhook-stripe/index.ts:254-263`):
```sql
SELECT slug FROM plans WHERE slug IN ('atlas_essencial','atlas_pro','atlas_elite');
```

**3. Stripe (painel):** os 3 Price IDs (`price_1TGlL3...`, `price_1TGlLb...`, `price_1TGlLx...`) estão em modo **live**, em **BRL**; o endpoint do webhook assina exatamente: `checkout.session.completed`, `customer.subscription.created/updated/deleted`, `invoice.payment_failed`.

**4. Secrets do Supabase setados:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `CRON_SECRET` (forte). Se `STRIPE_WEBHOOK_SECRET` faltar, o webhook rejeita tudo (eventos perdidos).

**5. `config.toml` vs deploy:** muitas funções têm `verify_jwt=false` (cada uma faz auth no próprio código — OK por design), mas confirme que as versões **deployadas** batem com o repo. **Atenção:** `config.toml` lista `webhook-cakto`, `webhook-kiwify`, `ai-test` que **não têm `index.ts`** nesta árvore — verifique se estão deployadas e, se sim, audite à parte.

**6. Grants de RPC:** `check_and_increment_rate_limit`, `consume_invite_token`, `peek_invite_token` concedidos **só a service_role** (não authenticated/anon).

**7. Ownership no import OFX:** confirmar que `import_ofx_batch`/`check_and_increment_ai_quota` impedem usar `account_id` de outro usuário (RLS dentro da RPC).

**8. Build local (não consegui rodar conclusivamente no sandbox — `node_modules` é do seu Mac e há lock de filesystem na pasta montada):**
```bash
bun install && bun run build          # build de produção (Vite/esbuild — NÃO faz typecheck)
bunx tsc -p tsconfig.app.json --noEmit # checagem de tipos real (TS estrito)
```
A análise estática não achou erro de TS bloqueador nem TODO/FIXME bloqueador, mas **rode os dois** para fechar o item.

---

## Apêndice A — Modelo de auth por Edge Function (resumo)
Todas as rotas sensíveis verificam o chamador. `admin-*` checam role admin via service-role; crons exigem service-role key ou `CRON_SECRET`; `webhook-stripe` valida assinatura; endpoints anônimos por design (`create-checkout`, `register-trial`, `request-password-reset`, `accept-invite`) têm rate limit + validação de input. Único desvio de authz: **P0-1** (`household-invite`).

## Apêndice B — Emojis na UI (além dos P1)
`Alertas.tsx:104,112,118,124` · `investimentos/Proventos.tsx:735,740,778` · `InvestimentosLayout.tsx:309` · `AtlasNegocios.tsx:73,239-241,324,646-647,714,941,985` · `Seguros.tsx:116` · `RelatoriosMensais.tsx:203-209` · `Configuracoes.tsx:133` · `hooks/usePaymentAlerts.tsx:46,49,52,54` · `contexts/HouseholdViewContext.tsx:39,55-58` · (P2 auth/admin) `ForcePasswordChange.tsx:129,155` · `Auth.tsx:27,35` · `ImportOFX.tsx:246` · `Aposentadoria.tsx:202` · `Metas.tsx:177,242` · `ObjetivosDeVida.tsx:308` · `CursoDetalhe.tsx:46` · `ManualDoDinheiro.tsx:462` · `PlanoLiberdade.tsx:369` · `ProjecaoPatrimonial.tsx:100` · `RestrictedScreen.tsx:29` · admin pages.

## Apêndice C — Arquivos órfãos (P2-8)
`components/landing/LandingSections.tsx` · `components/QuickAddFAB.tsx` · `components/extrato/TabInsercaoManual.tsx` · `components/alerts/AlertsDrawer.tsx` · `components/dashboard/{AtlasSimulador,ResumoMensalChart,ModoEstrategico,AtlasConselheiro,AtlasAchievements}.tsx` · `components/organiza/TabMetas.tsx` · `pages/{EvolucaoPatrimonial,PlanejamentoEstrategico,PlanejamentoFinanceiroCurso}.tsx` · `lib/notificationCatalog.ts`. *(Confirmar com `git log` que nenhum é feature parada antes de apagar — especialmente as 3 páginas.)*
