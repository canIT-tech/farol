# Pagamento por viagem (Stripe, modo Levels) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1º roteiro da conta grátis; do 2º em diante 1 crédito por viagem, comprado via Stripe Checkout; saldo em `users.credits`, webhook idempotente, telas de compra/retorno, Termos e Privacidade publicados.

**Architecture:** `CreditsModule` (saldo, grátis, gate, devolução) é o núcleo e não depende da Stripe. `PaymentsModule` (checkout, webhook, `/payments/me`) fala com a porta `PaymentProvider` (`stripe` | `fake`), no mesmo desenho de LLM/E-mail. O gate mora em `ItineraryService.chooseDestination`; a devolução no dead-letter do pg-boss. Front: selo, `/credits`, `/pagamento/{sucesso,cancelado}`, 402 → `/credits`.

**Tech Stack:** NestJS 10, Drizzle + Postgres, pg-boss, zod, `stripe` 22.x (lib oficial), Next.js 15, Vitest, Supertest, Playwright, Stryker.

**Spec:** `docs/superpowers/specs/2026-09-15-pagamento-stripe-design.md`

## Global Constraints

- Cobertura **100%** (statements/branches/functions/lines) por pacote; mutação **≥ 90** (`@farol/db` = 85).
- Nunca commitar segredo. Chaves só no Doppler (`farol/dev` = sandbox, `farol/prd` = sandbox até a live existir). Render == Doppler `prd`, chave a chave, escrito por MCP.
- Sandbox da Stripe **sempre** nos testes; nada bate na rede no CI (`PAYMENT_PROVIDER=fake`).
- Sem ledger: saldo é `users.credits`. Saldo nunca negativo. `webhook_events` garante replay no-op.
- Voz do assessor nas telas: específico, honesto, sem euforia. PT-BR.
- Preços: `single` = 1 crédito = R$ 39,00 (3900); `pack3` = 3 créditos = R$ 89,00 (8900). BRL.
- Todos os comandos rodam a partir da raiz da worktree (`/Users/ignaulin/www/farol/.claude/worktrees/rafaignaulin-pagamento-stripe`), com `doppler run -p farol -c dev --` na frente do que precisa de banco/env. Vitest com `--pool=threads`. Antes de cada push: `pnpm lint && pnpm typecheck && pnpm test` (a sequência do `ci.yml`).
- Git nesta sessão: usar `/usr/bin/git` (o hook do RTK bloqueia `git` em worktree).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `packages/shared/src/payments.ts` | `PRODUCTS`, schemas de checkout/`/payments/me`, `PaymentRequiredError`, `PaymentNotConfiguredError` |
| `packages/db/src/schema.ts` + `drizzle/0009_*.sql` | colunas em `users`/`trips`, tabelas `orders`, `webhook_events` |
| `apps/api/src/config/env.schema.ts` | `PAYMENT_PROVIDER`, `STRIPE_*`, `APP_URL` |
| `apps/api/src/common/domain-exception.filter.ts` | `payment_required` → 402, `payment_not_configured` → 503 |
| `apps/api/src/credits/credits.service.ts` (+ `credits.module.ts`) | `unlock`, `release`, `grant`, `revoke`, `summary` |
| `apps/api/src/itinerary/itinerary.service.ts` | chama `unlock` antes de enfileirar |
| `apps/api/src/itinerary/itinerary-generate.handler.ts` | `release(data)` no dead-letter |
| `apps/api/src/jobs/job-queue.ts`, `pgboss-queue.ts`, `register-handlers.ts` | `work(name, handler, onDeadLetter?)` |
| `apps/api/src/payments/payment.types.ts` | porta `PaymentProvider`, `PaymentEvent`, `PAYMENT`, `PaymentSignatureError` |
| `apps/api/src/payments/fake-payment.provider.ts` | provider dos testes |
| `apps/api/src/payments/providers/stripe.provider.ts` | `StripePaymentProvider` |
| `apps/api/src/payments/payments.service.ts` | `checkout`, `me`, `applyWebhook` |
| `apps/api/src/payments/payments.controller.ts` | `POST /payments/checkout`, `POST /payments/webhook` (`@Public`), `GET /payments/me` |
| `apps/api/src/payments/payments.module.ts` | `buildPayment(env)` |
| `apps/api/src/main.ts` | `rawBody: true` |
| `apps/worker/src/worker.module.ts` | provê `CreditsService` |
| `apps/api/test/payments.e2e-spec.ts` | fluxo inteiro |
| `apps/web/src/lib/payments-api.ts` | `getPaymentMe`, `startCheckout` |
| `apps/web/src/components/common/CreditsBadge.tsx` | selo do header |
| `apps/web/src/app/credits/page.tsx`, `pagamento/sucesso/page.tsx`, `pagamento/cancelado/page.tsx` | telas |
| `apps/web/src/lib/payment-required.ts` | `creditsRoute(returnTo)` + `isPaymentRequired(err)` |
| `apps/web/src/app/terms/page.tsx`, `privacidade/page.tsx`, `next.config.mjs`, `md.d.ts` | páginas legais |
| `docs/legal/termos-de-uso.md`, `politica-de-privacidade.md` | texto atualizado |
| `.github/workflows/ci.yml`, `.env.example`, `apps/api/test/setup-e2e.ts` | envs |

---

### Task 1: `@farol/shared` — produtos, schemas e erros

**Files:**
- Create: `packages/shared/src/payments.ts`, `packages/shared/src/payments.spec.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Produces: `ProductId`, `PRODUCTS`, `productIdSchema`, `checkoutInputSchema`, `checkoutResultSchema`, `paymentMeSchema`/`PaymentMe`, `orderSummarySchema`/`OrderSummary`, `PaymentRequiredError` (`code: "payment_required"`), `PaymentNotConfiguredError` (`code: "payment_not_configured"`).

- [ ] **Step 1: Teste**

```ts
// packages/shared/src/payments.spec.ts
import { describe, it, expect } from "vitest";
import {
  PRODUCTS, checkoutInputSchema, paymentMeSchema,
  PaymentRequiredError, PaymentNotConfiguredError, isDomainError
} from "./index.js";

describe("PRODUCTS", () => {
  it("avulso é 1 crédito por R$ 39 e pacote 3 por R$ 89", () => {
    expect(PRODUCTS.single).toEqual({ credits: 1, amountCents: 3900, label: "1 viagem" });
    expect(PRODUCTS.pack3).toEqual({ credits: 3, amountCents: 8900, label: "3 viagens" });
  });
});

describe("checkoutInputSchema", () => {
  it("aceita single e pack3", () => {
    expect(checkoutInputSchema.parse({ product: "single" }).product).toBe("single");
    expect(checkoutInputSchema.parse({ product: "pack3" }).product).toBe("pack3");
  });
  it("recusa produto desconhecido", () => {
    expect(() => checkoutInputSchema.parse({ product: "pack10" })).toThrow();
  });
});

describe("paymentMeSchema", () => {
  it("aceita saldo zero e lista vazia", () => {
    expect(paymentMeSchema.parse({ credits: 0, freeItineraryUsed: false, orders: [] }).credits).toBe(0);
  });
  it("recusa saldo negativo", () => {
    expect(() => paymentMeSchema.parse({ credits: -1, freeItineraryUsed: false, orders: [] })).toThrow();
  });
});

describe("erros de pagamento", () => {
  it("PaymentRequiredError é DomainError com code payment_required", () => {
    const e = new PaymentRequiredError();
    expect(isDomainError(e)).toBe(true);
    expect(e.code).toBe("payment_required");
    expect(e.message).toContain("crédito");
  });
  it("PaymentNotConfiguredError tem code payment_not_configured", () => {
    expect(new PaymentNotConfiguredError().code).toBe("payment_not_configured");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `pnpm --filter @farol/shared exec vitest run --pool=threads src/payments.spec.ts` → falha por módulo inexistente.

- [ ] **Step 3: Implementar**

```ts
// packages/shared/src/payments.ts
import { z } from "zod";
import { DomainError } from "./errors.js";

export const productIdSchema = z.enum(["single", "pack3"]);
export type ProductId = z.infer<typeof productIdSchema>;

// Catálogo é código, não tabela: dois produtos, preço fixo em BRL (spec §3).
export const PRODUCTS: Record<ProductId, { credits: number; amountCents: number; label: string }> = {
  single: { credits: 1, amountCents: 3900, label: "1 viagem" },
  pack3: { credits: 3, amountCents: 8900, label: "3 viagens" }
};

export const checkoutInputSchema = z.object({ product: productIdSchema });
export type CheckoutInput = z.infer<typeof checkoutInputSchema>;

export const checkoutResultSchema = z.object({ url: z.string().url() });
export type CheckoutResult = z.infer<typeof checkoutResultSchema>;

export const orderStatusSchema = z.enum(["pending", "paid", "expired", "refunded"]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

export const orderSummarySchema = z.object({
  id: z.string().uuid(),
  product: productIdSchema,
  credits: z.number().int().positive(),
  amountCents: z.number().int().positive(),
  status: orderStatusSchema,
  createdAt: z.string().min(1)
});
export type OrderSummary = z.infer<typeof orderSummarySchema>;

export const paymentMeSchema = z.object({
  credits: z.number().int().min(0),
  freeItineraryUsed: z.boolean(),
  orders: z.array(orderSummarySchema)
});
export type PaymentMe = z.infer<typeof paymentMeSchema>;

// 402: a viagem grátis já foi usada e não há saldo.
export class PaymentRequiredError extends DomainError {
  constructor() {
    super("payment_required", "sua primeira viagem foi por nossa conta — as próximas usam um crédito");
  }
}

// 503: PAYMENT_PROVIDER ausente. O gate segue funcionando; só a compra não existe.
export class PaymentNotConfiguredError extends DomainError {
  constructor() {
    super("payment_not_configured", "a compra de créditos ainda não está disponível");
  }
}
```

Em `index.ts`: `export * from "./payments.js";`

- [ ] **Step 4: Rodar** — `pnpm --filter @farol/shared test -- --pool=threads` verde, cobertura 100%. Depois `pnpm --filter @farol/shared build` (a api/web leem o `dist`).

- [ ] **Step 5: Commit** — `feat(shared): produtos, schemas e erros de pagamento`

---

### Task 2: `@farol/db` — migration `0009`

**Files:**
- Modify: `packages/db/src/schema.ts` (`users`, `trips`; novas `orders`, `webhookEvents`), `packages/db/src/schema.spec.ts`
- Create: `packages/db/drizzle/0009_*.sql` via `pnpm --filter @farol/db db:generate` (+ `meta/`)

**Interfaces:**
- Produces: `users.credits`, `users.freeItineraryUsedAt`, `trips.unlockedAt`, `trips.unlockedVia`, tabelas `orders` (`id, userId, providerSessionId, providerPaymentIntent, product, credits, amountCents, status, createdAt, paidAt`) e `webhookEvents` (`id, type, processedAt`).

- [ ] **Step 1: Teste** — no `schema.spec.ts` existente, seguir o padrão do arquivo (ele insere/lê com o banco real) e acrescentar:

```ts
it("users nasce com credits 0 e sem roteiro grátis usado", async () => {
  const id = crypto.randomUUID();
  await db.insert(users).values({ id, email: `${id}@farol.test` });
  const [row] = await db.select().from(users).where(eq(users.id, id));
  expect(row!.credits).toBe(0);
  expect(row!.freeItineraryUsedAt).toBeNull();
});

it("orders exige provider_session_id único", async () => {
  const userId = await makeUser();
  const base = { userId, providerSessionId: "cs_test_dup", product: "single", credits: 1, amountCents: 3900, status: "pending" };
  await db.insert(orders).values({ id: crypto.randomUUID(), ...base });
  await expect(db.insert(orders).values({ id: crypto.randomUUID(), ...base })).rejects.toThrow();
});

it("webhook_events: segundo insert do mesmo id é no-op com onConflictDoNothing", async () => {
  const id = `evt_${crypto.randomUUID()}`;
  const first = await db.insert(webhookEvents).values({ id, type: "x" }).onConflictDoNothing().returning();
  const second = await db.insert(webhookEvents).values({ id, type: "x" }).onConflictDoNothing().returning();
  expect(first).toHaveLength(1);
  expect(second).toHaveLength(0);
});
```

(`makeUser` — se o spec já não tiver, criar igual ao de `itinerary.service.spec.ts`.)

- [ ] **Step 2: Rodar e ver falhar** — `doppler run -p farol -c dev -- pnpm --filter @farol/db test -- --pool=threads`.

- [ ] **Step 3: Schema**

```ts
// users: acrescentar
  // Saldo de créditos (spec pagamento §3). Nunca negativo: o débito é
  // `WHERE credits >= 1` e o estorno usa greatest(0, …). Sem ledger de propósito.
  credits: integer("credits").notNull().default(0),
  // Nulo = o roteiro grátis da conta ainda não foi usado.
  freeItineraryUsedAt: timestamp("free_itinerary_used_at", { withTimezone: true })

// trips: acrescentar
    // A viagem já destravou o roteiro (grátis ou 1 crédito). Regenerar, chat e
    // trocar restaurante nunca recobram. unlockedVia diz o que devolver se o
    // job falhar em definitivo: 'free' | 'credit'.
    unlockedAt: timestamp("unlocked_at", { withTimezone: true }),
    unlockedVia: text("unlocked_via"),

// novas tabelas (depois de waitlist)
// Uma linha por tentativa de compra (spec pagamento §3). Histórico fino mora na Stripe.
export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    providerSessionId: text("provider_session_id").notNull().unique(),
    // Preenchido no pago; é a chave que liga charge.refunded à order.
    providerPaymentIntent: text("provider_payment_intent"),
    product: text("product").notNull(),
    credits: integer("credits").notNull(),
    amountCents: integer("amount_cents").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    paidAt: timestamp("paid_at", { withTimezone: true })
  },
  (t) => ({ userCreatedIdx: index("orders_user_created_idx").on(t.userId, t.createdAt) })
);

// Só existe para o replay de webhook ser no-op: id = event.id da Stripe.
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  processedAt: timestamp("processed_at", { withTimezone: true }).notNull().defaultNow()
});
```

- [ ] **Step 4: Gerar migration** — `pnpm --filter @farol/db db:generate` → confere que `drizzle/0009_*.sql` tem só as 4 colunas + 2 tabelas + índice. Aplicar: `doppler run -p farol -c dev -- pnpm --filter @farol/db db:migrate` (e no `farol_test`: `DATABASE_URL=$DATABASE_URL_TEST`).

- [ ] **Step 5: Rodar** — `db` verde. Depois `pnpm --filter @farol/db build`.

- [ ] **Step 6: Commit** — `feat(db): credits, unlocked_at, orders e webhook_events (0009)`

---

### Task 3: env + mapa de status HTTP

**Files:**
- Modify: `apps/api/src/config/env.schema.ts`, `env.schema.spec.ts`, `apps/api/src/common/domain-exception.filter.ts`, `domain-exception.filter.spec.ts`

**Interfaces:**
- Produces: `Env.PAYMENT_PROVIDER?: "stripe" | "fake"`, `STRIPE_SECRET_KEY?`, `STRIPE_WEBHOOK_SECRET?`, `STRIPE_PRICE_SINGLE?`, `STRIPE_PRICE_PACK3?`, `APP_URL: string` (default `http://localhost:3000`).

- [ ] **Step 1: Testes**

```ts
// env.schema.spec.ts — junto dos casos de LLM/EMAIL existentes
it("PAYMENT_PROVIDER=stripe exige as quatro STRIPE_*", () => {
  expect(() => parseEnv({ ...base, PAYMENT_PROVIDER: "stripe" })).toThrow(/STRIPE_SECRET_KEY/);
});
it("PAYMENT_PROVIDER=fake não exige nada e APP_URL tem default", () => {
  const env = parseEnv({ ...base, PAYMENT_PROVIDER: "fake" });
  expect(env.APP_URL).toBe("http://localhost:3000");
});
it("sem PAYMENT_PROVIDER a env passa", () => {
  expect(parseEnv(base).PAYMENT_PROVIDER).toBeUndefined();
});

// domain-exception.filter.spec.ts
it("mapeia payment_required para 402", () => {
  const { host, status } = makeHost();
  new DomainExceptionFilter().catch(new PaymentRequiredError(), host);
  expect(status).toHaveBeenCalledWith(402);
});
it("mapeia payment_not_configured para 503", () => {
  const { host, status } = makeHost();
  new DomainExceptionFilter().catch(new PaymentNotConfiguredError(), host);
  expect(status).toHaveBeenCalledWith(503);
});
```

- [ ] **Step 2: Falhar** — `pnpm --filter @farol/api exec vitest run --pool=threads src/config src/common`.

- [ ] **Step 3: Implementar**

```ts
// env.schema.ts — no baseEnvSchema, depois do bloco EMAIL
  // Pagamento (spec 2026-09-15). Mesmo desenho: opcional; com "stripe" as
  // quatro STRIPE_* viram obrigatórias. Sem provider o gate do roteiro segue
  // (1º grátis, depois 402) e só a compra responde payment_not_configured.
  PAYMENT_PROVIDER: z.enum(["stripe", "fake"]).optional(),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_SINGLE: z.string().min(1).optional(),
  STRIPE_PRICE_PACK3: z.string().min(1).optional(),
  // Origem pública do web: monta success_url/cancel_url do checkout.
  APP_URL: z.string().url().default("http://localhost:3000"),

// requireWithProvider: providerField: "LLM_PROVIDER" | "EMAIL_PROVIDER" | "PAYMENT_PROVIDER"
// superRefine:
  requireWithProvider(env, ctx, "PAYMENT_PROVIDER", [
    "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "STRIPE_PRICE_SINGLE", "STRIPE_PRICE_PACK3"
  ]);

// domain-exception.filter.ts — STATUS_BY_CODE
  payment_required: HttpStatus.PAYMENT_REQUIRED,
  payment_not_configured: HttpStatus.SERVICE_UNAVAILABLE
```

- [ ] **Step 4: Verde.** - [ ] **Step 5: Commit** — `feat(api): envs de pagamento e status 402/503`

---

### Task 4: `CreditsService` — o núcleo

**Files:**
- Create: `apps/api/src/credits/credits.service.ts`, `credits.service.spec.ts`, `credits.module.ts`
- Modify: `apps/api/src/app.module.ts` (importa `CreditsModule`)

**Interfaces:**
- Consumes: `DB` (`apps/api/src/db/db.module.ts`), `users`, `trips` de `@farol/db`, `PaymentRequiredError` de `@farol/shared`.
- Produces:
  ```ts
  class CreditsService {
    unlock(userId: string, tripId: string): Promise<"already" | "free" | "credit">; // lança PaymentRequiredError
    release(tripId: string): Promise<void>;          // devolve o que a viagem consumiu
    grant(userId: string, credits: number): Promise<void>;
    revoke(userId: string, credits: number): Promise<void>; // greatest(0, …)
    summary(userId: string): Promise<{ credits: number; freeItineraryUsed: boolean }>;
  }
  ```

- [ ] **Step 1: Testes (banco real, como `itinerary.service.spec.ts`)**

```ts
// credits.service.spec.ts
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, runMigrations, users, trips } from "@farol/db";
import { PaymentRequiredError } from "@farol/shared";
import { CreditsService } from "./credits.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");
const { db, close } = createDbClient(url);
const service = new CreditsService(db);
const userIds: string[] = [];

async function makeUser(credits = 0): Promise<string> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test`, credits });
  return id;
}
async function makeTrip(userId: string): Promise<string> {
  const id = crypto.randomUUID();
  await db.insert(trips).values({ id, userId, originIata: "GRU" });
  return id;
}
async function userRow(id: string) {
  return (await db.select().from(users).where(eq(users.id, id)))[0]!;
}
async function tripRow(id: string) {
  return (await db.select().from(trips).where(eq(trips.id, id)))[0]!;
}

beforeAll(async () => { await runMigrations(url); });
afterEach(async () => {
  if (userIds.length) await db.delete(users).where(inArray(users.id, userIds.splice(0)));
});
afterAll(async () => { await close(); });

describe("unlock", () => {
  it("primeira viagem da conta é grátis e marca free_itinerary_used_at", async () => {
    const userId = await makeUser();
    const tripId = await makeTrip(userId);
    expect(await service.unlock(userId, tripId)).toBe("free");
    expect((await userRow(userId)).freeItineraryUsedAt).not.toBeNull();
    expect((await userRow(userId)).credits).toBe(0);
    const trip = await tripRow(tripId);
    expect(trip.unlockedVia).toBe("free");
    expect(trip.unlockedAt).not.toBeNull();
  });

  it("segunda viagem debita 1 crédito", async () => {
    const userId = await makeUser(2);
    await service.unlock(userId, await makeTrip(userId)); // grátis
    const tripId = await makeTrip(userId);
    expect(await service.unlock(userId, tripId)).toBe("credit");
    expect((await userRow(userId)).credits).toBe(1);
    expect((await tripRow(tripId)).unlockedVia).toBe("credit");
  });

  it("sem grátis e sem saldo lança PaymentRequiredError e não toca em nada", async () => {
    const userId = await makeUser(0);
    await service.unlock(userId, await makeTrip(userId));
    const tripId = await makeTrip(userId);
    await expect(service.unlock(userId, tripId)).rejects.toBeInstanceOf(PaymentRequiredError);
    expect((await tripRow(tripId)).unlockedAt).toBeNull();
    expect((await userRow(userId)).credits).toBe(0);
  });

  it("viagem já destravada não cobra de novo", async () => {
    const userId = await makeUser(1);
    const tripId = await makeTrip(userId);
    await service.unlock(userId, tripId); // grátis
    expect(await service.unlock(userId, tripId)).toBe("already");
    expect((await userRow(userId)).credits).toBe(1);
  });

  it("dois unlock simultâneos com saldo 1: um debita, o outro leva 402", async () => {
    const userId = await makeUser(1);
    await service.unlock(userId, await makeTrip(userId)); // grátis
    const [a, b] = await Promise.allSettled([
      service.unlock(userId, await makeTrip(userId)),
      service.unlock(userId, await makeTrip(userId))
    ]);
    const outcomes = [a, b].map((r) => r.status);
    expect(outcomes.sort()).toEqual(["fulfilled", "rejected"]);
    expect((await userRow(userId)).credits).toBe(0);
  });
});

describe("release", () => {
  it("devolve o crédito e limpa a viagem quando foi por crédito", async () => {
    const userId = await makeUser(1);
    await service.unlock(userId, await makeTrip(userId));
    const tripId = await makeTrip(userId);
    await service.unlock(userId, tripId);
    await service.release(tripId);
    expect((await userRow(userId)).credits).toBe(1);
    const trip = await tripRow(tripId);
    expect(trip.unlockedAt).toBeNull();
    expect(trip.unlockedVia).toBeNull();
  });

  it("devolve o grátis quando foi por grátis", async () => {
    const userId = await makeUser();
    const tripId = await makeTrip(userId);
    await service.unlock(userId, tripId);
    await service.release(tripId);
    expect((await userRow(userId)).freeItineraryUsedAt).toBeNull();
    expect((await userRow(userId)).credits).toBe(0);
  });

  it("viagem não destravada (ou inexistente) é no-op", async () => {
    const userId = await makeUser(3);
    const tripId = await makeTrip(userId);
    await service.release(tripId);
    await service.release(crypto.randomUUID());
    expect((await userRow(userId)).credits).toBe(3);
  });
});

describe("grant / revoke / summary", () => {
  it("grant soma e revoke nunca deixa negativo", async () => {
    const userId = await makeUser();
    await service.grant(userId, 3);
    await service.revoke(userId, 5);
    expect((await userRow(userId)).credits).toBe(0);
  });
  it("summary reflete saldo e grátis", async () => {
    const userId = await makeUser(2);
    expect(await service.summary(userId)).toEqual({ credits: 2, freeItineraryUsed: false });
    await service.unlock(userId, await makeTrip(userId));
    expect(await service.summary(userId)).toEqual({ credits: 2, freeItineraryUsed: true });
  });
});
```

- [ ] **Step 2: Falhar** — `doppler run -p farol -c dev -- pnpm --filter @farol/api exec vitest run --pool=threads src/credits`.

- [ ] **Step 3: Implementar**

```ts
// credits.service.ts
import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { trips, users, type Database } from "@farol/db";
import { PaymentRequiredError } from "@farol/shared";
import { DB } from "../db/db.module";

export type UnlockOutcome = "already" | "free" | "credit";

// Saldo, grátis e o gate (spec pagamento §5). Sem ledger: o UPDATE condicional
// é o lock — duas requisições com saldo 1 disputam a mesma linha e uma perde.
@Injectable()
export class CreditsService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async unlock(userId: string, tripId: string): Promise<UnlockOutcome> {
    return this.db.transaction(async (tx) => {
      const [trip] = await tx.select({ unlockedAt: trips.unlockedAt }).from(trips).where(eq(trips.id, tripId));
      if (trip?.unlockedAt) {
        return "already";
      }
      const free = await tx
        .update(users)
        .set({ freeItineraryUsedAt: sql`now()` })
        .where(and(eq(users.id, userId), isNull(users.freeItineraryUsedAt)))
        .returning({ id: users.id });
      if (free.length === 1) {
        await tx.update(trips).set({ unlockedAt: sql`now()`, unlockedVia: "free" }).where(eq(trips.id, tripId));
        return "free";
      }
      const paid = await tx
        .update(users)
        .set({ credits: sql`${users.credits} - 1` })
        .where(and(eq(users.id, userId), gte(users.credits, 1)))
        .returning({ id: users.id });
      if (paid.length === 0) {
        throw new PaymentRequiredError();
      }
      await tx.update(trips).set({ unlockedAt: sql`now()`, unlockedVia: "credit" }).where(eq(trips.id, tripId));
      return "credit";
    });
  }

  // Reserva agora, devolve se o job falhar em definitivo.
  async release(tripId: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [trip] = await tx
        .select({ userId: trips.userId, via: trips.unlockedVia })
        .from(trips)
        .where(eq(trips.id, tripId));
      if (!trip || trip.via === null) {
        return;
      }
      if (trip.via === "credit") {
        await tx.update(users).set({ credits: sql`${users.credits} + 1` }).where(eq(users.id, trip.userId));
      } else {
        await tx.update(users).set({ freeItineraryUsedAt: null }).where(eq(users.id, trip.userId));
      }
      await tx.update(trips).set({ unlockedAt: null, unlockedVia: null }).where(eq(trips.id, tripId));
    });
  }

  async grant(userId: string, credits: number): Promise<void> {
    await this.db.update(users).set({ credits: sql`${users.credits} + ${credits}` }).where(eq(users.id, userId));
  }

  // Estorno de créditos já gastos não volta do usuário: o saldo para no zero.
  async revoke(userId: string, credits: number): Promise<void> {
    await this.db
      .update(users)
      .set({ credits: sql`greatest(0, ${users.credits} - ${credits})` })
      .where(eq(users.id, userId));
  }

  async summary(userId: string): Promise<{ credits: number; freeItineraryUsed: boolean }> {
    const [row] = await this.db
      .select({ credits: users.credits, freeAt: users.freeItineraryUsedAt })
      .from(users)
      .where(eq(users.id, userId));
    return { credits: row?.credits ?? 0, freeItineraryUsed: row?.freeAt != null };
  }
}
```

```ts
// credits.module.ts
import { Global, Module } from "@nestjs/common";
import { CreditsService } from "./credits.service";

// Global: ItineraryModule, PaymentsModule e o worker usam o mesmo serviço.
@Global()
@Module({ providers: [CreditsService], exports: [CreditsService] })
export class CreditsModule {}
```

`app.module.ts`: importar `CreditsModule` logo depois de `DbModule`.

Nota sobre a corrida: o teste de `Promise.allSettled` passa porque as duas transações disputam a linha de `users` com `UPDATE … WHERE credits >= 1`; a segunda espera o lock e revê a condição com o valor já decrementado (READ COMMITTED). O `summary` com `row?.credits ?? 0` cobre usuário inexistente — testar esse ramo (`summary(crypto.randomUUID())` → `{ credits: 0, freeItineraryUsed: false }`) para a cobertura.

- [ ] **Step 4: Verde, cobertura 100%.** - [ ] **Step 5: Commit** — `feat(api): CreditsService — grátis, saldo, gate e devolução`

---

### Task 5: gate no roteiro + devolução no dead-letter

**Files:**
- Modify: `apps/api/src/itinerary/itinerary.service.ts` (+ `.spec.ts`), `apps/api/src/itinerary/itinerary-generate.handler.ts` (+ `.spec.ts`), `apps/api/src/jobs/job-queue.ts`, `apps/api/src/jobs/pgboss-queue.ts` (+ `.spec.ts`), `apps/api/src/jobs/register-handlers.ts` (+ `.spec.ts`), `apps/worker/src/worker.module.ts`, `apps/api/src/worker-exports.ts`

**Interfaces:**
- Consumes: `CreditsService.unlock/release`.
- Produces: `JobQueue.work<T>(name, handler, onDeadLetter?: (data: T) => Promise<void>)`; `ItineraryGenerateHandler.release(data: ItineraryGenerateData): Promise<void>`.

- [ ] **Step 1: Testes**

```ts
// itinerary.service.spec.ts — o construtor ganha o CreditsService real:
const credits = new CreditsService(db);
const service = new ItineraryService(repo, queue, tripsService, places, credits);

it("chooseDestination: a 1ª viagem passa de graça, a 2ª sem saldo responde payment_required e não enfileira", async () => {
  const userId = await makeUser();
  const first = await tripWithCandidate(userId);
  await service.chooseDestination(userId, first, "LIS");
  const second = await tripWithCandidate(userId);
  publish.mockClear();
  await expect(service.chooseDestination(userId, second, "LIS")).rejects.toMatchObject({ code: "payment_required" });
  expect(publish).not.toHaveBeenCalled();
});

it("chooseDestination: trocar o destino da mesma viagem não cobra de novo", async () => {
  const userId = await makeUser();
  const tripId = await tripWithCandidate(userId);
  await service.chooseDestination(userId, tripId, "LIS");
  await expect(service.chooseDestination(userId, tripId, "LIS")).resolves.toBeTruthy();
});

// itinerary-generate.handler.spec.ts
it("release devolve o que a viagem consumiu", async () => {
  const release = vi.fn().mockResolvedValue(undefined);
  const repo = { getById: vi.fn().mockResolvedValue({ id: "it-1", tripId: "trip-1", version: 1 }) };
  const handler = new ItineraryGenerateHandler(repo as never, llm, db, places, { release } as never);
  await handler.release({ itineraryId: "it-1" });
  expect(release).toHaveBeenCalledWith("trip-1");
});
it("release de itinerary inexistente é no-op", async () => {
  const release = vi.fn();
  const repo = { getById: vi.fn().mockResolvedValue(null) };
  const handler = new ItineraryGenerateHandler(repo as never, llm, db, places, { release } as never);
  await handler.release({ itineraryId: "nope" });
  expect(release).not.toHaveBeenCalled();
});

// pgboss-queue.spec.ts — junto dos testes de dead-letter existentes
it("work chama onDeadLetter para cada job que cai no DLQ", async () => {
  const onDeadLetter = vi.fn().mockResolvedValue(undefined);
  await queue.work("x", async () => { throw new Error("boom"); }, onDeadLetter);
  // publicar um job, esperar as retentativas esgotarem (retryLimit 0 no config do teste)
  // e afirmar onDeadLetter chamado com o data original.
});

// register-handlers.spec.ts
it("registra release do generate como onDeadLetter", async () => {
  // work é vi.fn(); afirmar que a chamada para itinerary.generate veio com 3º argumento
  expect(work).toHaveBeenCalledWith(JOB_NAMES.itineraryGenerate, expect.any(Function), expect.any(Function));
});
```

- [ ] **Step 2: Falhar.**

- [ ] **Step 3: Implementar**

```ts
// job-queue.ts
export interface JobQueue {
  publish<T extends object>(name: string, data: T): Promise<string>;
  // onDeadLetter roda quando o job esgota as retentativas: é o único lugar
  // que sabe que a falha foi definitiva (spec pagamento §5).
  work<T>(name: string, handler: (data: T) => Promise<void>, onDeadLetter?: (data: T) => Promise<void>): Promise<void>;
}

// pgboss-queue.ts — work()
    await this.boss.work<T>(deadLetterName(name), options, async (jobs) => {
      for (const job of jobs) {
        this.deadLetterLogger.warn({ name, jobId: job.id, data: job.data });
        await onDeadLetter?.(job.data);
      }
    });

// itinerary.service.ts — construtor ganha `private readonly credits: CreditsService`;
// em chooseDestination, depois da validação do candidato e ANTES de markChosen:
    // Gate de crédito: 1º roteiro da conta grátis, depois 1 crédito por viagem.
    // Antes de qualquer escrita — um 402 aqui não deixa rastro.
    await this.credits.unlock(userId, tripId);

// itinerary-generate.handler.ts — construtor ganha `private readonly credits: CreditsService`
  // Chamado pelo dead-letter: as retentativas acabaram, o roteiro não vai sair.
  async release(data: ItineraryGenerateData): Promise<void> {
    const itinerary = await this.repo.getById(data.itineraryId);
    if (itinerary) {
      await this.credits.release(itinerary.tripId);
    }
  }

// register-handlers.ts
  await queue.work<ItineraryGenerateData>(
    JOB_NAMES.itineraryGenerate,
    (data) => generate.handle(data),
    (data) => generate.release(data)
  );
```

`apps/worker/src/worker.module.ts`: acrescentar `CreditsService` aos `providers` (o worker não importa `ItineraryModule`); `worker-exports.ts`: exportar `CreditsService`. Conferir `apps/worker` typecheck + spec do módulo.

- [ ] **Step 4: Verde** (api + worker; `pnpm --filter @farol/api build` antes do worker, que lê o `dist`).

- [ ] **Step 5: Commit** — `feat(api): gate de crédito no chooseDestination e devolução no dead-letter`

---

### Task 6: porta de pagamento — `fake` e `stripe`

**Files:**
- Create: `apps/api/src/payments/payment.types.ts`, `fake-payment.provider.ts` (+ `.spec.ts`), `providers/stripe.provider.ts` (+ `.spec.ts`), `providers/__fixtures__/` (payloads)
- Modify: `apps/api/package.json` (`"stripe": "22.6.2"` em `dependencies`; `pnpm install`)

**Interfaces:**
- Produces:
  ```ts
  export const PAYMENT = Symbol("PAYMENT");
  export interface CheckoutRequest { orderId: string; userId: string; email: string; product: ProductId; successUrl: string; cancelUrl: string }
  export type PaymentEvent =
    | { id: string; type: "paid"; sessionId: string; paymentIntent: string | null }
    | { id: string; type: "expired"; sessionId: string }
    | { id: string; type: "refunded"; paymentIntent: string }
    | { id: string; type: "ignored" };
  export interface PaymentProvider {
    createCheckout(input: CheckoutRequest): Promise<{ url: string; sessionId: string }>;
    parseWebhook(rawBody: Buffer, signature: string): Promise<PaymentEvent>; // lança PaymentSignatureError
  }
  export class PaymentSignatureError extends ValidationError {}
  ```

- [ ] **Step 1: Testes**

```ts
// fake-payment.provider.spec.ts
it("createCheckout devolve url de sucesso do app com sessionId previsível", async () => {
  const p = new FakePaymentProvider();
  const r = await p.createCheckout({ orderId: "o-1", userId: "u", email: "e@x", product: "single", successUrl: "http://app/ok", cancelUrl: "http://app/no" });
  expect(r).toEqual({ url: "http://app/ok", sessionId: "fake_cs_o-1" });
});
it("parseWebhook aceita JSON assinado com 'fake' e recusa outra assinatura", async () => {
  const p = new FakePaymentProvider();
  const body = Buffer.from(JSON.stringify({ id: "evt_1", type: "paid", sessionId: "fake_cs_o-1", paymentIntent: null }));
  await expect(p.parseWebhook(body, "fake")).resolves.toEqual({ id: "evt_1", type: "paid", sessionId: "fake_cs_o-1", paymentIntent: null });
  await expect(p.parseWebhook(body, "nope")).rejects.toBeInstanceOf(PaymentSignatureError);
});

// stripe.provider.spec.ts — Stripe é instanciado com um stub em `stripe.checkout.sessions.create`
// e a assinatura vem de `Stripe.webhooks.generateTestHeaderString` (offline).
const secret = "whsec_test";
function signed(payload: object) {
  const body = JSON.stringify(payload);
  return { body: Buffer.from(body), sig: Stripe.webhooks.generateTestHeaderString({ payload: body, secret }) };
}
it("createCheckout monta a Session com price, metadata, consent e descriptor", async () => {
  const create = vi.fn().mockResolvedValue({ id: "cs_1", url: "https://checkout.stripe.com/x" });
  const p = new StripePaymentProvider({ checkout: { sessions: { create } } } as never, { webhookSecret: secret, prices: { single: "price_s", pack3: "price_p" } });
  const r = await p.createCheckout({ orderId: "o-1", userId: "u-1", email: "e@x", product: "pack3", successUrl: "http://ok", cancelUrl: "http://no" });
  expect(r).toEqual({ url: "https://checkout.stripe.com/x", sessionId: "cs_1" });
  expect(create).toHaveBeenCalledWith(expect.objectContaining({
    mode: "payment",
    line_items: [{ price: "price_p", quantity: 1 }],
    client_reference_id: "u-1",
    customer_email: "e@x",
    metadata: { orderId: "o-1" },
    consent_collection: { terms_of_service: "required" },
    payment_intent_data: { statement_descriptor_suffix: "FAROL" }
  }));
});
it("session sem url é erro (a Stripe pode devolver null)", …);
it("parseWebhook: checkout.session.completed pago vira paid", async () => {
  const { body, sig } = signed({ id: "evt_1", type: "checkout.session.completed", data: { object: { id: "cs_1", payment_status: "paid", payment_intent: "pi_1" } } });
  await expect(p.parseWebhook(body, sig)).resolves.toEqual({ id: "evt_1", type: "paid", sessionId: "cs_1", paymentIntent: "pi_1" });
});
it("completed sem pagamento (boleto pendente) é ignored", …);
it("checkout.session.expired vira expired", …);
it("charge.refunded vira refunded com o payment_intent", …);
it("charge.refunded sem payment_intent é ignored", …);
it("evento desconhecido é ignored", …);
it("assinatura inválida lança PaymentSignatureError", …);
```

(Os `…` acima são casos do mesmo formato do primeiro — payload em `signed(...)` e `toEqual` no evento normalizado. Escrever todos; a cobertura exige cada ramo.)

- [ ] **Step 2: Falhar.**

- [ ] **Step 3: Implementar**

```ts
// payment.types.ts
import { ValidationError, type ProductId } from "@farol/shared";
export const PAYMENT = Symbol("PAYMENT");
export interface CheckoutRequest { /* como acima */ }
export type PaymentEvent = /* como acima */;
export interface PaymentProvider { /* como acima */ }
// Assinatura que não bate é 400: a Stripe não reenvia 4xx… mas também não
// deveria mandar assinatura errada. Quem manda é alguém que não é a Stripe.
export class PaymentSignatureError extends ValidationError {
  constructor() { super("assinatura do webhook inválida"); }
}

// fake-payment.provider.ts
export class FakePaymentProvider implements PaymentProvider {
  async createCheckout(input: CheckoutRequest) {
    return { url: input.successUrl, sessionId: `fake_cs_${input.orderId}` };
  }
  async parseWebhook(rawBody: Buffer, signature: string): Promise<PaymentEvent> {
    if (signature !== "fake") throw new PaymentSignatureError();
    return JSON.parse(rawBody.toString("utf8")) as PaymentEvent;
  }
}

// providers/stripe.provider.ts
import Stripe from "stripe";
type Sessions = Pick<Stripe.Checkout.SessionsResource, "create">;
export interface StripeConfig { webhookSecret: string; prices: Record<ProductId, string> }
export class StripePaymentProvider implements PaymentProvider {
  constructor(private readonly stripe: { checkout: { sessions: Sessions } }, private readonly config: StripeConfig) {}
  static fromEnv(env: Env): StripePaymentProvider {
    return new StripePaymentProvider(new Stripe(env.STRIPE_SECRET_KEY!), {
      webhookSecret: env.STRIPE_WEBHOOK_SECRET!,
      prices: { single: env.STRIPE_PRICE_SINGLE!, pack3: env.STRIPE_PRICE_PACK3! }
    });
  }
  async createCheckout(input: CheckoutRequest) {
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: this.config.prices[input.product], quantity: 1 }],
      client_reference_id: input.userId,
      customer_email: input.email,
      metadata: { orderId: input.orderId },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      consent_collection: { terms_of_service: "required" },
      payment_intent_data: { statement_descriptor_suffix: "FAROL" }
    });
    if (!session.url) throw new Error("a Stripe não devolveu a url do checkout");
    return { url: session.url, sessionId: session.id };
  }
  async parseWebhook(rawBody: Buffer, signature: string): Promise<PaymentEvent> {
    let event: Stripe.Event;
    try {
      event = Stripe.webhooks.constructEvent(rawBody, signature, this.config.webhookSecret);
    } catch {
      throw new PaymentSignatureError();
    }
    return normalize(event);
  }
}
function intentId(pi: string | Stripe.PaymentIntent | null | undefined): string | null {
  return typeof pi === "string" ? pi : (pi?.id ?? null);
}
export function normalize(event: Stripe.Event): PaymentEvent {
  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object;
      return s.payment_status === "paid"
        ? { id: event.id, type: "paid", sessionId: s.id, paymentIntent: intentId(s.payment_intent) }
        : { id: event.id, type: "ignored" };
    }
    case "checkout.session.expired":
      return { id: event.id, type: "expired", sessionId: event.data.object.id };
    case "charge.refunded": {
      const pi = intentId(event.data.object.payment_intent);
      return pi === null ? { id: event.id, type: "ignored" } : { id: event.id, type: "refunded", paymentIntent: pi };
    }
    default:
      return { id: event.id, type: "ignored" };
  }
}
```

`constructEvent` é estático em `Stripe.webhooks` — não precisa de chave de API, por isso o teste roda offline. O `id` do `ignored` é guardado em `webhook_events` igual (Task 7).

- [ ] **Step 4: Verde.** - [ ] **Step 5: Commit** — `feat(api): porta de pagamento com providers fake e stripe`

---

### Task 7: `PaymentsModule` — checkout, `/me`, webhook

**Files:**
- Create: `apps/api/src/payments/payments.service.ts` (+ `.spec.ts`), `payments.controller.ts` (+ `.spec.ts`), `payments.module.ts` (+ `.spec.ts`), `apps/api/test/payments.e2e-spec.ts`
- Modify: `apps/api/src/main.ts` (`NestFactory.create(AppModule, { rawBody: true })`), `apps/api/src/app.module.ts`, `apps/api/test/setup-e2e.ts` (`PAYMENT_PROVIDER ??= "fake"`), `apps/api/test/support/fake-providers.ts` (se precisar)

**Interfaces:**
- Consumes: `PAYMENT`/`PaymentProvider`, `CreditsService`, `orders`, `webhookEvents`, `PRODUCTS`, `Env.APP_URL`.
- Produces:
  ```ts
  class PaymentsService {
    checkout(user: CurrentUser, product: ProductId): Promise<CheckoutResult>;  // 503 sem provider
    me(userId: string): Promise<PaymentMe>;
    applyWebhook(rawBody: Buffer, signature: string): Promise<void>;
  }
  ```
  Rotas: `POST /payments/checkout` (201 `{url}`), `GET /payments/me`, `POST /payments/webhook` (`@Public`, 200).

- [ ] **Step 1: Testes** — `payments.service.spec.ts` com banco real + `FakePaymentProvider`:

```ts
it("checkout cria order pending com o preço do produto e devolve a url", …);
it("checkout sem provider lança PaymentNotConfiguredError", …);   // service construído com provider null
it("me devolve saldo, grátis e orders do mais novo para o mais velho", …);
it("webhook paid: order → paid, paid_at, payment_intent, credits += 3", …);
it("webhook paid duas vezes (replay) credita uma vez só", …);
it("webhook paid de order já paga (id de evento novo) não credita de novo", …);
it("webhook expired: pending → expired; paid não muda", …);
it("webhook refunded: paid → refunded e credits = greatest(0, credits - n)", …);
it("webhook refunded antes de paid é no-op no saldo", …);
it("webhook refunded com payment_intent desconhecido só registra o evento", …);
it("webhook ignored só registra o evento", …);
it("assinatura inválida lança e não grava evento", …);
```

Cada caso: cria user + order via `checkout`, monta o `PaymentEvent` como JSON, chama `applyWebhook(Buffer.from(JSON.stringify(evt)), "fake")` e confere `users.credits`, `orders.status` e `webhookEvents`.

- [ ] **Step 2: Falhar.**

- [ ] **Step 3: Implementar**

```ts
// payments.service.ts
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(PAYMENT) private readonly provider: PaymentProvider | null,
    @Inject(ENV) private readonly env: Env,
    private readonly credits: CreditsService
  ) {}

  async checkout(user: CurrentUser, product: ProductId): Promise<CheckoutResult> {
    if (this.provider === null) throw new PaymentNotConfiguredError();
    const orderId = crypto.randomUUID();
    const { credits, amountCents } = PRODUCTS[product];
    // A order nasce antes da Session: o webhook precisa de algo para achar.
    // provider_session_id provisório = orderId, trocado logo abaixo.
    await this.db.insert(orders).values({ id: orderId, userId: user.id, providerSessionId: orderId, product, credits, amountCents, status: "pending" });
    const { url, sessionId } = await this.provider.createCheckout({
      orderId, userId: user.id, email: user.email, product,
      successUrl: `${this.env.APP_URL}/payment/success`,
      cancelUrl: `${this.env.APP_URL}/payment/cancelled`
    });
    await this.db.update(orders).set({ providerSessionId: sessionId }).where(eq(orders.id, orderId));
    return { url };
  }

  async me(userId: string): Promise<PaymentMe> {
    const summary = await this.credits.summary(userId);
    const rows = await this.db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt));
    return { ...summary, orders: rows.map((r) => ({ id: r.id, product: r.product as ProductId, credits: r.credits, amountCents: r.amountCents, status: r.status as OrderStatus, createdAt: r.createdAt.toISOString() })) };
  }

  async applyWebhook(rawBody: Buffer, signature: string): Promise<void> {
    if (this.provider === null) throw new PaymentNotConfiguredError();
    const event = await this.provider.parseWebhook(rawBody, signature);
    await this.db.transaction(async (tx) => {
      const seen = await tx.insert(webhookEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: webhookEvents.id });
      if (seen.length === 0) return; // replay
      if (event.type === "paid") await this.onPaid(tx, event);
      else if (event.type === "expired") await tx.update(orders).set({ status: "expired" }).where(and(eq(orders.providerSessionId, event.sessionId), eq(orders.status, "pending")));
      else if (event.type === "refunded") await this.onRefunded(tx, event);
    });
  }

  private async onPaid(tx: Tx, event: Extract<PaymentEvent, { type: "paid" }>) {
    // "só se estava pending" torna o handler seguro fora de ordem e contra
    // evento novo para order já paga.
    const [order] = await tx.update(orders)
      .set({ status: "paid", paidAt: sql`now()`, providerPaymentIntent: event.paymentIntent })
      .where(and(eq(orders.providerSessionId, event.sessionId), eq(orders.status, "pending")))
      .returning({ userId: orders.userId, credits: orders.credits });
    if (order) await tx.update(users).set({ credits: sql`${users.credits} + ${order.credits}` }).where(eq(users.id, order.userId));
  }

  private async onRefunded(tx: Tx, event: Extract<PaymentEvent, { type: "refunded" }>) {
    const [order] = await tx.update(orders)
      .set({ status: "refunded" })
      .where(and(eq(orders.providerPaymentIntent, event.paymentIntent), eq(orders.status, "paid")))
      .returning({ userId: orders.userId, credits: orders.credits });
    if (order) await tx.update(users).set({ credits: sql`greatest(0, ${users.credits} - ${order.credits})` }).where(eq(users.id, order.userId));
  }
}
```

(`Tx` = `Parameters<Parameters<Database["transaction"]>[0]>[0]`. O `grant/revoke` do `CreditsService` não são usados aqui de propósito: o crédito tem que entrar na **mesma transação** do `webhook_events`, senão um crash entre os dois perde dinheiro. `grant/revoke` ficam para uso operacional; se sobrarem sem uso ao final, **remover** — YAGNI.)

```ts
// payments.controller.ts
@Controller("payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("checkout") @HttpCode(201)
  checkout(@CurrentUser() user: CurrentUserType, @Body(new ZodValidationPipe(checkoutInputSchema)) body: CheckoutInput) {
    return this.payments.checkout(user, body.product);
  }

  @Get("me")
  me(@CurrentUser() user: CurrentUserType) { return this.payments.me(user.id); }

  // Público: quem chama é a Stripe, e a credencial é a assinatura do corpo cru.
  @Public() @Post("webhook") @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers("stripe-signature") signature = "") {
    await this.payments.applyWebhook(req.rawBody ?? Buffer.alloc(0), signature);
    return { received: true };
  }
}

// payments.module.ts
export function buildPayment(env: Env): PaymentProvider | null {
  if (env.PAYMENT_PROVIDER === "fake") return new FakePaymentProvider();
  if (env.PAYMENT_PROVIDER === undefined) return null;
  return StripePaymentProvider.fromEnv(env);
}
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, { provide: PAYMENT, inject: [ENV], useFactory: buildPayment }]
})
export class PaymentsModule {}
```

`main.ts`: `NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true })`. Nos e2e: `mod.createNestApplication({ rawBody: true })`.

- [ ] **Step 4: E2E** — `apps/api/test/payments.e2e-spec.ts` (mesmo harness de `itinerary.e2e-spec.ts`, JWKS fake, `PAYMENT_PROVIDER=fake` via `setup-e2e.ts`):

```ts
it("fluxo inteiro: 1ª viagem grátis → 2ª 402 → checkout → webhook → 2ª gera e debita", async () => {
  const u = await newUser();
  const t1 = await tripWithCandidate(u.auth);
  expect((await request(app.getHttpServer()).post(`/trips/${t1}/destination`).set("Authorization", u.auth).send({ iata: "LIS" })).status).toBe(202); // ou o status atual da rota
  const t2 = await tripWithCandidate(u.auth);
  const denied = await request(app.getHttpServer()).post(`/trips/${t2}/destination`).set("Authorization", u.auth).send({ iata: "LIS" });
  expect(denied.status).toBe(402);
  expect(denied.body.code).toBe("payment_required");

  const co = await request(app.getHttpServer()).post("/payments/checkout").set("Authorization", u.auth).send({ product: "single" });
  expect(co.status).toBe(201);
  expect(co.body.url).toContain("/payment/success");
  const me1 = await request(app.getHttpServer()).get("/payments/me").set("Authorization", u.auth);
  const sessionId = `fake_cs_${me1.body.orders[0].id}`;

  const evt = { id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId, paymentIntent: "pi_e2e" };
  const wh = await request(app.getHttpServer()).post("/payments/webhook").set("stripe-signature", "fake").set("content-type", "application/json").send(evt);
  expect(wh.status).toBe(200);
  const again = await request(app.getHttpServer()).post("/payments/webhook").set("stripe-signature", "fake").send(evt);
  expect(again.status).toBe(200);

  const me2 = await request(app.getHttpServer()).get("/payments/me").set("Authorization", u.auth);
  expect(me2.body).toMatchObject({ credits: 1, freeItineraryUsed: true });
  expect(me2.body.orders[0].status).toBe("paid");

  const ok = await request(app.getHttpServer()).post(`/trips/${t2}/destination`).set("Authorization", u.auth).send({ iata: "LIS" });
  expect(ok.status).not.toBe(402);
  const me3 = await request(app.getHttpServer()).get("/payments/me").set("Authorization", u.auth);
  expect(me3.body.credits).toBe(0);
});
it("webhook com assinatura errada responde 400", …);
it("webhook e /payments/me sem token: webhook passa (público), me dá 401", …);
```

Conferir o status real de `POST /trips/:id/destination` em `itinerary.controller.ts` antes de escrever o `expect`.

- [ ] **Step 5: Verde** (`pnpm --filter @farol/api test`, `test:e2e`, `lint`, `typecheck`). - [ ] **Step 6: Commit** — `feat(api): PaymentsModule — checkout, /me e webhook idempotente`

---

### Task 8: web — cliente, selo de créditos, tratamento do 402

**Files:**
- Create: `apps/web/src/lib/payments-api.ts` (+ `.spec.ts`), `apps/web/src/lib/payment-required.ts` (+ `.spec.ts`), `apps/web/src/components/common/CreditsBadge.tsx` (+ `.spec.tsx`), `apps/web/src/components/common/credits-badge.css`
- Modify: `apps/web/src/app/trips/page.tsx` (selo no header), `apps/web/src/components/TripShell.tsx` (selo no `side__account`), `apps/web/src/app/trips/[id]/discovery/page.tsx` e `apps/web/src/app/auto/page.tsx` (402 → `/credits`)

**Interfaces:**
- Produces: `getPaymentMe(token): Promise<PaymentMe>`, `startCheckout(token, product): Promise<CheckoutResult>`, `isPaymentRequired(err: unknown): boolean` (ApiError 402), `creditsRoute(returnTo: string): string` (`/credits?returnTo=<encoded>`), `<CreditsBadge token />`.

- [ ] **Step 1: Testes** — `payments-api.spec.ts` no molde de `route-api.spec.ts` (fetch fake, confere path/método/body e parse); `payment-required.spec.ts` (`isPaymentRequired(new ApiError("x", 402, "/p"))` true, 404 false, `Error` false; `creditsRoute("/trips/1/discovery")` → `/credits?returnTo=%2Ftrips%2F1%2Fdiscovery`); `CreditsBadge.spec.tsx` (RTL): com `freeItineraryUsed=false` mostra "1ª viagem por nossa conta"; com `credits=2` mostra "2 créditos"; `credits=1` → "1 crédito"; `0` → "0 créditos" com classe `--empty`; erro de rede → não renderiza nada (sem quebrar a tela).

- [ ] **Step 2: Falhar.** - [ ] **Step 3: Implementar** (`CreditsBadge` é um `<Link href="/credits">` com o texto; busca `/payments/me` num `useEffect`, estado `PaymentMe | null`). Nos dois pontos de `chooseDestination` no web:

```ts
} catch (cause) {
  if (isPaymentRequired(cause)) {
    router.push(creditsRoute(pathname));  // usePathname()
    return;
  }
  setError(…);
}
```

- [ ] **Step 4: Verde** (`pnpm --filter @farol/web test`, `lint`, `typecheck`). - [ ] **Step 5: Commit** — `feat(web): selo de créditos e 402 → /credits`

---

### Task 9: web — `/credits`, `/payment/success`, `/payment/cancelled`, landing

**Files:**
- Create: `apps/web/src/app/credits/page.tsx`, `creditos.css`, `apps/web/src/app/payment/success/page.tsx`, `apps/web/src/app/payment/cancelled/page.tsx`, `apps/web/src/lib/return-to.ts` (+ `.spec.ts`), `apps/web/src/hooks/useCreditsPolling.ts` (+ `.spec.ts`), `apps/web/e2e/payments.spec.ts`
- Modify: `apps/web/src/app/page.tsx` (coluna Grátis)

**Interfaces:**
- Produces: `saveReturnTo(path)` / `takeReturnTo(): string` (sessionStorage, default `/trips`); `useCreditsPolling(token, baseline: number, { every: 2000, timeout: 60000 })` → `"waiting" | "done" | "timeout"`.

- [ ] **Step 1: Testes** — `return-to.spec.ts` (guarda/lê/limpa; sem valor → `/trips`; só aceita caminho relativo começando com `/`, senão `/trips` — evita open redirect); `useCreditsPolling.spec.ts` com timers falsos (`vi.useFakeTimers`): `done` quando `credits > baseline`, `timeout` depois de 60 s, para de chamar depois de resolver.

- [ ] **Step 2: Falhar.** - [ ] **Step 3: Implementar**

`/credits` (client, dentro de `AuthGate`, `BrandHeader href="/trips"`):
- lê `returnTo` da query e chama `saveReturnTo`;
- título "Sua primeira viagem foi por nossa conta." / sub "As próximas custam menos que um café por dia de roteiro — e você só paga pela viagem que montar.";
- dois cards `<article>`: **1 viagem · R$ 39** e **3 viagens · R$ 89** ("sem prazo para usar"), cada um listando "destino com o porquê", "roteiro dia a dia", "ajustes por conversa", "voo e hotel"; botão "Comprar" → `startCheckout` → `window.location.assign(url)`; erro `payment_not_configured` (503) → "A compra ainda não está aberta — te avisamos por e-mail." sem botão de retry;
- rodapé: "Arrependeu? Reembolso integral em até 7 dias, se o crédito não foi usado." + links `/terms` e `/privacy`.

`/payment/success`: `AuthGate`; guarda o `credits` do primeiro `/payments/me` como baseline… **não** — o baseline tem que vir de antes do checkout. Simplificar: `saveReturnTo` já guarda; em `/credits`, antes de redirecionar para a Stripe, guardar `sessionStorage.farol_credits_before = credits`. Em sucesso: `useCreditsPolling(token, before)`; `done` → `router.replace(takeReturnTo())`; `timeout` → texto "O pagamento foi aprovado e o crédito aparece em instantes." + botão para `/trips`.

`/payment/cancelled`: uma frase + `router.replace(takeReturnTo())` no clique.

Landing: `<small>Sua primeira viagem, completa: destino, roteiro e ajustes por conversa.</small>` no lugar de "Uma viagem, um destino, modo autônomo. Sem chat."

- [ ] **Step 4: Playwright** — `apps/web/e2e/payments.spec.ts` com `installSession` e `page.route`:
  - `/trips` mostra "1ª viagem por nossa conta" quando `/payments/me` devolve `freeItineraryUsed:false`; mostra "2 créditos" quando `credits:2`;
  - discovery: `POST /trips/:id/destination` mockado com 402 `{code:"payment_required"}` → URL vira `/credits?returnTo=…`;
  - `/credits`: clicar "Comprar" no card de 3 viagens chama `POST /payments/checkout` com `{product:"pack3"}` e navega para a `url` devolvida (mockar para `/payment/success`);
  - `/payment/success`: `/payments/me` devolve `credits:3` → redireciona para o `returnTo`.

- [ ] **Step 5: Verde** (`pnpm --filter @farol/web test`, `test:e2e`). - [ ] **Step 6: Commit** — `feat(web): telas de créditos e retorno do checkout`

---

### Task 10: legal — textos e páginas `/terms` e `/privacy`

**Files:**
- Modify: `docs/legal/termos-de-uso.md` (§5.1, §5.2, §5.3, §6), `docs/legal/politica-de-privacidade.md` (Stripe sem colchetes; controladora), `docs/legal/README.md` (onde publica → feito)
- Create: `apps/web/src/app/terms/page.tsx`, `apps/web/src/app/privacy/page.tsx`, `apps/web/src/app/legal.css`, `apps/web/src/types/md.d.ts`, `apps/web/e2e/legal.spec.ts`
- Modify: `apps/web/next.config.mjs` (regra webpack `{ test: /\.md$/, type: "asset/source" }`), `apps/web/package.json` (`marked`), `apps/web/src/app/page.tsx` (rodapé com os links), `apps/web/src/app/login/page.tsx` (linha "Ao entrar você concorda com os Termos")

- [ ] **Step 1: Textos** — §5.1 vira: "**Plano gratuito.** O primeiro roteiro da sua conta é por nossa conta, em qualquer modo (assessor ou autônomo), com tudo incluído. Uso único por conta." §5.2: tirar "(modo assessor: …)"; "Cada crédito destrava o roteiro completo de uma viagem". §6: acrescentar "Créditos já utilizados não são reembolsados; o estorno devolve apenas os créditos não usados daquela compra." e "O aceite destes Termos é registrado pela Stripe no momento do pagamento." Trocar `[Stripe]` → Stripe nos dois documentos. Cabeçalho dos dois: operador = **isTech** (razão social/CNPJ/endereço seguem `[ENTRE COLCHETES]` até o Rafael preencher — não inventar).

- [ ] **Step 2: Páginas**

```ts
// apps/web/src/types/md.d.ts
declare module "*.md" { const content: string; export default content; }

// next.config.mjs — dentro de webpack(config) { config.module.rules.push({ test: /\.md$/, type: "asset/source" }); return config; }

// apps/web/src/app/terms/page.tsx (server component)
import { marked } from "marked";
import termos from "../../../../../docs/legal/termos-de-uso.md";
import "../legal.css";
export const metadata = { title: "Termos de Uso — Farol" };
export default function TermosPage() {
  return <main className="legal" dangerouslySetInnerHTML={{ __html: marked.parse(termos) as string }} />;
}
```

Idem `privacidade`. O markdown é nosso (repo), não entrada de usuário — o `dangerouslySetInnerHTML` é aceitável e comentado.

- [ ] **Step 3: Playwright** — `legal.spec.ts`: `/terms` responde 200 e contém "Termos de Uso" e "7 (sete) dias"; `/privacy` contém "Política de Privacidade"; a landing tem links para os dois no rodapé.

- [ ] **Step 4: Verde.** - [ ] **Step 5: Commit** — `feat(web): Termos e Privacidade publicados; textos alinhados ao pagamento`

---

### Task 11: infra — envs, Stripe sandbox, Doppler, Render, docs

**Files:**
- Modify: `.github/workflows/ci.yml` (`PAYMENT_PROVIDER: fake`), `.env.example` (nomes novos), `docs/SETUP.md` (seção "Pagamento: sandbox da Stripe + `stripe listen`"), `CLAUDE.md` (Passo 11 → ✅ ao mergear; nota em "Decisões"; `docs/superpowers/specs/2026-09-15-…` na tabela de documentos)

- [ ] **Step 1: Stripe sandbox (MCP, `acct_1Ro8TSGKqrFCwn62`, `livemode: false`)** — criar `Product` "Farol · 1 viagem" com `default_price_data { currency: "brl", unit_amount: 3900 }` e "Farol · 3 viagens" (8900); arquivar `prod_SjcaLH5cHJLnMH`, `prod_SjbldWMwXqiR1Q`, `prod_Sjbl5HOw8vLlEX` (`active: false`); criar `WebhookEndpoint` `https://farol-ekk3.onrender.com/api/payments/webhook` com `enabled_events: ["checkout.session.completed","checkout.session.expired","charge.refunded"]` — a resposta traz o `secret` **uma vez**: gravar direto no Doppler `prd` via stdin, nunca no chat.

- [ ] **Step 2: Doppler** — `dev`: `PAYMENT_PROVIDER=stripe`, `STRIPE_PRICE_SINGLE`, `STRIPE_PRICE_PACK3`, `STRIPE_SECRET_KEY` (**Rafael** copia a chave secreta de teste `sk_test_…` do dashboard — a API não a devolve), `STRIPE_WEBHOOK_SECRET` do `stripe listen` local, `APP_URL=http://localhost:3000`. `prd`: os mesmos com o secret do endpoint do Render e `APP_URL=https://farol-ekk3.onrender.com`. Sempre `--silent`.

- [ ] **Step 3: Render** — espelhar `prd` chave a chave via `mcp__render__update_environment_variables`; conferir invariante.

- [ ] **Step 4: CI/docs** — `ci.yml` `env:` ganha `PAYMENT_PROVIDER: fake`; `.env.example` lista as 6 envs; `docs/SETUP.md` explica `stripe listen --forward-to localhost:3333/api/payments/webhook` e o cartão de teste `4242 4242 4242 4242`.

- [ ] **Step 5: Commit** — `chore(payments): envs, sandbox da Stripe e docs`

---

### Task 12: fechar — CI local, PR, teste manual no sandbox

- [ ] `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm --filter @farol/api test:e2e && pnpm --filter @farol/web test:e2e` — tudo verde.
- [ ] `pnpm test:mutation` nos pacotes tocados (`shared`, `api`, `web`); ≥ 90.
- [ ] Push + PR para `main` com o resumo da spec e os prints do checkout no sandbox.
- [ ] Depois do deploy: com o usuário de QA, 1ª viagem grátis → 2ª leva a `/credits` → cartão `4242…` no Checkout da Stripe → `/payment/success` → saldo 1 → 2ª viagem gera. Estorno pelo painel → webhook → saldo volta a 0 (se não usado).
- [ ] `CLAUDE.md`: Passo 11 → ✅ concluído.

---

## Self-review

- **Cobertura da spec:** §1 (escopo) T1–T10 · §3 (dados) T2 · §4 (porta/env) T3, T6 · §5 (gate/devolução) T4, T5 · §6 (API/webhook) T7 · §7 (front) T8, T9 · §8 (legal) T10 · §9 (Stripe) T11 · §10 (testes) em cada task · §11 (ordem) = ordem das tasks.
- **Desvio da spec, de propósito:** `charge.refunded` casa pela `provider_payment_intent` guardada no `paid` (coluna nova em `orders`), em vez de consultar `checkout.sessions.list` na Stripe — sem chamada de rede no webhook, e testável offline. Atualizar §3/§4 da spec no commit da Task 2.
- **Tipos consistentes:** `PaymentEvent.refunded` carrega `paymentIntent` (T6) e `onRefunded` filtra por ele (T7); `unlock` devolve `"already" | "free" | "credit"` (T4) e `chooseDestination` só chama (T5); `PaymentMe` (T1) é o que `/payments/me` devolve (T7) e o que `CreditsBadge` lê (T8).
