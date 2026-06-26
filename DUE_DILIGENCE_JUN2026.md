# Due Diligence — Atlas (junho/2026)

Auditoria em 4 eixos (segurança, usabilidade, bugs/runtime, fórmulas financeiras), escopo `src/` + `supabase/`. Cada achado foi aberto e confirmado no código — falsos positivos dos passes automáticos foram descartados. Os dois P0 foram verificados pessoalmente.

**Veredito geral:** o sistema está em boa forma. Não há falha crítica de segurança (sem secrets no client, RLS habilitada em todas as tabelas de usuário, webhooks assinados, edge functions com auth). O motor financeiro central (Price/SAC, PMT/FV/PV, regra dos 4%, conversão de taxas, atlasScore) está correto e bate com os testes. Os ajustes mais valiosos são dois números/saves enganosos e um conjunto de hardening de escala e acessibilidade.

---

## P0 — Corrigir já (engana o usuário ou perde dado)

**1. Notificação mostra impacto patrimonial fabricado**
`src/hooks/useSmartNotifications.tsx:302` — `economia * 12 * 20 * 1.5` é exibido como "o impacto patrimonial pode chegar a R$ X". O `× 1.5` é um multiplicador arbitrário (o comentário diz "compounding", mas não há juros compostos). O valor real de R$ economia/mês por 240 meses a ~0,5%/mês é ≈ 2,3–2,5× o principal, não 1,5×. Número financeiro errado numa notificação.
→ Usar `calcFVAnuidade(economia, retornoMensal, 240)` (já existe em `financial_premises.ts`) ou remover o valor.

**2. Proventos salva/exclui sem checar erro → "sucesso" mesmo falhando**
`src/pages/investimentos/Proventos.tsx:184,187,209` — `update`/`insert`/`delete` em `proventos_investimentos` não capturam `error`. O toast "Provento registrado/atualizado" aparece mesmo se a gravação falhar, e o delete é silencioso. O usuário acredita que salvou e perde o dado.
→ `const { error } = await supabase...`; em erro, toast destrutivo e abortar antes do sucesso.

---

## P1 — Importante

**3. IDOR: `import_ofx_batch` não valida posse da conta**
`supabase/migrations/20260417200001_import_ofx_batch.sql` (chamada em `supabase/functions/import-ofx-commit/index.ts:64`) — a função força `user_id = auth.uid()` (bom), mas insere o `p_account_id` vindo do body sem checar que aquela conta pertence ao chamador. Permite carimbar transações próprias com o `account_id` de outro usuário (corrupção cross-user; não é vazamento de leitura).
→ Adicionar no início: `SELECT 1 FROM bank_accounts WHERE id = p_account_id AND user_id = auth.uid()` e `RAISE EXCEPTION` se não pertencer.

**4. Páginas que travam no spinner se uma query falhar**
`src/pages/Aposentadoria.tsx:112-174` e `src/pages/ExpressAposentadoria.tsx` — `setLoading(true)` → `await Promise.all([...])` → `setLoading(false)` na última linha (não em `finally`) e sem `catch`. Qualquer erro deixa a página presa no spinner para sempre + rejeição não tratada.
→ `try/catch/finally` com `setLoading(false)` no `finally`.

**5. `financial-report` chama a IA sem timeout**
`supabase/functions/financial-report/index.ts:233` — usa `fetch()` cru enquanto todas as funções-irmãs usam o wrapper `aiFetch` (`_shared/ai-fetch.ts`) com timeout. Upstream travado trava a request.
→ Trocar por `aiFetch(...)`.

**6. Queries sem `.limit()` em hot-paths e crons sem paginação (escala)**
Client: `src/hooks/useProximosVencimentos.tsx:59` (sem `gte` nem limit no dashboard), `src/hooks/useSmartNotifications.tsx:85,88`, `src/hooks/useAtlasScore.ts:68`. Edge cron fan-outs serial sem paginação: `smart-notifications`, `virada-mes`, `weekly-email`, `billing-notifier`.
→ `.limit()`/janela de data em SQL no client; paginação nos crons.

**7. IPCA possivelmente convertido em dobro (anual→mensal)**
`src/lib/investimentos/rendaFixaAcrual.ts:178-184` — o código nomeia `ipcaAnual` e aplica `anualToMensal(...)`. A série BCB 433 do IPCA é **mensal**. Se `get-macro-data` já devolve IPCA mensal, há dupla conversão e o fator de inflação fica ~12× menor (subestima rendimento de pós-fixados IPCA+).
→ **Verificar primeiro** o retorno de `supabase/functions/get-macro-data`. Se IPCA vier mensal, usar direto; se vier anual, só renomear/documentar. (SELIC está consistente.)

**8. Usabilidade/acessibilidade de uso diário**
- `src/pages/investimentos/Proventos.tsx:638` — tabela sem estado vazio (só cabeçalho quando não há dados).
- `src/pages/renda-despesas/RendaDespesasLayout.tsx:138,149` — botões "mês anterior/próximo" sem `aria-label` (página de altíssimo tráfego).
- Botões só-ícone sem `aria-label` e alvo de toque pequeno (≈28px): `BensImoveis.tsx:77-78`, `AtlasNegocios.tsx:689-690`, `Familia.tsx:386-387`, `CategoryManager.tsx:55`.
- `OnboardingWizard.tsx` — sem botão "voltar"; não dá pra corrigir um campo já preenchido sem recarregar.
- Inputs de formulário (tabs de renda-despesas) sem `label`/`aria-label` — placeholder não substitui label.
→ Adicionar `aria-label`s, estado vazio na tabela, botão "voltar" no onboarding, aumentar alvos para ≥40px.

---

## P2 — Polimento e hardening

**9. `life_projection.ts` — taxa real negativa aproximada errado** (`:69-72`): negar a mensalização do valor absoluto ≠ `(1+r)^(1/12)−1`. Diverge ~1% em 360 meses. → Usar `taxaAnualParaMensal(r)` direto (funciona para qualquer `r > −1`). Só afeta cenário de retorno real negativo.

**10. `life_projection.ts` — saque da aposentadoria usa renda bruta** (`:81-83,111`): saca `rendaMensal` cheia em vez de `rendaMensal − poupancaMensal` (o padrão de vida real é renda menos poupança). Superestima o consumo e drena o patrimônio cedo demais. (A página `Aposentadoria.tsx`, lógica separada de perpetuidade, está correta.)

**11. `viagem.ts` — custo de viagem parcelada ignora juros** (`:30,61`): para prazo >12m, calcula `parcelaMensal` com juros de cartão, mas `impactoTotal = -valorViagem` usa só o principal. → `impactoTotal = parcelaMensal * prazoMeses` quando parcelado longo.

**12. Null-deref pontual** — `src/pages/RelatorioVida.tsx:217` `dep.nome.toLowerCase()` sem guard (nulls são esperados na vizinhança). → `(dep.nome || "")`.

**13. Erros de query engolidos** (UI degrada para vazio em silêncio): `DashboardHome.tsx:151`, `FaturaCardSelector.tsx:33`, `AdvisoryInviteCard.tsx`, `TabBancosExtratos.tsx`. → tratar `error` + `finally`.

**14. HMAC do webhook Stripe não constant-time** — `webhook-stripe/index.ts:43-44` usa `!==`. Risco prático baixíssimo. → comparação byte-a-byte de tamanho fixo.

**15. `fetch()` externos sem timeout/AbortController** — `get-ticker-quote`, `get-macro-data`, `get-ticker-dividends`, `get-fii-reports`, `indicadores-economicos`. → AbortController.

**16. Formatação de moeda sem locale pt-BR** — `AdminSettlement.tsx:104,149` (`.toFixed(2)`), eixos de gráfico em `BensImoveis.tsx:429`, `Analises.tsx:1113`. → formatter compartilhado.

**17. Higiene** — `SETUP.SQL` defasado dentro de `migrations/` (risco de ordem indefinida → mover pra fora); strings sr-only "Close"/"Previous" em inglês (`ui/dialog.tsx:48`, `ui/sheet.tsx:62`); ~50 `update/delete` filtrados só por `id` (adicionar `.eq('user_id', ...)` como 2ª camada); arquivos órfãos não roteados (`FluxoCaixa.tsx`, `PlanejamentoEstrategico.tsx`, `PlanejamentoFinanceiroCurso.tsx`, `EvolucaoPatrimonial.tsx`).

---

## Verificado e CORRETO (confiança)

- **Segurança:** sem secrets hardcoded; sem service_role no browser; RLS em todas as tabelas financeiras/PII com `auth.uid() = user_id` ou membership de household; policies `USING(true)` restritas a `service_role`; webhooks (Stripe, auth-email) assinados; funções admin checam role; tokens de convite single-use; PII redigida com SHA-256; só 3 `dangerouslySetInnerHTML` (todos com escape). LocalStorage só guarda estado de UI.
- **Motor financeiro:** `amortizacao.ts` (Price/SAC), `financial.ts` (FV/PV/PMT), `atlasScore.ts` (pesos somam 1,00, sem divisão por zero), `financial_premises.ts` e os 8 simuladores de decisão batem com os testes em `src/test/`. Divisores sempre protegidos (`Math.max`, guard de taxa). `ResultadoIR.tsx` coerente (FII 20% cotas/dividendo isento; ações 15% swing + disclaimer day trade).
- **Rotas:** todos os `navigate()`/`<Link>` resolvem para rotas reais; redirects de URLs antigas presentes; nenhuma navegação quebrada.
- **Hooks:** regras de hooks respeitadas; `useAuth` e hooks de viewport/privacy com cleanup correto, sem leak.

---

## Funcionalidades sugeridas (a partir do que já existe)

1. **IR sobre vendas realizadas (DARF mensal)** — hoje o "IR estimado" é sobre lucro não realizado. Calcular ganho realizado por venda a partir do histórico, aplicar isenção de R$20.000/mês em ações, compensação de prejuízo acumulado e gerar o valor de DARF do mês. É o que de fato se paga. *(Já ofereci montar isso.)*
2. **Informe de rendimentos anual (export p/ IR)** — consolidar posição em 31/12, proventos recebidos e custo médio por ativo num PDF/planilha pronto pra declaração.
3. **Renda passiva / yield on cost** — meta de dividendos mensais, yield sobre custo por ativo e calendário de proventos (já há agenda parcial em Proventos).
4. **Rebalanceamento de carteira** — definir alocação-alvo por classe e sugerir o próximo aporte pra reequilibrar.
5. **Portabilidade de dados (LGPD)** — exportar/baixar todos os dados do usuário (também reduz risco de conformidade).
6. **Conciliação extrato ↔ lançamentos** — casar transações importadas (OFX) com despesas/receitas registradas, reduzindo duplicidade.
7. **Alertas proativos por push/e-mail** — a infra de notificações já existe; faltam disparos de vencimento e de metas atingidas.

---

### Plano de ação sugerido
Lote rápido (P0 + P1 baratos): #1, #2, #4, #5, #8 — alto impacto, baixo risco. Em seguida #3 (IDOR, precisa de migration SQL + republish) e #7 (verificar `get-macro-data` antes). P2 e features conforme prioridade do produto.
