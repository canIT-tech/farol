# Pagamento por viagem — Stripe, modo Levels

- **Data:** 2026-09-15
- **Passo do backlog:** 11
- **Supersede (em parte):** `docs/negocio/2026-08-31-spec-pagamento.md` (produto) e
  `docs/negocio/2026-08-31-spec-plano-gratuito.md`. As decisões de produto valem; o
  desenho técnico daquela spec (ledger, provider de fallback, reembolso proporcional
  automático, limites do plano grátis) **não** entra neste passo — ver §1.
- **Relacionado:** `docs/legal/termos-de-uso.md`, `docs/legal/politica-de-privacidade.md`

---

## 0. Por que "modo Levels"

O Farol ainda não tem usuário pagante. A pergunta que o pagamento responde neste
momento não é "como contabilizar receita" e sim "alguém paga?". Pieter Levels resolve
isso com uma conta Stripe só, Checkout hospedado, um webhook e **uma coluna de saldo no
usuário**; histórico, reembolso e disputa moram no painel da Stripe. É o que fazemos.
O ledger append-only da spec de 31/08 entra no dia em que o suporte precisar de trilha
própria — não antes.

## 1. Escopo

**Entra**

- Freemium: **o primeiro roteiro da conta é grátis, em qualquer modo** (assessor ou
  autônomo). Do segundo em diante, 1 crédito por viagem.
- Compra de créditos: avulso (1 crédito, R$ 39) e pacote (3 créditos, R$ 89), via
  **Stripe Checkout hospedado**. BRL apenas.
- Webhook assinado e idempotente que credita (pago), marca expirado e debita (estorno).
- Gate de crédito no disparo do roteiro.
- Telas: selo no header, tela de compra, retorno de sucesso e de cancelamento.
- Termos de Uso e Política de Privacidade publicados, com aceite no checkout.

**Fica de fora, de propósito**

- `credit_ledger`. Saldo é `users.credits`; histórico é a Stripe.
- Provider de fallback (Mercado Pago / Pagar.me). A porta `PaymentProvider` existe só
  para o `fake` dos testes, não como abstração de gateway.
- Limites do plano grátis além do 1º roteiro (5 trips, 3 mensagens de chat, seletor só
  para pago, regenerate só para pago). Chat, regenerate e troca de restaurante seguem
  livres em qualquer viagem já destravada.
- Reembolso proporcional automático do pacote; chargeback. Estorno é feito no painel da
  Stripe e o webhook só reflete. Disputa é logada e ignorada.
- Cupom, assinatura, multi-moeda, aceite de termos no cadastro.
- Conta Stripe **live**. O código nasce no sandbox; ativar a live (CNPJ da isTech) é
  pré-condição de lançamento, não deste passo.

## 2. Por que não há `trips.mode`

A API não sabe o que é "modo autônomo": o `/auto` é o front encadeando
`createTrip → runDiscovery → chooseDestination`. Distinguir os modos no gate exigiria um
campo vindo do cliente, trivial de burlar. A regra "1º roteiro grátis, qualquer modo"
dispensa isso e é a melhor amostra do produto. Consequência: a tabela de preços da
landing ("Grátis = autônomo, sem chat") passa a dizer "sua primeira viagem, completa".

## 3. Dados — migration `0009`

| Tabela | Coluna | Tipo | Nota |
|---|---|---|---|
| `users` | `credits` | `integer not null default 0` | saldo. Nunca negativo: o débito é `WHERE credits >= 1` (§5) e o estorno usa `greatest(0, …)` (§6) |
| `users` | `free_itinerary_used_at` | `timestamptz null` | nulo = ainda tem o roteiro grátis |
| `trips` | `unlocked_at` | `timestamptz null` | a viagem já pagou (ou usou o grátis). Regenerar, chat e trocar restaurante nunca recobram |
| `trips` | `unlocked_via` | `text null` (`free` \| `credit`) | diz o que devolver se o job falhar |

**`orders`** — uma linha por tentativa de compra.

| Coluna | Tipo |
|---|---|
| `id` | `uuid pk` |
| `user_id` | `uuid not null → users.id` |
| `provider_session_id` | `text not null unique` (id da Checkout Session) |
| `product` | `text not null` (`single` \| `pack3`) |
| `credits` | `integer not null` (1 \| 3) |
| `amount_cents` | `integer not null` (3900 \| 8900) |
| `status` | `text not null` (`pending` \| `paid` \| `expired` \| `refunded`) |
| `created_at` | `timestamptz not null default now()` |
| `paid_at` | `timestamptz null` |

Índice em `(user_id, created_at desc)`.

**`webhook_events`** — `id text pk` (o `event.id` da Stripe), `type text not null`,
`processed_at timestamptz not null default now()`. Existe só para o replay ser no-op.

Catálogo de produto é código, não tabela:
`PRODUCTS = { single: { credits: 1, amountCents: 3900 }, pack3: { credits: 3, amountCents: 8900 } }`
em `packages/shared`.

## 4. Porta de pagamento

Mesmo desenho do LLM e do e-mail (`env.schema.ts`): provider opcional, e com provider as
outras envs viram obrigatórias.

```ts
interface PaymentProvider {
  createCheckout(input: {
    orderId: string; userId: string; email: string; product: ProductId;
    successUrl: string; cancelUrl: string;
  }): Promise<{ url: string; sessionId: string }>;
  // Lança PaymentSignatureError se a assinatura não bater.
  parseWebhook(rawBody: Buffer, signature: string): PaymentEvent;
}

type PaymentEvent =
  | { id: string; type: "paid"; sessionId: string }
  | { id: string; type: "expired"; sessionId: string }
  | { id: string; type: "refunded"; sessionId: string }
  | { id: string; type: "ignored"; sessionId: null };
```

- `StripePaymentProvider` (lib oficial `stripe`): `checkout.sessions.create({ mode:
  "payment", line_items: [{ price, quantity: 1 }], client_reference_id: userId,
  customer_email: email, metadata: { orderId }, success_url, cancel_url,
  consent_collection: { terms_of_service: "required" },
  payment_intent_data: { statement_descriptor_suffix: "FAROL" } })`.
  `parseWebhook` = `webhooks.constructEvent`. Mapeia
  `checkout.session.completed` e `checkout.session.async_payment_succeeded` com
  `payment_status === "paid"` → `paid` (Pix/boleto confirmam no segundo);
  `checkout.session.expired` e `checkout.session.async_payment_failed` → `expired`; `charge.refunded` → `refunded` (o
  `sessionId` vem de `charges.list`/`payment_intent` → metadata; se não achar, `ignored`
  com log). Tudo mais → `ignored`.
- `FakePaymentProvider`: `createCheckout` devolve `url = <APP_URL>/payment/success?fake=1`
  e um `sessionId` previsível; `parseWebhook` aceita JSON puro assinado com
  `"fake"` no header. É o que a suíte e o Playwright usam.

**Env**

| Var | Obrigatória | Nota |
|---|---|---|
| `PAYMENT_PROVIDER` | não (`stripe` \| `fake`) | sem ela, `/payments/checkout` responde **503 `payment_not_configured`**; o gate (§5) continua funcionando |
| `STRIPE_SECRET_KEY` | com `stripe` | |
| `STRIPE_WEBHOOK_SECRET` | com `stripe` | |
| `STRIPE_PRICE_SINGLE` / `STRIPE_PRICE_PACK3` | com `stripe` | `price_…` |
| `APP_URL` | com provider | monta `success_url` e `cancel_url` |

Vão para o Doppler (`dev` = sandbox, `prd` = sandbox até a live existir) e para o
`env:` do `ci.yml` com `PAYMENT_PROVIDER=fake`.

## 5. Gate — onde e como

Ponto único de disparo do roteiro: `ItineraryService.chooseDestination`
(`apps/api/src/itinerary/itinerary.service.ts`), antes de `createPending`/`publish`.
Chat (`set_destination`), regenerate e swap passam por outros métodos ou pela mesma
viagem já destravada — nenhum deles cobra.

```
unlock(userId, tripId), numa transação:
  trip.unlocked_at != null            → segue (idempotente)
  users.free_itinerary_used_at == null → UPDATE users SET free_itinerary_used_at = now()
                                         trips.unlocked_at = now(), unlocked_via = 'free'
  senão                                → UPDATE users SET credits = credits - 1
                                           WHERE id = $1 AND credits >= 1
                                         0 linhas → 402 payment_required
                                         1 linha  → trips.unlocked_at = now(), unlocked_via = 'credit'
```

O `WHERE credits >= 1` é o lock: duas requisições simultâneas com saldo 1 → uma perde.
Sem advisory lock, sem `SELECT … FOR UPDATE`.

`PaymentRequiredError` é um `DomainError` novo (`code: "payment_required"`) mapeado para
HTTP **402** em `STATUS_BY_CODE` de `apps/api/src/common/domain-exception.filter.ts`
(junto com `payment_not_configured` → 503, como `llm_not_configured`).

**Job falhou em definitivo** (`onFailed` do pg-boss, depois das retentativas):
`trips.unlocked_at = null, unlocked_via = null`; se era `credit`, `users.credits + 1`; se
era `free`, `free_itinerary_used_at = null`. Reserva agora, devolve se falhar.

## 6. API — `PaymentModule`

| Método | Rota | Guard | Faz |
|---|---|---|---|
| `POST` | `/payments/checkout` | Auth | body `{ product }`. Cria `orders` `pending` → `provider.createCheckout` → grava `provider_session_id` → `{ url }`. 503 sem provider. |
| `POST` | `/payments/webhook` | **`@Public()`**, corpo cru | §6.1 |
| `GET` | `/payments/me` | Auth | `{ credits, freeItineraryUsed, orders: [{ product, credits, amountCents, status, createdAt }] }`. O front faz polling aqui depois do checkout. |

### 6.1 Webhook

1. `NestFactory.create(AppModule, { rawBody: true })` no `main.ts`; o handler lê
   `req.rawBody` e o header `stripe-signature`.
2. `provider.parseWebhook` — assinatura inválida → **400**, sem tocar no banco.
3. `INSERT INTO webhook_events … ON CONFLICT DO NOTHING`; 0 linhas → replay → **200** e sai.
4. Por tipo, na mesma transação do passo 3:
   - `paid`: `orders.status = 'paid', paid_at = now()` **só se estava `pending`**; se
     mudou de estado, `UPDATE users SET credits = credits + orders.credits`.
   - `expired`: `orders.status = 'expired'` só se `pending`.
   - `refunded`: `orders.status = 'refunded'` só se `paid`; se mudou,
     `UPDATE users SET credits = greatest(0, credits - orders.credits)`. Créditos já
     gastos não voltam do usuário — decisão de produto da spec de 31/08 (§7).
   - `ignored`: só o passo 3.
5. Sempre **200** depois do passo 3, mesmo em erro de negócio (Stripe reenvia em
   não-2xx; reenviar não ajuda). Erro vai para o log com `event.id`.

O "só se estava X" torna cada handler seguro fora de ordem.

## 7. Front — `apps/web`

- **Header logado** (`/trips` e `TripShell`): selo `1ª viagem por nossa conta` enquanto
  `freeItineraryUsed === false`; depois `N créditos` (`0 créditos` em cinza). Fonte:
  `GET /payments/me`, cacheado no provider de sessão.
- **`/credits`**: título na voz do assessor ("Sua primeira viagem foi por nossa conta.
  As próximas custam o preço de um café por dia de roteiro."), dois cards — *1 viagem,
  R$ 39* e *3 viagens, R$ 89, sem prazo para usar* — cada um com "Incluído: destino,
  roteiro dia a dia, ajustes por conversa, voo e hotel". Rodapé: reembolso em 7 dias,
  link para `/terms`. CTA → `POST /payments/checkout` → `window.location = url`.
  Query `returnTo` guardada em `sessionStorage`.
- **`/payment/success`**: "Confirmando com a operadora…", polling em `/payments/me`
  a cada 2 s por até 60 s até `credits` subir; então `router.replace(returnTo ?? "/trips")`.
  Estourou o tempo: "O pagamento foi aprovado e o crédito aparece em instantes" + botão
  para `/trips` (o webhook pode atrasar; o saldo chega de qualquer jeito).
- **`/payment/cancelled`**: uma linha, volta para `returnTo`.
- **402 no cliente** (`lib/api-client.ts`): erro `payment_required` →
  `router.push("/credits?returnTo=" + pathname)`. A tela de escolher destino é a que
  dispara; ela mostra o aviso inline antes de redirecionar.
- **Landing** (`/`): a coluna "Grátis" passa a dizer "Sua primeira viagem, completa" e
  remove "Sem chat".

## 8. Legal — `docs/legal/` e publicação

Os rascunhos já cobrem créditos, Stripe e arrependimento. O que muda com esta spec:

1. **`termos-de-uso.md` §5:** a regra do grátis passa a ser "o primeiro roteiro da conta,
   em qualquer modo"; tirar a amarra "modo assessor" do conceito de crédito; confirmar os
   valores `[39,00]` / `[89,00]`; deixar explícito que **estorno devolve só créditos não
   usados** e que o Farol não emite o aceite — a Stripe o registra no checkout.
2. **`politica-de-privacidade.md`:** trocar `[Stripe]` por Stripe sem colchete; a
   controladora dos dados é a **isTech** (dona da conta Stripe), Farol é o produto — nome,
   CNPJ e e-mail de contato entram no cabeçalho dos dois documentos.
3. **Publicar:** `apps/web/src/app/terms/page.tsx` e `privacidade/page.tsx` renderizam
   os dois `.md` (import estático em build; sem CMS). Link no rodapé da landing, no
   `/credits` e no `/login`. Sem essas páginas a Stripe não ativa a conta live, e sem a
   URL cadastrada em *Settings → Public details* o `consent_collection` do checkout não
   aparece.
4. **Política de reembolso visível** em `/credits` (uma linha) e nos Termos (§6) —
   exigência da ativação da conta.
5. Os textos seguem pré-jurídicos; o aviso do `README.md` de `docs/legal/` continua.

Não entra: aceite de termos no cadastro, exportação/exclusão automática de dados (LGPD é
atendida manualmente no MVP — pedido por e-mail).

## 9. Stripe — configuração

Sandbox `acct_1Ro8TSGKqrFCwn62` hoje; live com o CNPJ da isTech quando for lançar.

- Produtos: **Farol · 1 viagem** (`price` BRL 3900) e **Farol · 3 viagens** (BRL 8900).
  Os três produtos de demo (Produto PRO, Plus, Base) são arquivados.
- Webhook endpoint: `https://farol-ekk3.onrender.com/api/payments/webhook`, eventos
  `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`.
- *Settings → Public details*: nome, URL dos Termos e da Privacidade, e-mail de suporte.
- Criação pelo MCP da Stripe; `price_…` e o signing secret vão para o Doppler.
- Local: `stripe listen --forward-to localhost:3333/api/payments/webhook` (Stripe CLI).

## 10. Testes

Baseline do projeto: 100% cobertura, unidade + integração + e2e + mutação ≥ 90.

- **Unidade** — `unlock`: grátis marca e destrava; segunda viagem com saldo debita;
  sem saldo → 402; idempotente (`unlocked_at` já preenchido não toca no saldo);
  corrida (dois `unlock` com saldo 1 → um 402). `onFailed`: devolve crédito ou o grátis.
  Webhook: replay no-op; `paid` duas vezes credita uma; `refunded` antes de `paid` não
  deixa negativo; assinatura inválida → 400 sem escrita.
- **Contrato Stripe** — payloads em `__fixtures__` assinados com
  `stripe.webhooks.generateTestHeaderString` e secret de teste; sem rede no CI.
- **Integração** (Postgres real, `fake`) — `checkout → webhook → /payments/me` reflete;
  ciclo `pending → paid → refunded`.
- **E2E API** — fluxo inteiro: 1ª viagem gera sem crédito; 2ª → 402; checkout fake +
  webhook fake → 2ª gera e debita.
- **Playwright** — selo do header, `/credits` → checkout fake → `/payment/success`
  → volta; 402 na escolha de destino leva ao `/credits`.

## 11. Ordem de implementação

1. Migration `0009` + schema Drizzle + `PRODUCTS` e DTOs em `packages/shared`.
2. `unlock` no `ItineraryService` + `PaymentRequiredError` (402) + `onFailed`. Não
   depende da Stripe — é o núcleo, e já vale sozinho (1º grátis, depois 402).
3. `PaymentProvider` + `fake` + `stripe`; env.
4. `PaymentModule`: `/checkout`, `/me`.
5. `/webhook` + `webhook_events` + fixtures assinadas + `rawBody` no `main.ts`.
6. Front: selo, `/credits`, sucesso/cancelado, 402 no cliente, landing.
7. Legal: §8 (textos + páginas + links).
8. Stripe sandbox pelo MCP; Doppler `dev`/`prd`; Render; `ci.yml`.

## 12. Decisões abertas (não bloqueiam)

- Ativação da conta live: quem assina (isTech), conta bancária, e quando.
- Nota fiscal (NFS-e) por venda — obrigação da isTech, fora do app.
- Se o `statement_descriptor_suffix` "FAROL" passa na validação (máx. 22 chars com o
  prefixo da conta) — confirmar no sandbox.
