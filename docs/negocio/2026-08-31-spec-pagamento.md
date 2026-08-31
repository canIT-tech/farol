# Spec de pagamento — Farol MVP

- **Status:** rascunho para implementação (revisar antes de abrir PR)
- **Data:** 2026-08-31
- **Dono (produto):** felippe · **Implementação (tech):** rafinha
- **Destrava:** `PaymentModule` no `apps/api` + gate de crédito no fluxo de roteiro
- **Depende de:** cadastro na Stripe (frente 3 do checklist de pré-lançamento)
- **Relacionado:** `PRD.md` (monetização per-trip), `docs/negocio/custo-e-pricing.html`,
  `docs/lancamento/2026-08-31-checklist-pre-lancamento.md`

---

## 1. Escopo

MVP monetiza **por viagem**, não por assinatura. O usuário compra **créditos**;
cada crédito destrava **um roteiro completo** de uma viagem no modo assessor.

**Dentro do escopo:**
- Compra avulsa (1 crédito) e pacote (3 créditos) via **Stripe Checkout hospedado**.
- Carteira de créditos por usuário (ledger append-only).
- Webhook idempotente que credita/estorna.
- Gate de crédito no disparo do roteiro.
- Reembolso dentro do direito de arrependimento (CDC art. 49).

**Fora do escopo (fase posterior):**
- Assinatura premium recorrente (v1).
- Markup B2B / proposta de agência (v2).
- Pagamento em milhas.
- Cupons e promoções (o ledger já prevê o tipo `grant_promo`, mas sem UI nem endpoint).
- Multi-moeda — **BRL apenas**.

---

## 2. Decisões de produto (travadas)

| Decisão | Escolha | Nota |
|---|---|---|
| Unidade cobrada | **Crédito na conta** | avulso = 1 · pacote = 3. Casa com o pacote de 3. |
| Conta no checkout | **Conta primeiro** | precisa estar logado (Supabase Auth) para pagar. |
| Expiração do crédito | **Não expira** | melhor percepção; passivo contábil aceito no MVP. |
| Gateway | **Stripe** | fallback Mercado Pago / Pagar.me via interface de provider (não implementado no MVP). |
| Quando o crédito é consumido | **No disparo do 1º roteiro da viagem** (`itinerary.generate` no modo assessor) | ver §5. Descoberta/ranking não consome. |
| Trocas por chat na mesma viagem | **Não recobram** | "ajustar tudo por conversa" faz parte do roteiro já pago. |

### Preços (confirmar número final com o time)

| Produto | Créditos | Preço | `id` interno |
|---|---|---|---|
| Avulso | 1 | **R$ 39,00** | `single` |
| Pacote | 3 | **R$ 89,00** | `pack3` |

### Grátis vs pago

| Recurso | Grátis (0 crédito) | Pago (1 crédito / viagem) |
|---|---|---|
| Modo | **autônomo** — entrada mínima → 1 plano fechado | **assessor** — completo |
| Descoberta de destino | não (destino é decidido pelo Farol) | sim, com seletor e múltiplas opções |
| Roteiro dia a dia | sim, 1 plano | sim |
| Chat de ajuste | não | sim, ilimitado naquela viagem |
| Voo & hotel (deep-link) | sim | sim |
| Quantidade | **1 viagem no total** (`users.free_autonomous_used_at`) | 1 viagem por crédito |

---

## 3. Modelo de dados (migration `0006`)

### `orders` — uma linha por tentativa de compra

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL → `users.id` | |
| `provider` | `text` NOT NULL | `'stripe'` |
| `provider_session_id` | `text` NOT NULL | id da Checkout Session |
| `provider_payment_intent` | `text` NULL | preenchido no webhook |
| `product` | `text` NOT NULL | `'single'` \| `'pack3'` |
| `credits` | `integer` NOT NULL | `1` \| `3` |
| `amount_cents` | `integer` NOT NULL | `3900` \| `8900` |
| `currency` | `text` NOT NULL | `'brl'` |
| `status` | `text` NOT NULL | `'pending'` \| `'paid'` \| `'refunded'` \| `'partially_refunded'` \| `'expired'` \| `'failed'` |
| `created_at` | `timestamptz` NOT NULL default now | |
| `paid_at` / `refunded_at` | `timestamptz` NULL | |

- `UNIQUE (provider, provider_session_id)`.
- Índice em `(user_id, created_at desc)`.

### `credit_ledger` — append-only, nunca UPDATE/DELETE

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` NOT NULL → `users.id` | |
| `delta` | `integer` NOT NULL | `> 0` crédito, `< 0` débito, **nunca 0** (`CHECK (delta <> 0)`) |
| `reason` | `text` NOT NULL | `'purchase'` \| `'consumption'` \| `'refund_reversal'` \| `'refund_reversal_shortfall'` \| `'job_failed_recredit'` \| `'grant_promo'` \| `'chargeback'` |
| `ref_type` | `text` NOT NULL | `'order'` \| `'trip'` |
| `ref_id` | `uuid` NOT NULL | `orders.id` ou `trips.id` |
| `created_at` | `timestamptz` NOT NULL default now | |

- Saldo do usuário = `SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE user_id = $1`.
- Índice em `(user_id)`.
- `refund_reversal_shortfall` registra a parte de um estorno que **não coube** no saldo
  (créditos já gastos) — linha negativa que zera o saldo + o restante fica de sinalização
  para o suporte (valor informativo; não deixa o saldo negativo — ver §5).

### `webhook_events` — idempotência

| Coluna | Tipo | Nota |
|---|---|---|
| `id` | `text` PK | `event.id` da Stripe |
| `type` | `text` NOT NULL | |
| `processed_at` | `timestamptz` NOT NULL default now | |

### Colunas novas

- `trips.unlocked_at timestamptz NULL` — marca que a viagem já consumiu crédito.
- `trips.unlock_ledger_id uuid NULL → credit_ledger.id`.
- `users.free_autonomous_used_at timestamptz NULL` — trava o plano grátis em 1 uso.

---

## 4. Endpoints (`PaymentModule` em `apps/api`)

| Método | Rota | Guard | Descrição |
|---|---|---|---|
| `POST` | `/payments/checkout` | `AuthGuard` | body `{ product: 'single' \| 'pack3' }`. Cria `orders` (`pending`) + Stripe Checkout Session (`mode: 'payment'`, `line_items` do price pré-cadastrado, `client_reference_id = user.id`, `metadata.order_id`, `success_url`, `cancel_url`). Retorna `{ url }`. |
| `POST` | `/payments/webhook` | **público** (sem `AuthGuard`), **raw body** | valida assinatura com `STRIPE_WEBHOOK_SECRET`. Grava `webhook_events` (ignora replay). Despacha por tipo (§6). Responde `200` rápido; todo o efeito é idempotente. |
| `GET` | `/payments/credits` | `AuthGuard` | `{ balance: number, history: Array<{ delta, reason, createdAt }> }`. Front faz polling nesta rota após o checkout. |
| `GET` | `/payments/orders` | `AuthGuard` | histórico de compras do usuário. |

Notas:
- O `/payments/webhook` precisa do corpo **cru** (Buffer) para a verificação de
  assinatura — configurar `rawBody: true` no bootstrap ou `express.raw()` só nessa rota.
  Isso já é um item do débito de CI (envs) — alinhar com `main.ts`.
- `success_url` / `cancel_url` apontam para rotas do `apps/web`
  (`PAYMENT_SUCCESS_URL`, `PAYMENT_CANCEL_URL`).

---

## 5. Serviços e regras

### `CreditsService`

```ts
balanceOf(userId: string): Promise<number>
grant(userId: string, delta: number, reason: LedgerReason, ref: { type: 'order' | 'trip'; id: string }): Promise<void>
consume(userId: string, ref: { type: 'trip'; id: string }): Promise<void>  // delta = -1
```

- **`consume` é transacional e serializado por usuário.** Dentro da transação:
  `SELECT pg_advisory_xact_lock(hashtext('credits:' || $userId))`, recalcula o saldo,
  se `saldo < 1` lança `InsufficientCreditsError` (DomainError, code
  `insufficient_credits` → **HTTP 402**), senão insere a linha `-1` e marca
  `trips.unlocked_at` / `unlock_ledger_id`.
- **Saldo nunca fica negativo** — garantido na aplicação (o `consume` verifica antes),
  não por constraint de banco (o ledger é append-only).
- `consume` é **idempotente por viagem**: se `trips.unlocked_at IS NOT NULL`, não faz nada.

### Gate no fluxo de roteiro

- **Modo assessor:** ao disparar `itinerary.generate` (job pg-boss) para o **1º roteiro
  da viagem**, chamar `CreditsService.consume(userId, { type: 'trip', id: tripId })`
  **antes de enfileirar o job**. Se lançar `InsufficientCreditsError`, a API responde
  402 e o front leva o usuário para a tela de compra.
- **Re-geração / troca de destino pelo chat na mesma viagem:** `unlocked_at` já
  preenchido → não consome.
- **Job falhou em definitivo** (`onFailed` / dead-letter do pg-boss): `grant(userId, +1,
  'job_failed_recredit', { type: 'trip', id: tripId })` e limpar `trips.unlocked_at`
  para o usuário poder tentar de novo sem pagar. (Reserva agora, devolve se falhar.)
- **Modo autônomo grátis:** ao gerar o plano autônomo, se
  `users.free_autonomous_used_at IS NULL` → seta `now()` e segue sem crédito; senão
  exige crédito (cai no mesmo gate).

### `CheckoutService`

- Mapeia `product` → `STRIPE_PRICE_SINGLE` / `STRIPE_PRICE_PACK3` e
  `credits` (1 / 3), `amount_cents` (3900 / 8900).
- Cria `orders` `pending` **antes** de criar a Session; passa `metadata.order_id`.

### `WebhookService`

Dispatch idempotente (§6). Toda escrita de crédito referencia `orders.id` no ledger,
então reprocessar o mesmo evento é no-op (linha já existe → `ON CONFLICT DO NOTHING`
por `(user_id, reason, ref_id)` ou checagem explícita).

---

## 6. Eventos de webhook

| Evento Stripe | Ação |
|---|---|
| `checkout.session.completed` | Só age se `session.payment_status === 'paid'`. Marca `orders` `paid` + `paid_at`, grava `provider_payment_intent`, `grant(userId, +credits, 'purchase', { type: 'order', id })`. |
| `checkout.session.expired` | `orders` → `expired` (se ainda `pending`). |
| `charge.refunded` / `refund.updated` (status `succeeded`) | Ver §7. Estorno total → `orders` `refunded`; parcial → `partially_refunded`. `grant(userId, -min(saldo, creditsAEstornar), 'refund_reversal', { type: 'order', id })`; se faltou saldo, linha extra `refund_reversal_shortfall` (informativa, não deixa saldo negativo) + alerta para suporte. |
| `charge.dispute.created` (chargeback) | `orders` → `failed`, `grant(userId, -min(saldo, credits), 'chargeback', ...)`, sinaliza a conta para revisão manual. |

- Eventos não mapeados: registrar em `webhook_events` e ignorar (retorna 200).
- **Ordem de chegada não é garantida.** Cada handler é escrito para ser seguro fora de
  ordem (ex.: `refunded` antes de `completed` — improvável, mas o handler de refund
  checa se a order está `paid` antes de estornar).

---

## 7. Reembolso (CDC art. 49)

Compra de serviço pela internet dá **7 dias corridos de arrependimento**. Política:

1. **Nenhum crédito da compra consumido, dentro de 7 dias:** reembolso **total** via
   Stripe (dashboard ou endpoint interno de suporte no MVP — não precisa de UI de
   autoatendimento). O webhook `charge.refunded` estorna os créditos.
2. **Pacote com parte dos créditos usada, dentro de 7 dias:** reembolso **proporcional
   aos não usados** — R$ 89 / 3 = R$ 29,67 por crédito; 1 usado → reembolsa ~R$ 59,33.
   Registrar como refund parcial na Stripe; webhook marca `partially_refunded` e estorna
   só os créditos não usados.
3. **Após 7 dias, ou todos os créditos usados:** sem reembolso em dinheiro. Exceção:
   falha comprovada do serviço (roteiro não gerou) → **re-crédito automático**
   (`job_failed_recredit`), não estorno.

Texto final da política entra nos **Termos de Uso** (frente 4 do checklist) — revisar
o item 2 com jurídico.

---

## 8. Config / env

| Var | Uso |
|---|---|
| `PAYMENT_PROVIDER` | `stripe` (default). Deixa a porta para MP/Pagar.me. |
| `STRIPE_SECRET_KEY` | API key (test / live). |
| `STRIPE_WEBHOOK_SECRET` | validação de assinatura do `/payments/webhook`. |
| `STRIPE_PRICE_SINGLE` | `price_…` do produto R$ 39. |
| `STRIPE_PRICE_PACK3` | `price_…` do produto R$ 89. |
| `PAYMENT_SUCCESS_URL` | rota do `apps/web` pós-pagamento. |
| `PAYMENT_CANCEL_URL` | rota do `apps/web` de checkout cancelado. |

- Adicionar todas ao bloco `env:` do `.github/workflows/ci.yml` (junto do débito A2).
- Descrição na fatura do cartão: definir `statement_descriptor` (ex.: `FAROLVIAGENS`).

---

## 9. Interface de provider (fallback)

```ts
interface PaymentProvider {
  createCheckout(input: { userId: string; product: ProductId; orderId: string }): Promise<{ url: string; sessionId: string }>;
  verifyAndParseWebhook(rawBody: Buffer, signature: string): NormalizedEvent;   // lança se assinatura inválida
  refund(input: { paymentIntent: string; amountCents?: number }): Promise<void>; // usado pelo suporte
}
```

- `NormalizedEvent` = `{ id, type: 'paid' | 'expired' | 'refunded' | 'partially_refunded' | 'disputed' | 'ignored', orderId, paymentIntent?, refundedCents? }`.
- MVP implementa só `StripePaymentProvider`. Mercado Pago / Pagar.me entram se a
  Stripe recusar o cadastro BR.

---

## 10. Frontend (`apps/web` — território do Passo 8, produto define o comportamento)

- **Tela / modal de compra:** dois cards — Avulso R$ 39 (1 viagem) e Pacote R$ 89
  (3 viagens, "sem prazo para usar"). CTA → `POST /payments/checkout` → `window.location = url`.
- **`/pagamento/sucesso`:** faz polling de `GET /payments/credits` até o saldo refletir
  (webhook pode chegar depois do redirect), então segue o fluxo que o usuário estava
  fazendo (gerar o roteiro).
- **`/pagamento/cancelado`:** volta para a tela anterior sem erro.
- **Header (logado):** selo com saldo de créditos.
- **Gate:** ao clicar "gerar meu roteiro" sem crédito → abre a tela de compra
  (a API já responde 402).
- Copy na voz "assessor calmo" — sem euforia, honesto sobre o que está incluso.

---

## 11. Testes (baseline do projeto: 100% cobertura + unidade/integração/e2e/mutação)

**Unidade**
- `CreditsService`: `grant`, `consume` (sucesso, saldo insuficiente → `InsufficientCreditsError`,
  idempotência por viagem), agregação de saldo, corrida simulada (dois `consume` com saldo 1 → um falha).
- `CheckoutService`: monta a Session com o `price` e os `credits`/`amount` certos por produto; cria `order` `pending` antes.
- `WebhookService`: dispatch por tipo, replay do mesmo `event.id` é no-op, refund total / parcial / shortfall, chargeback, evento fora de ordem.

**Integração (Postgres real, Stripe fake determinístico)**
- Ledger append + saldo agregado; `order` lifecycle `pending → paid → refunded`.
- Gate no `itinerary.generate`: 2ª viagem sem crédito → 402; com crédito → consome 1 e marca `unlocked_at`.
- `job_failed_recredit` devolve o crédito e limpa `unlocked_at`.
- Autônomo grátis: 1ª vez seta `free_autonomous_used_at`; 2ª vez cai no gate.

**Contrato Stripe** (`__fixtures__`, sem rede no CI)
- Payloads assinados de `checkout.session.completed`, `checkout.session.expired`,
  `charge.refunded` (total e parcial), `charge.dispute.created`. Assinatura validada com secret de teste.

**E2E — API** (`apps/api` de pé + Postgres de teste)
- `POST /payments/checkout` → `200 { url }`.
- `POST /payments/webhook` com payload assinado → crédito aparece em `GET /payments/credits`.
- Replay do mesmo evento não duplica crédito.
- Fluxo completo: checkout → webhook → gerar roteiro consome → 2ª viagem sem saldo → 402.

**Mutação:** ≥ 90 no pacote, como o resto do projeto.

---

## 12. Ordem de implementação sugerida (para o Rafinha)

1. Migration `0006` + entidades Drizzle + `packages/shared` DTOs (`checkout`, `credits`).
2. `CreditsService` + testes (é o núcleo; não depende da Stripe).
3. `PaymentProvider` + `StripePaymentProvider` (só `createCheckout` + `verifyAndParseWebhook`).
4. `PaymentModule`: `/payments/checkout`, `/payments/credits`, `/payments/orders`.
5. `/payments/webhook` + `WebhookService` + `webhook_events` + fixtures de contrato.
6. Gate no `itinerary.generate` (consumo + re-crédito no `onFailed`) e no plano autônomo.
7. Envs no `ci.yml`. E2E do fluxo completo.
8. Frontend (§10) — pode ir junto do Passo 8.

---

## 13. Decisões abertas

- **Preço final** R$ 39 / R$ 89 — confirmar com o time antes de cadastrar os produtos na Stripe.
- **Teto de custo de LLM por roteiro** (item separado do backlog) — alimenta a margem:
  `R$ 39 − taxa Stripe (~4,99% + R$ 0,39) − LLM − Google Places − infra`. Sem o teto, a margem por viagem é estimativa.
- **Reembolso proporcional do pacote** — validar a redação com jurídico junto dos Termos.
- **`statement_descriptor`** na fatura do cartão.
- **Consumo no `generate` vs na criação da 2ª viagem** — esta spec assume **no `generate`**.
  Se produto preferir cobrar já na criação da viagem, muda o ponto de chamada do `consume` (resto igual).
