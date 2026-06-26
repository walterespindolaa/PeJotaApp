# Backlog Atlas — escopo aberto

Lista viva do que está pendente, em ordem sugerida. Itens marcados ✅ já foram feitos nesta leva.

## Recém-feito
- ✅ Cards de IA (Diagnóstico/Previsão/Detector) seguem o filtro de período do Atlas Negócios.
- ✅ Aniversário do cliente no cadastro + destaque "este mês".
- ✅ Compliance: exclusão de conta self-service, consentimento de termos no cadastro, rodapé legal, disclaimers nas simulações.

## Bugs / ajustes pontuais
- **PDF ainda quebrando** (imagens 2,3,4,6 — "Raio-X Financeiro", "Resumo da Projeção"+gráfico cortados). Confirmar se o último commit `fix(pdf): corte por borda de card (2 níveis)` foi deployado; se sim e ainda quebra, revisar a paginação (provável: card maior que a página caindo no corte forçado; tabela/gráfico). Considerar tabela nativa (jspdf-autotable) e gráfico como imagem com altura controlada.
- **Botão de reload no app** (imagem 1) — o usuário não consegue atualizar a página sem o popup de update do PWA. Adicionar um botão manual de "atualizar" no header. → EM ANDAMENTO.
- Coluna `observacoes` em `business_clients` ficou redundante (já existe `notes`). Pode dropar.

## Atlas Negócios — épico
Visão: servir tanto quem tem **estoque** quanto **prestador de serviço** (ex.: harmonizadora/estética), com forte **relacionamento com cliente**.

> Status: ✅ rotas /funil /estoque /clientes; ✅ aba Clientes (receita/lucro por cliente, detalhe com repasses por função, histórico); ✅ entradas/saídas com produto + baixa de estoque opcional; ✅ filtro único; ✅ funil maior; ✅ Lembretes in-app (aniversário + cliente inativo). **Pendente:** push/e-mail diário de aniversário/inativo (job).

1. **Split de rotas** — `/negocios` (visão geral), `/funil`, `/estoque`, `/clientes`. Layout com seletor de empresa + abas.
2. **Filtro único igual ao Dashboard** (imagem 5) — trocar os chips por um seletor único de período dentro de cada aba.
3. **Funil maior/mais elaborado** — hoje está curto; dar mais altura/conteúdo às colunas.
4. **Entradas/Saídas ligadas ao estoque** — campo "Produto" (usa `product_id`/`quantidade` já migrados). Entrada = produto vendido (checkbox opcional "baixar do estoque", default off pra não duplicar com a venda do Estoque). Saída = compra de estoque (dá entrada).
5. **Aba Clientes completa** — abrir um cliente e ver: dados, **aniversário**, **quanto já gerou de receita** (histórico de compras via transações com `client_id`/`product_id`), total gasto.
   - **Rentabilidade por cliente (rateio de repasses)** — para empresas de serviço/agência: dentro de cada cliente, mostrar Receita − Repasses por função (Design, Copy, Filmmaker…) = **Lucro líquido**. Reaproveita o modelo atual: despesas vinculadas ao `client_id` + a **categoria** como "função". Sem tabela nova. Incluir **card explicativo** (igual ao do estoque) ensinando a vincular a despesa ao cliente e à função pra ver o lucro real por cliente.
6. **Notificações sobre clientes** — menu/seção de alertas: aniversariantes do mês; clientes **inativos** (ex.: sem compra/procedimento há 6/12/36 meses) → lembrete pra reativar. Job diário usando a infra de notificações.

## Atlas Negócios — visão futura (épico 2)
Referências do usuário: `criador-estudio-main (33).zip` (sistema "Cria" — analisar o fluxo de **Cria Post** e **Collabs** como modelo) + planilha de ficha técnica (print).

1. **Onboarding por nicho** — perguntar o segmento e entregar template adequado: gastronomia → ficha técnica + equipamentos; psicologia/serviço → foco em CRM de informações; etc.
2. **Ficha técnica estruturada** — incluir insumos por **lista categorizada** (legumes, verduras, carnes, grãos…), com opção de adicionar; o sistema computa **lista de compras por entrega/prato/cliente**, margem e histórico (quanto comprar pra cada pedido).
3. **Link de envio de proposta** (estilo Cria Post / Collabs) — página pública compartilhável com: pratos/produtos que a pessoa montou (ficha técnica, margem, lista de compras por trás), **media kit/portfólio**, identidade visual (logo + cor escolhida). Serve pra **clientes atuais e prospects/leads**.
4. **Integração** — a proposta liga ao **Kanban de leads** (ao aceitar, vira cliente/fecha), ao **financeiro** e ao **cliente** (o prato já entra vinculado). Fluxo: proposta → lead avança no funil → cliente → lançamentos/estoque/financeiro conectados.

## Funcionalidades na fila (fora do Negócios)
- **Rebalanceamento** de carteira (carteiras-modelo por perfil → personalizado ao ajustar). Confirmado o modelo (sem marca XP).
- **P1 de compliance restante:** export de dados (LGPD), e-mail de falha de pagamento (dunning), e-mail/DPO na política.
- Refino de PDF: tabela nativa (jspdf-autotable) e replicar paginação robusta no relatório de Investimentos.
