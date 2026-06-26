# Atlas Negócios — Auditoria + Roteiro (Funil + Estoque)

Data: 2026-06-21 · Escopo: `src/pages/AtlasNegocios.tsx` + `src/components/negocios/*` + `useCompanies`.

---

## Parte 1 — Auditoria dos cards (o que ajustar AGORA, contido e seguro)

A maioria dos cards reage bem aos dados. Os ajustes de maior impacto:

**Layout / clareza**
- **Unir os dois cards de recorrência** ("Receita Prevista" + "Receita Confirmada") — hoje são irmãos redundantes e não deixam clara a diferença (previsto x confirmado). Virar 1 card "Recorrências do Mês" com duas linhas. (AtlasNegocios.tsx:573–597)
- **Reduzir redundância dos KPIs** — Resumo (Receita/Despesa/Lucro/Margem) + "Extra KPIs" (Lucro Líquido/Margem Op./Custo %) repetem Lucro e Margem. Unir ou colapsar os extras. (AtlasNegocios.tsx:543–571 + BusinessExtraKPIs)
- **Filtro de período no mobile** — hoje são chips com scroll horizontal (difícil de ver). No celular, virar um `<Select>`. (AtlasNegocios.tsx:468–540)
- **Regras de alocação sem estado vazio** — quando não há regra, o card some; a pessoa não descobre. Adicionar texto + CTA "Defina provisões (ex: 15% impostos)". (AllocationRulesCard)
- **Agrupar os "Diagnósticos" do rodapé** (DiagnósticoAtlas, PrevisãoCaixa, DetectorProblemas, etc.) numa seção recolhível — hoje parecem "coisas soltas" empilhadas. (AtlasNegocios.tsx:770–801)

**Bugs encontrados (priorizados)**
- **P1 — Entrada de moeda quebra ao colar "1.234,56"** (formato pt-BR): vira 123.456,00 (12× maior). Erro de dado sério. (AtlasNegocios.tsx:~162)
- **P1 — "Planejado vs Real" mostra Real = R$ 0** quando as regras não têm categorias vinculadas → a pessoa pensa que não gastou. Mostrar aviso "vincule categorias". (BusinessChartsSection)
- **P1 — Simulador de caixa** assume "caixa atual = lucro × 3" (multiplicador fixo, sem explicação) → projeção pode ficar irreal. Rever a premissa. (CashFlowSimulator:~26)
- **P2 — Imposto estimado fixo em 15%** sem aviso de que é uma referência. (BusinessInsights:~101)
- **P2 — "Projeção do Mês" some no dia 1** (guard `dia < 2`). (AtlasNegocios.tsx:~253)
- **P2 — Excluir lançamento com contraparte PF** é frágil (casa por texto da descrição; some se o usuário editou). (AtlasNegocios.tsx:~358)
- **P2 — Confirmar recorrência** tem corrida (clique duplo pode duplicar). (BusinessRecurringPending)

---

## Parte 2 — Funil de Leads/Prospects (Kanban) — pós-lançamento

**Objetivo:** acompanhar o cliente ANTES de virar receita; ver pipeline e valor em negociação.

**UX**
- Nova aba "Funil" dentro do Atlas Negócios.
- Colunas: **Lead → Contato → Proposta → Negociação → Fechado (ganho)** + "Perdido".
- Cards arrastáveis no **toque e no mouse** (lib `@dnd-kit` — feita para mobile, acessível). No mobile, além de arrastar, um menu "mover para" como alternativa.
- Card: nome, contato (telefone/email), valor da proposta, produto/serviço, origem, próximo passo + data, notas.
- Topo: total em negociação (R$), nº por estágio, taxa de conversão.

**Dados (1 tabela nova)**
`business_leads`: id, company_id, user_id, nome, contato, valor_proposta, estagio, origem, proximo_passo, data_proximo_passo, notas, created_at, updated_at. RLS por user_id. Índice em (company_id, estagio).

**Integração:** ao marcar "Fechado (ganho)", oferecer criar o cliente/receita (ou uma conta a receber) no financeiro — fechando o ciclo funil → caixa.

**Esforço:** médio. 1 migração + 1 aba + dnd. Sem risco para o resto do app.

---

## Parte 3 — Controle de Estoque + Ficha Técnica + Precificação — pós-lançamento

**Objetivo:** controlar insumos, saber o custo real do produto e quanto dá pra produzir.

**Conceito-chave (o seu exemplo):** ficha técnica = receita. "1 macarrão usa 300g de farinha". Ao vender N macarrões, baixa N×300g de farinha do estoque.

**UX**
- Aba "Estoque": lista de **insumos** (matéria-prima) e **produtos finais**, com unidade, custo e saldo atual; badge de "estoque baixo".
- Tela do produto: **ficha técnica** (lista de insumos + quantidade por unidade).
- **Movimentações**: entrada (compra) e saída (venda/perda/ajuste). Venda baixa os insumos pela ficha técnica.
- Indicadores: **CMV** (custo da mercadoria vendida), **margem real por produto**, "com o estoque atual dá pra fabricar X de cada produto", alerta de reposição.

**Dados (3 tabelas novas)**
- `business_inventory_items`: id, company_id, user_id, nome, tipo (insumo|produto), unidade, custo_unitario, saldo, estoque_minimo.
- `business_recipes`: id, produto_id, insumo_id, quantidade. (ficha técnica)
- `business_stock_movements`: id, item_id, tipo (entrada|saida|ajuste), quantidade, custo, motivo, ref (venda), created_at.

**Precificação (encaixa aqui):** calcula o preço de venda sugerido = custo da ficha técnica + margem desejada. Liga estoque ↔ preço ↔ lucro real.

**Esforço:** maior. 3 tabelas + lógica de baixa na venda. Construir com paginação/limites para não pesar.

---

## Parte 4 — Outras ideias de fluxo PJ (eficazes, sem travar)
- **Contas a receber** (espelho das dívidas, do lado de quem te paga) — fecha o ciclo com o Funil.
- **DRE simplificado mensal** e **metas de vendas** — relatórios sobre o que já existe.
- **Clientes/recorrência (LTV)** — quanto cada cliente já trouxe.

---

## Sequência recomendada
1. **Agora (pré-lançamento):** ajustes contidos da Parte 1 (unir recorrências, filtro mobile, estado vazio das regras) + bugs P1 (moeda colada, Planejado vs Real, premissa do simulador).
2. **Pós-lançamento, Fase 1:** Funil (Kanban).
3. **Pós-lançamento, Fase 2:** Estoque + ficha técnica + precificação.
4. **Depois:** contas a receber, DRE, metas.
