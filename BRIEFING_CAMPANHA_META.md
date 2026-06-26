# Briefing de Campanha — Atlas no Meta Ads

> Documento de estratégia (sem criativo finalizado — apenas o conceito/ângulo, públicos, estrutura e metas). Base: benchmarks Brasil jun/2026 e a análise de custo/CAC do Atlas.

---

## 1. Objetivo e princípio central

**Objetivo:** adquirir contas **pagantes** no Atlas a um CAC ≤ R$70 (alvo) / ≤ R$130 (teto), sabendo que LTV ≈ R$212 (plano Pro, retenção ~10 meses).

**Princípio que define tudo:** não anunciar "mais um app de finanças pessoais" — aí o Atlas briga com Mobills/Organizze, que têm caixa e CAC alto. **O diferencial vendável é juntar pessoal + PJ num lugar só.** Por isso a largada é nas personas de autônomo/pequeno negócio (1 e 2), onde o Atlas não tem concorrente direto e o CAC é mais barato.

---

## 2. Evento de conversão e funil

O Meta otimiza para o evento que você escolhe. Defina a hierarquia:

| Evento (Pixel/CAPI) | Tipo | Uso |
|---|---|---|
| `Lead` / `CompleteRegistration` (cadastro/trial) | **Macro — otimização principal** | Evento das campanhas de aquisição. É frequente o suficiente pra alimentar o algoritmo. |
| `StartTrial` (ativou o app, 1ª ação real) | Micro | Sinal de qualidade do lead. |
| `Subscribe` / `Purchase` (virou pagante) | Macro — meta de negócio | Mede o CAC real. Volume baixo no início → não otimizar por ele ainda. |

**Regra prática:** otimize por **cadastro/trial** até ter ~30–50 conversões/semana de *pagante*; só então migre a otimização para o evento de compra. Garanta Pixel **+ Conversions API (CAPI)** ligados — sem CAPI server-side, você perde ~20–30% dos eventos no iOS/cookieless.

---

## 3. Arquitetura de campanha (faseada)

### Fase 0 — Pré-lançamento (antes de gastar)
- Pixel + CAPI instalados e testados (evento de cadastro disparando).
- Página de destino dedicada por persona (não a home genérica) — a conversão da LP é o que mais move o CAC.
- Públicos de retargeting já criados (mesmo vazios, começam a encher).

### Fase 1 — Aprendizado (Meses 1–2)
Estrutura enxuta — **não pulverize verba** em muitos conjuntos:

```
Campanha A — Aquisição | Persona 1 (Autônomo PF+PJ)   ← prioridade
  └ Conjunto 1: público de interesse amplo (ver §4)
  └ Conjunto 2: Advantage+ / aberto (deixa o algoritmo achar)
Campanha B — Retargeting (todas as personas juntas)
  └ Visitou LP / iniciou cadastro e não converteu (7–14 dias)
  └ Iniciou trial e não virou pagante
```

- Comece **só com a Persona 1.** Persona 2 entra quando a 1 estabilizar.
- 1 campanha de aquisição + 1 de retargeting. Simples.
- Objetivo da campanha: **Cadastros (Leads)**.

### Fase 2 — Escala (Mês 3+, só se CAC < R$100)
```
Campanha A — Aquisição Persona 1 (escala vertical de verba)
Campanha C — Aquisição Persona 2 (Pequeno negócio c/ estoque)
Campanha B — Retargeting (sempre ligada)
Campanha D — Lookalike 1–3% (base = pagantes via Customer List)  ← só com ~100+ pagantes
```
- Lookalike de **pagantes** (não de cadastros) é o público mais forte — mas precisa de massa (~100+) pra valer.
- Persona 3 (finanças pessoais) só aqui, e ciente de que o CAC é mais alto.

---

## 4. Públicos por persona (a "ideia" do targeting)

> No Meta atual, **público amplo + bom criativo + evento bem configurado** costuma bater segmentação fina. Use os interesses abaixo como *ponto de partida* / teste, não como gaiola. Em escala, migre pra Advantage+ aberto.

### Persona 1 — Autônomo que mistura PF e PJ *(largada)*
- **Quem:** psicólogo, nutricionista, personal, dentista, cabeleireiro, fisioterapeuta, freelancer, prestador de serviço. 25–45.
- **Dor:** mistura o dinheiro pessoal com o do "negócio"; não sabe quanto sobra; faz proposta/cobrança no caderno.
- **Conceito do anúncio (ângulo, não criativo):** *"Pare de misturar seu dinheiro com o do seu negócio."* / *"Quanto sobra de verdade no fim do mês — pra você e pra empresa?"*
- **Interesses/comportamentos Meta:** MEI, Sebrae, "empreendedorismo", "pequenas empresas"; cargos/profissões autônomas; comportamento "administradores de página de pequeno negócio".
- **Objeção a derrubar:** "já uso planilha / app de banco" → mensagem: o Atlas separa PF e PJ automaticamente.

### Persona 2 — Pequeno comércio/serviço com estoque
- **Quem:** loja de roupas, food/lanchonete, papelaria, salão, pet, artesanato. Dono/dona, 28–50.
- **Dor:** não sabe se o produto dá lucro; fluxo de caixa no susto; estoque "na cabeça".
- **Conceito:** *"Descubra se o seu produto dá lucro de verdade."* / *"Estoque, custo e propostas no mesmo lugar."*
- **Interesses Meta:** donos de pequeno negócio, varejo, food service, "gestão de estoque", "empreendedorismo", fornecedores do nicho (ex.: atacado de roupas).
- **Objeção:** "é complicado/caro" → mensagem: feito pra quem não entende de finanças; preço de cafezinho por dia.

### Persona 3 — Organizador pessoal consciente *(só na escala)*
- **Quem:** CLT 25–40 querendo sair da planilha e investir.
- **Dor:** não sabe pra onde vai o dinheiro; quer começar a investir.
- **Conceito:** *"Sua vida financeira inteira num lugar só."*
- **Interesses Meta:** educação financeira, investimentos, Tesouro Direto, Nubank, "renda passiva", finanças pessoais.
- **Atenção:** mercado saturado (Mobills/Organizze) → CAC maior. Validar só depois de 1 e 2.

### Persona 4 — Casal/família que organiza junto *(nicho de apoio)*
- **Quem:** 30–45, usa visão compartilhada.
- **Conceito:** *"As finanças do casal, sem briga."*
- **Interesses Meta:** recém-casados, planejamento familiar, vida a dois.

---

## 5. Verba e pacing

| Fase | Verba/mês | Diária | Distribuição |
|---|---|---|---|
| Aprendizado (M1–2) | **R$1.500–3.000** | R$50–100 | ~70% aquisição P1 · 30% retargeting |
| Escala (M3+) | **R$4.000–8.000** | R$130–270 | 50% P1 · 25% P2 · 15% retargeting · 10% lookalike |

- **Piso de R$50/dia por conjunto** — abaixo disso o algoritmo não sai do aprendizado.
- Some **+12%** no orçamento por causa do novo imposto do Meta (2026).
- Não mexa na campanha nos primeiros **3–5 dias** (fase de aprendizado); deixe sair de ~50 conversões antes de julgar.

---

## 6. Metas e gatilhos de decução

| Métrica | Saudável | Ação se ruim |
|---|---|---|
| CPC | R$2–3 | acima de R$4 → criativo/segmentação fracos |
| Custo por cadastro | R$15–30 | acima de R$40 → revisar LP e oferta |
| Conversão LP → cadastro | 8–15% | abaixo de 5% → a LP é o gargalo, não o anúncio |
| Cadastro → pagante (trial) | 15–25% | abaixo de 10% → problema de ativação/onboarding, não de mídia |
| **CAC (pagante)** | **≤ R$70** (teto R$130) | acima → cortar público pior, dobrar no melhor |

**Regra de ouro:** se o CAC estourar, o problema raramente é "subir mais verba" — é a **conversão da LP** ou o **trial→pago**. Olhe o funil antes de mexer no lance.

---

## 7. Roteiro de testes (1 variável por vez)

1. **Semanas 1–3:** Persona 1, 2–3 ângulos diferentes (mesma oferta), público amplo. Mata os ângulos ruins.
2. **Semanas 4–6:** melhor ângulo + teste de **LP** (headline/oferta). A LP move mais o CAC que o anúncio.
3. **Semanas 7+:** liga Persona 2; testa retargeting com prova social (depoimento de cliente real).
4. **Mês 3:** com ~100 pagantes, sobe Lookalike de pagantes.

---

## 8. Resumo de uma linha

Comece **pequeno e focado**: R$50–70/dia, **só na Persona 1** (autônomo que mistura PF e PJ — onde o Atlas é único), otimizando por **cadastro**, com Pixel+CAPI e uma **LP dedicada**. Escale só o que provar CAC < R$100. O relógio do crescimento é o LTV:CAC — e o painel "Uso & Custos" cuida do outro lado (o custo de servir).

---

*Benchmarks: CPM Meta Brasil R$8–45 (finanças/SaaS acima da média), +12% imposto 2026, CPC ~US$1,72. Fontes: Trafius, Upsend (jun/2026).*
