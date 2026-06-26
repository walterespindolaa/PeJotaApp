# Engines preservadas (regra de ouro)

Nenhuma fórmula ou estrutura de cálculo herdada do Atlas é apagada no PeJota — mesmo quando a tela correspondente sai da navegação (aposentadoria, carteira de investimentos B3/FIIs, jornada gamificada, etc.).

`index.ts` reexporta os motores de cálculo por namespace, sem mover os arquivos originais (para não quebrar imports existentes). Isso dá uma localização canônica para o que é reaproveitável e documenta a intenção.

## Engines preservadas e destino no PeJota

| Engine | Origem | Reaproveitamento em PJ |
|---|---|---|
| `decisionEngine` | `financial_engine/decision_engine` | Simulador de decisão PJ (abrir filial, financiar equipamento, queda de faturamento) |
| `lifeProjection` | `financial_engine/life_projection` | Projeção de caixa no tempo |
| `financialPremises` | `financial_engine/financial_premises` | Premissas dos simuladores |
| `aposentadoria` | `lib/aposentadoria` | Pró-labore / retirada de sócios (futuro) |
| `amortizacao` | `lib/amortizacao` | Simulador de financiamento/consórcio (equipamento, veículo) |
| `atlasScore` | `lib/atlasScore` | Referência para o BusinessHealthScore |
| `computeMonthTotals` | `lib/computeMonthTotals` | Núcleo de totais mensais do fluxo de caixa |
| `parcelaProjector` | `lib/parcelaProjector` | Projeção de parcelas (cartão, financiamentos) |
| `projectRecurring` / `mergeRecurring` | `lib/*` | Recorrências do caixa |
| `rendaFixaAcrual` | `investimentos/rendaFixaAcrual` | Acrual de renda fixa (aplicações da empresa) |

Ao adaptar uma engine para PJ, manter a lógica intacta e só ajustar o contexto (premissas da empresa em vez do indivíduo) e os rótulos.
