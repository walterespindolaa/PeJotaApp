# Plano — Propostas no Atlas Negócios (épico 2)

Baseado no fluxo já existente do **Cria** (Collabs / proposta pública). Reaproveitamos o mesmo padrão, adaptado pra Atlas Negócios (estoque + serviço + relacionamento com cliente).

## Padrão do Cria (referência analisada)
- Kanban (`collabs`) + campos de proposta: `proposal_token` (link), `proposal_status` (none/enviada/vista/aceita/recusada/ajuste), `proposal_terms`, `proposal_valid_until`, timestamps, `proposal_client_comment`. Itens em `collab_deliverables` (label, format, valor, ordem).
- **RPCs públicas por token (anon)**: `get_proposal_by_token` (lê + marca "vista"), `accept_proposal_by_token` (marca aceita **e move o card pra "fechado"**), `reject_proposal_by_token`, `request_proposal_change_by_token(comment)`.
- Página `/proposta/:token`: branding (avatar + cor `theme_accent`), itens com valor, **media kit (PDF)**, termos, total, ações Aceitar/Recusar/Ajustar.

## Desenho no Atlas Negócios

### 1. Schema (migration)
- **`business_leads`** (já é o funil) ganha: `proposal_token text`, `proposal_status text default 'none'` (check none/enviada/vista/aceita/recusada/ajuste), `proposal_terms text`, `proposal_valid_until date`, `proposal_sent_at/viewed_at/responded_at timestamptz`, `proposal_client_comment text`. Índice único no token.
- **`business_proposal_items`** (novo): `id, user_id, company_id, lead_id, product_id (opcional, puxa do estoque), label, descricao, valor numeric, quantidade numeric, sort_order`. RLS por `user_id`. (Para gastronomia = pratos/produtos com ficha técnica por trás; para serviço = serviços.)
- **`business_companies`** ganha branding: `logo_url text`, `brand_color text`, `media_kit_url text` (PDF/portfólio), `pix_key text` (opcional).

### 2. RPCs públicas (anon, security definer) — espelham o Cria
- `get_business_proposal(_token)` → lê a proposta (empresa, branding, itens, total, termos, validade), marca `vista` no 1º acesso.
- `accept_business_proposal(_token)` → `aceita` + move o lead pra **`ganho`** se estiver em estágio inicial.
- `reject_business_proposal(_token, _motivo)` e `request_business_proposal_change(_token, _comment)`.

### 3. Página pública `/proposta/:token` (`PropostaNegocioPublica`)
- Aplica `brand_color` da empresa, mostra **logo**, nome da empresa.
- Lista os **itens** (pratos/produtos/serviços) com valor + total.
- **Media kit / portfólio** (link do PDF) — "como se fosse o portfólio da pessoa".
- Termos + validade. Botões **Aceitar / Recusar / Solicitar ajuste**.
- Sem login (token), igual `/proposta/:token` do Cria.

### 4. Montar a proposta (dentro do lead, no funil)
- No detalhe do lead: aba/botão "Proposta" → escolher itens (puxar produtos do **Estoque** com preço, ou adicionar livre), termos, validade → gerar **link** (`proposal_token`) → copiar/enviar.
- Status da proposta visível no card do funil (enviada/vista/aceita…).

### 5. Integração (o ciclo completo)
Proposta enviada → lead **vista** → **aceita** ⇒ card vai pra **ganho** ⇒ vira **cliente** ⇒ os itens (pratos) já entram vinculados (ficha técnica, margem, lista de compras) ⇒ refletem no **Financeiro** e no **Estoque**. Serve pra **clientes atuais e prospects/leads**.

## Onboarding por nicho (épico 2)
- No 1º acesso do Atlas Negócios: perguntar o **segmento** → entregar template adequado:
  - **Gastronomia:** ficha técnica + equipamentos + lista de compras categorizada.
  - **Serviço/Psicologia/Estética:** foco em **CRM** (cliente, histórico, aniversário, recorrência) + proposta de serviços.
- Guardar o nicho na empresa pra ajustar labels/blocos exibidos.

## Ficha técnica categorizada (épico 2)
- Insumos com **categoria** (legumes, verduras, carnes, grãos, embalagem…). Lista pronta + opção de adicionar.
- Sistema computa **lista de compras por entrega/prato/cliente**, margem e **histórico** (quanto comprar por pedido). Conecta com a proposta (itens) e o estoque (baixa).

## Ordem de construção sugerida
1. Branding da empresa (logo + cor) — base visual da proposta.
2. Schema (migration) dos campos de proposta + `business_proposal_items`.
3. RPCs públicas por token.
4. Montagem da proposta no lead (escolher itens do estoque + termos) + status no card.
5. Página pública `/proposta/:token` com branding + aceitar/recusar/ajustar + integração (aceitar → ganho).
6. Ficha técnica categorizada + lista de compras.
7. Onboarding por nicho.
