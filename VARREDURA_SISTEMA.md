# Varredura do Sistema — Atlas (pré-lançamento)

Data: 2026-06-19 · Escopo: `src/` + `supabase/functions/` do app principal.
Complementa o `AUDITORIA_PRE_LANCAMENTO.md` (não repete itens já corrigidos lá).
Legenda: **P0** = bloqueia / quebra · **P1** = impacto perceptível · **P2** = polimento/dívida.

Cada achado tem `arquivo:linha` para conferência. Itens marcados **(confirmado)** eu validei lendo o código; os demais vêm da varredura e devem ser conferidos ao aplicar a correção.

---

## 1. Quebras / risco de build — ✅ LIMPO

Varredura de imports, exports, rotas, JSX e `.map`/`.length` em valores nuláveis.
- `EmojiIcon.tsx` e os 11 arquivos que o importam compilam; todos os nomes de ícone usados existem no `lucide-react`.
- Rotas: toda navegação (`Link to` / `navigate()`) tem `<Route>` correspondente em `App.tsx`. Nenhum link interno quebrado.
- Sem imports/exports faltando, sem JSX malformado, sem `JSON.parse` sem try/catch em caminho de produção.

**Veredito:** o build deve compilar. Ainda assim, rode `npm run build` localmente — é a 1ª vez que o `EmojiIcon` entra na árvore.

---

## 2. Segurança — ✅ SEM NOVOS RISCOS

Sem secrets hardcoded (só a anon key, esperada). Queries do front escopadas por `user_id`. Edge Functions com auth/CORS/validação. Sem XSS (`dangerouslySetInnerHTML`/`eval`). Admin verificado no servidor.

Continuam **abertos** (dívida P2 já listada no audit anterior — não bloqueiam o lançamento):
- `confirm-password-reset` não é atômico (race) — `supabase/functions/confirm-password-reset`.
- `send-email` grava e-mail em texto puro em `audit_logs` — considerar hash.
- Rate-limiter falha "aberto" (`rate-limit.ts`) — deixar "fail-closed".
- RLS de `admin_recados` usa `true` na leitura — restringir a admin.

**Veredito:** seguro para lançar; os P2 acima são higiene pós-lançamento.

---

## 3. Performance / escala — ⚠️ PRINCIPAL FOCO ("travar com muito acesso")

O que mais pesa para o app "travar" é re-render global + queries sem limite. Backend concorrente (muitos usuários ao mesmo tempo) fica por conta do Supabase/RLS; o risco no nosso código é egressar linhas demais por usuário.

### P0 — Context value sem memoização → re-render do app inteiro
Cada provider envolve a árvore toda; como o `value` é um objeto literal recriado a cada render, **qualquer** mudança de estado no provider re-renderiza todos os consumidores.
- **(confirmado)** `src/contexts/HouseholdViewContext.tsx:184` — `value={{...}}` inline + `labels` recriado em `:176`. Trocar de visão (Pessoa 1/2/Casal) re-renderiza tudo.
- **(confirmado)** `src/contexts/I18nContext.tsx:130` — `value={{...}}` inline (envolve o app inteiro).
- `src/contexts/InvestimentosContext.tsx:~476` — `value` com 30+ campos, não memoizado.
- `src/hooks/usePrivacyMode.tsx:~30` — `value={{ isPrivate, toggle }}` não memoizado.
- **Correção:** `const value = useMemo(() => ({...}), [deps])` em cada um. Maior ganho de fluidez do app por menor esforço.

### P0 — Queries sem `.limit()` (`select("*")`) em tabelas que crescem por usuário
Usuário com muitos registros carrega a tabela inteira no navegador.
- **(confirmado)** `src/pages/DashboardHome.tsx:236-237` — `investimentos_financeiros` e `investimentos_nao_financeiros` com `select("*")` sem limite (as demais queries do mesmo bloco já selecionam colunas específicas — inconsistente).
- `src/pages/BensImoveis.tsx:~140`, `src/pages/EvolucaoPatrimonial.tsx:~22-23` — mesmo padrão.
- Admin: `src/pages/AdminLeads.tsx:~56`, `src/pages/AdminIndicadores.tsx:~26` — `select("*")` sem limite.
- **Correção:** selecionar só as colunas usadas e adicionar `.limit()`/paginação. (Para finanças pessoais 500+ ativos é raro, mas admin e patrimônio podem crescer.)

### P1 — Verificar limpeza de timers
- `src/components/PWAUpdateBanner.tsx:~15` — `setInterval` de checagem de update; confirmar `clearInterval` no cleanup.
- Observação: `AssistantNudge.tsx` foi sinalizado pela varredura como vazamento, mas **está correto** (cleanup limpa o interval em `:75`) — descartado.

### P1 — Link externo sem `noopener`
- `src/components/AtlasChatFAB.tsx:~259` — `rel="noreferrer"` → trocar por `rel="noopener noreferrer"`.

### ✅ Bom (não mexer)
- Todas as páginas usam `lazy()` em `App.tsx`; libs pesadas (jsPDF, html2canvas, XLSX, emoji-picker) são `import()` dinâmico só no uso. `manualChunks` no `vite.config.ts` ok.
- Links internos e externos conferidos: sem rota quebrada, sem URL placeholder/morta; demais links externos já têm `rel` correto.

---

## 4. Usabilidade — alguns ajustes antes do lançamento

### P0 / alto
- **Mobile — tabela com 8 colunas estoura** em telas <640px: `src/pages/TabelaGeral.tsx:~241`. Colapsar para 3-4 colunas ou layout de card no mobile.
- **Erro silencioso no Dashboard:** `src/pages/DashboardHome.tsx` — o `catch` loga mas não dá toast; usuário vê tela em branco antes do card de erro. Adicionar toast destrutivo no catch.
- **Acessibilidade — botões só com ícone sem `aria-label`:** ex. `src/pages/Familia.tsx:~547` (reenviar/remover) e botões de fechar de diálogos. Adicionar `aria-label`.
- **Validação inline no /comece:** `src/pages/Comece.tsx:~116` — senha <8 só aparece em toast; desabilitar o botão e mostrar ajuda inline abaixo do campo. Garantir que Enter não submeta enquanto `loading`.

### P1
- **Onboarding avança sem validar renda:** `src/components/onboarding/OnboardingWizard.tsx:~298` — `continueRenda()` salva mesmo com valor 0 (save silencioso). Validar `parseBRL(valor) > 0` antes de avançar.
- **i18n — string fixa em pt-BR:** `src/pages/investimentos/VisaoGeral.tsx:~880` (texto de lista vazia) não passa pelo dicionário; usuário em en/es vê português. Conferir outras telas secundárias.
- **Selects com largura fixa** (`w-[180px]`) cortam rótulos longos e desalinham no mobile: ex. `src/pages/Projecoes.tsx:~89`.
- **Spinners genéricos em vez de skeleton** em Metas/ImportOFX — trocar por skeleton com layout.

---

## Ordem sugerida de correção
1. **P0 performance** (memoizar os 4 contexts + `.limit()`/colunas nas queries `select("*")`) — maior impacto no "travamento".
2. **P0 usabilidade** (toast de erro no Dashboard, tabela mobile, aria-labels, validação /comece).
3. **P1** (timer do PWA, `noopener`, validação do onboarding, i18n, selects).
4. **P2 segurança** (dívida do audit anterior) pós-lançamento.

Build e segurança estão verdes; o trabalho real está em performance (re-render/queries) e em alguns acabamentos de UX.
