# Custo por Conta — Atlas (pente-fino)

> Preços de jun/2026, com fontes. Valores em USD convertidos a ~R$ 5,40/US$.
> Premissa central: a maioria dos custos é **fixa ou compartilhada**. O único que escala de verdade *por conta ativa* é a **IA (Gemini)** — e é barata.

---

## TL;DR

- **Custo marginal por conta ativa/mês: ~R$ 0,60 a R$ 2,70** — dominado pela IA (Gemini). O resto (banco, e-mail, cotações) é praticamente fixo/compartilhado.
- **Custo fixo total: ~R$ 135 a R$ 250/mês** (Supabase + Resend + Brapi quando precisar), independente de ter 10 ou 1.000 usuários — diluído conforme cresce.
- **Por conta PAGANTE, soma o Stripe**: ~R$ 1,00 a R$ 1,50/mês (≈ 4,4% da mensalidade).
- **Margem**: num plano de R$ 15,90–32,90, o custo total por pagante fica em **~R$ 2 a R$ 4,50** → **margem bruta de 80–90%**. Saudável.
- **O maior custo variável NÃO é infra — é tráfego pago (CAC)**. Isso ofusca tudo acima. Detalhe no fim.

---

## 1. IA — Gemini (o único custo que escala por conta)

O Atlas usa **gemini-2.5-flash** (e flash-lite) em: chat, categorização de transações, extração de extratos, e vários relatórios (financeiro, vida financeira, FIIs, advisor).

**Preço:** US$ 0,30 / 1M tokens de entrada · US$ 2,50 / 1M tokens de saída.

Estimativa por conta ativa/mês (premissa: ~50–100 chamadas/mês entre chat, categorização e alguns relatórios; entrada ~3–5k tokens, saída ~1–1,5k tokens por chamada):

| Perfil | Tokens in/mês | Tokens out/mês | Custo IA/mês |
|---|---|---|---|
| Leve (pouco chat, sem relatório) | ~150k | ~50k | ~US$ 0,17 (**R$ 0,90**) |
| Médio (chat + categorização + 1–2 relatórios) | ~400k | ~120k | ~US$ 0,42 (**R$ 2,30**) |
| Pesado (muito relatório/IA) | ~800k | ~250k | ~US$ 0,86 (**R$ 4,60**) |

**Conclusão:** IA por conta = **~R$ 1 a R$ 4,60/mês**, e a maioria fica na faixa **R$ 1–2,50**. Flash é barato; o gargalo de custo seria gerar muitos relatórios longos.
**Alavanca de economia:** usar **flash-lite** (≈3–4× mais barato) onde dá (categorização, tarefas simples), reservando o flash pros relatórios. Cachear/limitar regeneração de relatório.

---

## 2. Banco / Backend — Supabase (Lovable Cloud) — quase tudo FIXO

**Plano Pro: US$ 25/mês (~R$ 135).** Já inclui:
- **100.000 MAU** (usuários ativos) → você só paga MAU **depois de 100 mil usuários** (US$ 0,00325/MAU extra). Irrelevante por anos.
- **250 GB de egress** (rede) + **8 GB de banco** + **100 GB de storage** (logos, extratos, avatares).
- **2 milhões de invocações de Edge Function** + 200 conexões realtime.

**Per-account (só vira custo lá na frente):**
- **Egress:** ~50–200 MB/conta/mês (SPA puxa pouco). 250 GB cobre **~1.250–5.000 contas** sem custo extra. Depois: US$ 0,09/GB → **~R$ 0,05/conta**.
- **Edge Functions:** IA + crons + checkout. ~100 invocações/conta/mês → 2M cobre **~20 mil contas**. Depois, centavos.
- **Storage:** poucos MB/conta. 100 GB = milhares de contas.

**Conclusão:** Supabase é **~R$ 135/mês fixo** até alguns milhares de contas. Por conta: **~R$ 0,05–0,10** só lá na frente. Escala vertical (subir compute) quando o banco apertar — sem reescrever nada.

---

## 3. Cotações — Brapi — custo COMPARTILHADO (não por conta)

A cotação/dividendo de um ticker é **igual pra todos** (cacheável) — então o custo NÃO escala por usuário, e sim por **quantos tickers distintos × frequência de atualização**.

- **Grátis:** 15.000 requisições/mês (pode bastar no início, com cache).
- **Startup: R$ 119,99/mês** (150k req) · **Pro: R$ 139,99/mês** (500k req).

**Conclusão:** custo **fixo** de **R$ 0 → ~R$ 120/mês** quando o volume de tickers pedir. Por conta: **~R$ 0** (se cachear bem). Dica: cachear cotações por alguns minutos no banco em vez de bater na Brapi por usuário.

---

## 4. E-mail — Resend — quase fixo

- **Grátis:** 3.000 e-mails/mês. **Pro: US$ 20/mês (~R$ 108)** = 50.000 e-mails.
- Por conta: e-mail semanal (4/mês) + transacionais (boas-vindas, convite, cobrança) ≈ **~8 e-mails/conta/mês**.
- 3.000 grátis = **~375 contas**; 50k (Pro) = **~6.000 contas**.

**Conclusão:** **R$ 0 até ~375 contas**, depois **~R$ 108/mês fixo** até ~6 mil. Por conta no fim: **~R$ 0,02**. Desprezível.

---

## 5. Hosting / rede — Vercel (ou Lovable)

- Hosting do SPA: tipicamente **US$ 0–20/mês** (Vercel Pro) — custo **fixo**, não por conta. O grosso da "rede" real é o egress do Supabase (item 2).
- **Lovable (a ferramenta de build):** é a assinatura que você paga pra *desenvolver/publicar* — custo seu de operação, não custo *por conta* de runtime.

---

## 6. Pagamentos — Stripe — só nas contas PAGANTES

**Brasil:** ~**3,99%** (cartão nacional) + **0,4%** (adicional de recorrência) ≈ **~4,4%** da mensalidade (+ eventual taxa fixa por transação).

| Plano | Mensalidade | Stripe (~4,4%) |
|---|---|---|
| Essencial | R$ 15,90 | ~R$ 0,70 |
| Pro | R$ 24,90 | ~R$ 1,10 |
| Elite | R$ 32,90 | ~R$ 1,45 |
| Assento extra | R$ 15,90 | ~R$ 0,70 |

**Conclusão:** ~**R$ 0,70–1,45 por pagante/mês** — é % da receita, não um custo que te quebra.

---

## CONSOLIDADO — custo total por conta

| Item | Tipo | Por conta ativa/mês |
|---|---|---|
| IA (Gemini) | Variável | R$ 1,00 – 4,60 (maioria 1–2,50) |
| Supabase (egress/functions) | Variável (só em escala) | ~R$ 0,05 – 0,10 |
| Resend | Quase fixo | ~R$ 0,02 |
| Brapi | Compartilhado | ~R$ 0,00 |
| **Subtotal infra/conta ativa** | | **~R$ 1,10 – 2,70** |
| Stripe (só pagante) | % receita | + R$ 0,70 – 1,45 |
| **Total por conta PAGANTE** | | **~R$ 2 – 4,50** |

**Mais o fixo mensal (diluído):** Supabase ~R$135 + Resend ~R$108 (após 375 contas) + Brapi ~R$120 (quando precisar) ≈ **R$ 135 a ~R$ 365/mês** total.
- A **100 usuários**: fixo ≈ R$ 1,35–3,65/usuário.
- A **1.000 usuários**: ≈ R$ 0,14–0,37/usuário.
- A **10.000**: desprezível.

**Margem:** plano de R$ 15,90 com custo total ~R$ 2–4,50 = **margem bruta ~75–90%**. Excelente pra SaaS.

---

## 7. O custo que REALMENTE pesa: tráfego pago (CAC)

Infra é centavos. O que define seu lucro é o **Custo de Aquisição de Cliente (CAC)** — quanto você gasta em Meta/Google Ads pra trazer 1 pagante. Não dá pra calcular sem seus dados de campanha, mas o modelo é:

```
CAC = (gasto em ads) / (nº de pagantes que vieram dos ads)
LTV = mensalidade × margem(%) × meses de permanência
```

**Regra de ouro:** **LTV ≥ 3× CAC** e idealmente **CAC se paga em < 12 meses**.

Exemplo com seus números (plano Pro R$ 24,90, margem ~85%, retenção 10 meses):
- **LTV ≈ R$ 24,90 × 0,85 × 10 ≈ R$ 212.**
- Logo, **CAC saudável ≈ até R$ 70** (1/3 do LTV); **teto absoluto ~R$ 130** (paga em ~6 meses bruto).

**Onde olhar:** CPM/CPC da campanha, taxa de conversão visitante→trial e trial→pagante. Se o trial→pagante for baixo, o CAC sobe rápido. O assento extra (R$ 15,90 recorrente por usuário convidado) também ajuda a aumentar o LTV por conta sem novo CAC — é expansão de receita "de graça".

---

## Recomendações pra blindar custo

1. **IA:** usar `gemini-2.5-flash-lite` na categorização/extração (mais barato) e reservar o `flash` pros relatórios. Limitar regeneração de relatório (cache por período).
2. **Brapi:** cachear cotações no banco por alguns minutos — corta o custo por usuário e evita subir de plano cedo.
3. **Supabase:** monitorar egress e invocações no painel; subir compute só quando o banco pedir.
4. **Monitorar o real:** ligar o uso de tokens do Gemini e o painel do Supabase — em 30 dias com usuários reais você troca essas estimativas por números exatos.

---

*Fontes de preço: Google Gemini API, Supabase, Brapi, Resend, Stripe Brasil (jun/2026).*
