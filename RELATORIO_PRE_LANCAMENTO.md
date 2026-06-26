# Relatório de Verificação Pré-Lançamento — Atlas

> Auditoria dedicada por 4 frentes (pagamento/provisionamento, isolamento de dados/RLS, módulo Negócios/runtime, motor financeiro/crashes globais). Leitura de código real. Build/testes a confirmar no CI (não rodaram no ambiente da auditoria por I/O).

## Veredito

**Ainda NÃO está pronto pra abrir vendas em volume.** Existem **P0 reais** em duas áreas críticas: (1) **cancelamento/inadimplência não revoga acesso** e (2) **5 funções de banco permitem leitura de dados de outro usuário**. Também há **1 bug de perda de dado** no recém-criado "editar proposta". A boa notícia: as correções são pequenas e localizadas.

**Nota revisada: 6,5/10 hoje → ~9/10 depois dos P0** (todos corrigíveis rápido).

O que está **sólido e aprovado**: motor financeiro (fórmulas corretas, bem testadas), RLS das tabelas em si, edge functions (nenhuma confia em dados do body pra cross-tenant), infraestrutura de crash (ErrorBoundary, Suspense, contextos). Isso é raro e está acima da média pré-lançamento.

---

## P0 — Bloqueadores (corrigir antes de abrir)

### Pagamento / acesso

1. **Cancelamento não revoga acesso (constraint).** O webhook grava `access_state = 'cancelled_grace'`, mas esse valor **não existe** no CHECK da tabela (`trial/grace/active/restricted/awaiting_payment`). O UPDATE falha → cliente cancela/é reembolsado e **mantém acesso**. → `webhook-stripe/index.ts:468`. Fix: adicionar `cancelled_grace` ao CHECK (SQL) **ou** usar `restricted`.
2. **Mesmo corrigindo, cliente cancelado segue FULL.** No cancelamento o webhook não muda `plan_tier` (continua `"full"`) nem `full_expires_at`. O `usePlan` então devolve `isFull: true`. → `usePlan.tsx:177,212` + `webhook-stripe/index.ts:467`. Fix: no cancelamento, setar `plan_tier='free'` + `full_expires_at=now`.
3. **Inadimplência nunca restringe.** `invoice.payment_failed` só audita; toda revogação depende do `subscription.deleted` (que está quebrado pelos itens 1 e 2). → `webhook-stripe/index.ts:435,522`. Fix: tratar `status` `unpaid/canceled` no `subscription.updated` + validar política de dunning no Stripe.

### Isolamento de dados (RLS) — funções `SECURITY DEFINER` sem REVOKE, confiando em parâmetro do chamador

4. **`find_user_id_by_email`** — qualquer usuário resolve o UUID de qualquer conta por e-mail (enumeração). 
5. **`get_user_tier(_user_id)`** — lê o plano de qualquer usuário.
6. **`has_planejamento_360(_user_id)`** — sonda entitlement de qualquer usuário.
7. **`get_effective_plan_state_for_user(target_user_id)`** — lê assinatura/estado de qualquer usuário.
8. **`increment_coupon_usage(p_coupon_id)`** — escrita não autenticada: infla uso de qualquer cupom.

Fix (todas): `REVOKE EXECUTE ... FROM public, anon, authenticated; GRANT ... TO service_role;` e/ou gate `auth.uid() = _id OR has_role(auth.uid(),'admin')`.

### Módulo Negócios

9. **Editar proposta pode esvaziar a proposta (perda de dado).** `updateProposal` faz `delete` dos itens e depois `insert`, sem transação e **sem checar erro do insert**; retorna `true` mesmo se o insert falhar → proposta fica com R$ 0 e a UI diz "atualizada". → `useBusinessProposals.tsx:115-138`. Fix: checar erro do insert, idealmente RPC transacional; resetar `stock_done/revenue_done` ao editar.
10. **Baixa de estoque marca "concluída" mesmo se falhar.** `darBaixa` seta `stock_done=true` sem verificar se os movimentos deram certo → divergência silenciosa de estoque. → `BusinessPropostas.tsx:114-131`.

---

## P1 — Sério (idealmente antes de abrir; no máximo fast-follow)

- **Compra com e-mail diferente do cadastro** cria conta duplicada/errada (o `client_reference_id` só vai se logado). → `webhook-stripe` + `Comprar.tsx`.
- **Upgrade/downgrade**: price desconhecido cai em Essencial no ramo `updated` (downgrade silencioso de quem pagou Pro/Elite). → `webhook-stripe:413`.
- **Idempotência grava antes de processar**: se o handler falha, o retry do Stripe é ignorado → cliente paga e não recebe acesso. → `webhook-stripe:110`.
- **`paid_seats` dessincroniza** com eventos fora de ordem. → `webhook-stripe:139,389`.
- **`despesas_skip`**: políticas permissivas residuais + join de household sem filtro `status='active'` → membro stale acessa flags de outro. → migration `...110001`.
- **`business_proposal_items`**: política `owner` residual permite inserir item na proposta de outro tenant (write-only). → migration `business_proposals:51`.
- **Editar proposta não reseta `stock_done/revenue_done`** → "estoque baixado/receita lançada" com valor antigo.
- **Keys de lista por índice** em itens editáveis (proposta/ficha técnica) → valor "escorrega" ao remover linha. → `BusinessPropostas`, `BusinessEstoque`.
- **Updates otimistas sem rollback** (mover/excluir lead, notas, excluir proposta) → "fantasmas" se a chamada falhar.
- **Margem vs markup**: duas definições de "margem" na tela de estoque dão preços diferentes pro mesmo %.

---

## P2 — Hardening (não bloqueia)

- `ProtectedRoute`: fetch de perfil sem `.catch` → loader infinito em falha de rede. → `ProtectedRoute.tsx:16`.
- Parser de número BR de um ponto só no Rebalanceamento (usar `parseBRL`).
- Pixel: `Purchase` dispara só por abrir a URL de sucesso (sem validar pagamento) e com `value:0` se faltar o sessionStorage → suja dados de Ads. Corrigir antes de escalar mídia, não antes de lançar.
- `find_user_id_by_email` e cia.: revisar `is_*_member/owner` (defesa em profundidade), rate-limit atômico no `register-trial`, ownership no webhook de assentos.

---

## Plano de correção sugerido (ordem)

1. **SQL (rápido):** constraint `cancelled_grace` (P0-1) + REVOKE/gate nas 5 funções (P0 4–8) + dropar políticas residuais (`despesas_skip`, `business_proposal_items`).
2. **Edge `webhook-stripe`:** cancelamento seta `plan_tier=free`/`full_expires_at`; revogar em `unpaid/canceled`; guarda de price no `updated`; idempotência só após sucesso.
3. **Frontend:** `updateProposal` transacional/checado + reset de flags; `darBaixa` checa erro; keys estáveis; rollback otimista; `ProtectedRoute.catch`.
4. **Rodar `npm run build && npm test` verde no CI.**
5. **Soft launch** (10–30 contas) com Pixel ligado.

Depois de 1–3, o Atlas vai de 6,5 para ~9 e está pronto pra lançar controlado.
