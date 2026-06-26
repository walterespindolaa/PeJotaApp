# Auditoria de Performance e Escala — Atlas

> Revisão de Dev Senior, código por código, validada com leitura direta do repo.
> Stack: Vite + React (SPA) na Vercel · Supabase (Postgres + RLS) · Edge Functions (Deno) · React Query.

---

## Veredito

**O Atlas escala.** A arquitetura é multi-tenant e *per-user*: cada pessoa carrega só os próprios dados (filtrados por `user_id`/`company_id`) e o processamento pesado roda no navegador dela ou em funções serverless que auto-escalam. Não existe uma "conta global" que trava pra todo mundo junto. 10, 100 ou 1000 usuários = 1000 cargas pequenas e independentes — Postgres + serverless engolem isso bem. **Não vai cair o sistema por volume de usuários.**

O que causa lentidão **não é o número de usuários, são padrões de query**: falta de índice em coluna quente, query sem limite em tabela que cresce, e um cron que dispara muitas queries por usuário. Tudo isso é correção barata e localizada. Abaixo, ponto por ponto, com prioridade.

Resumo da nota: **Frontend: bom. Banco/índices: precisa de uma rodada de índices (P0). Crons: precisam de hardening antes de escala grande (P1).**

---

## P0 — Antes de empurrar tráfego (barato, alto impacto)

### 1. Índice faltando em `business_transactions(company_id, date)` — o mais importante
A consulta mais quente do Atlas Negócios (`AtlasNegocios.tsx:206`) é:
```
from("business_transactions").select("*").eq("company_id", X).order("date", desc)
```
Hoje existe índice só em `client_id` (`20260406222255...sql:6`). **Não há índice em `(company_id, date)`.** Sem ele, toda abertura do Financeiro de uma empresa com histórico vira *sequential scan* + sort. É o gargalo nº 1 em escala.
**Fix:** `create index on business_transactions (company_id, date desc);`

### 2. `business_transactions` sem `.limit()` nem filtro de período
Mesma query (`AtlasNegocios.tsx:206`): traz **todas** as transações da empresa, sempre. Uma empresa com 2–3 anos de lançamentos baixa tudo a cada load.
**Fix:** carregar por período (o filtro "Este mês" já existe na UI) e/ou `.limit(2000)` + paginação. Combinar com o índice do item 1.

### 3. `business_recurring_templates` e `business_recurring_instances` — **zero índices**
Confirmado: criadas sem nenhum índice. As queries filtram por `company_id` (+ `month_ref`/`status`). Sem índice = seq scan desde o dia 1.
**Fix:** `create index on business_recurring_templates (company_id, active);` e `create index on business_recurring_instances (company_id, month_ref);`

### 4. `business_clients` sem `.limit()` no fetch do AtlasNegocios
`AtlasNegocios.tsx:213` faz `.eq("company_id").eq("active", true).order("name")` **sem limite**. (O fetch em `BusinessClientes.tsx:69` já tem `.limit(1000)` — só este ponto ficou sem.)
**Fix:** `.limit(1000)` (consistente com os outros).

### 5. RLS de household sem índice de suporte
As políticas de `companies`, `business_transactions`, `business_categories`, `allocation_rules` (`20260406000002...sql`) fazem **3 JOINs** em `household_members`/`households`/`companies` **por linha**, e **não há índice em `household_members(household_id, status, role)`**. Em tabela grande, é o pior caso de RLS lenta.
**Fix:** `create index on household_members (household_id, status, role);` (e conferir `household_members(user_id)`).

---

## P1 — Antes de escala grande (centenas+ de usuários ativos)

### 6. Índices de `company_id` faltando nas tabelas de Negócios (suporte à RLS de membros)
As políticas novas `members access ...` usam `is_company_member(company_id)` **por linha**. Várias tabelas só têm índice por `client_id`/`item_id`/`produto_id`, não por `company_id`:
- `business_stock_movements` → tem só `(item_id)`. Falta `(company_id, created_at desc)`.
- `business_client_notes` → tem só `(client_id, created_at)`. Falta `(company_id)`.
- `business_client_tasks` → tem só `(client_id, done, due_date)`. Falta `(company_id)`.
- `business_recipes` → tem só `(produto_id)`. Falta `(company_id)`.
- `business_inventory_items` → tem `(company_id, tipo)` ✓ ok.
- `business_proposals` → tem `(company_id, status)` ✓ ok.

**Fix:** criar os `(company_id)` faltantes. Como a RLS de membro filtra por `company_id` em quase tudo, esses índices ajudam **leitura + política** ao mesmo tempo.

### 7. Cron `smart-notifications` — fan-out de 11 queries por usuário
`smart-notifications/index.ts:~1076` roda **~11 SELECTs por usuário** com push ativo, dentro de `Promise.all`, e várias queries de `receitas`/`despesas` **sem `.limit()`**. Com 10k usuários = ~110k queries numa execução → risco de timeout (limite ~30–60s da função).
**Fix (quando crescer):** agregar no banco (uma RPC que retorna `SUM/COUNT` por usuário em 1 query) em vez de puxar linhas e reduzir em memória; e limitar/escopar as queries históricas.

### 8. `virada-mes` — loop sequencial + selects sem limite
`virada-mes/index.ts` processa usuários **um a um** (não paraleliza) e os SELECTs de `despesas`/`receitas`/parcelas em `replicarMes()` não têm `.limit()`. Risco de timeout em volume.
**Fix:** paralelizar em lotes (`Promise.all` em chunks) e limitar os selects.

### 9. `weekly-email` e `billing-notifier` — N+1 de `auth.admin.getUserById()`
Ambos fazem **uma chamada de auth por usuário** dentro do loop (500 por página). Auth API pode rate-limit/timeout. O `billing-notifier` ainda faz `audit_logs.contains(payload, …)` (busca JSONB **sem índice**) por notificação.
**Fix:** buscar e-mails em lote (`listUsers` paginado e mapear) em vez de 1 chamada por usuário; índice de expressão em `audit_logs((payload->>'type'),(payload->>'date'))` se mantiver o `contains`.

### 10. Investimentos — queries por usuário sem `.limit()`
`InvestimentosContext.tsx:172–178`: `investimentos_financeiros`, `aportes_investimentos`, `proventos_investimentos`, `portfolio_transactions` — todas `.eq("user_id")` **sem `.limit()`**. Risco médio (escopo por usuário), mas histórico de aportes/proventos/transações cresce no tempo.
**Fix:** `.limit()` defensivo (ex: 1000) + ordenar por data desc.

### 11. `business_proposal_items` via `.in("proposal_id", ids)`
`BusinessPropostas.tsx:40` busca itens de **todas** as propostas com `.in(ids)`. Como `business_proposals` já vem com `.limit(500)`, o `.in` tem no máx ~500 ids — aceitável hoje, mas se o limite de propostas subir, vira gargalo.
**Fix:** manter o limite de propostas baixo OU buscar itens só da proposta expandida (lazy), não de todas.

### 12. `data-retention-cleanup` — select sem limite
`data-retention-cleanup/index.ts:~68` faz `.lt("created_at", 24m).not(file_path is null)` **sem `.limit()`**; pode selecionar muitos statements antigos de uma vez.
**Fix:** processar em lotes com `.limit()`.

---

## P2 — Boas práticas / operacional (não bloqueia)

- **React Query**: configurar `staleTime`/`gcTime` sensatos pra evitar refetch agressivo (reduz carga no Supabase). Conferir o `QueryClient` default.
- **Tier do Supabase**: escala vertical. Lá pros 500–1000 ativos, subir compute (CPU/conexões) — sem reescrever nada. O pooler (pgBouncer) já cobre conexões.
- **Monitoramento**: ligar `pg_stat_statements` / o "Query Performance" + "Advisor" do Supabase pra ver query lenta *antes* de virar problema. Rodar `EXPLAIN ANALYZE` nas queries quentes (transactions por company_id/date, recurring por status).
- **`business_categories` / `allocation_rules`** no AtlasNegocios: sem `.limit()`, mas naturalmente pequenas (dezenas por empresa) — baixo risco, opcional limitar.
- **Não confirmado (agente falhou):** uma varredura de N+1 no frontend (fetch de detalhes por item dentro de loop). Pelo que li, os padrões usam `.in()`/agregação — sem N+1 grave aparente, mas vale uma passada dedicada.

---

## Plano de ação recomendado (ordem)

1. **Migração de índices (P0 + P1)** — 1 migration só, ~10 `create index`. Barata, sem risco, maior ganho. (transactions company_id+date, recurring, stock_movements, client_notes/tasks, recipes, household_members.)
2. **Limites de query (P0)** — `.limit()` em transactions/clients do AtlasNegocios e nas queries de Investimentos; transactions por período.
3. **Hardening dos crons (P1)** — quando passar de ~algumas centenas de usuários: agregar `smart-notifications` no banco, paralelizar `virada-mes`, batch de auth no `weekly-email`/`billing-notifier`.
4. **Operacional (P2)** — ligar monitoramento de query lenta e revisar tier do Supabase conforme cresce.

> Nada aqui exige reescrever a arquitetura. São ajustes cirúrgicos. Feitos os índices (passo 1) e os limites (passo 2), o Atlas está pronto pra escalar com folga.
