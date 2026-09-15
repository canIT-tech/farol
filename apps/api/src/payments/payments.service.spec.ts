import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, runMigrations, orders, users, webhookEvents } from "@farol/db";
import { PaymentNotConfiguredError, type CurrentUser } from "@farol/shared";
import type { Env } from "../config/env.schema";
import { CreditsService } from "../credits/credits.service";
import { FakePaymentProvider } from "./fake-payment.provider";
import type { PaymentEvent } from "./payment.types";
import { PaymentsService } from "./payments.service";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const env = { APP_URL: "http://app.test" } as Env;
const credits = new CreditsService(db);
const service = new PaymentsService(db, new FakePaymentProvider(), env, credits);
const disabled = new PaymentsService(db, null, env, credits);

const userIds: string[] = [];
const eventIds: string[] = [];

async function makeUser(): Promise<CurrentUser> {
  const id = crypto.randomUUID();
  userIds.push(id);
  await db.insert(users).values({ id, email: `${id}@farol.test` });
  return { id, email: `${id}@farol.test` };
}

async function creditsOf(userId: string): Promise<number> {
  return (await db.select({ credits: users.credits }).from(users).where(eq(users.id, userId)))[0]!
    .credits;
}

async function orderOf(userId: string) {
  return (await db.select().from(orders).where(eq(orders.userId, userId)))[0]!;
}

function webhook(event: PaymentEvent): Promise<void> {
  eventIds.push(event.id);
  return service.applyWebhook(Buffer.from(JSON.stringify(event)), "fake");
}

const evt = (over: Partial<PaymentEvent> & { type: PaymentEvent["type"] }): PaymentEvent =>
  ({ id: `evt_${crypto.randomUUID()}`, ...over }) as PaymentEvent;

beforeAll(async () => {
  await runMigrations(url);
});

afterEach(async () => {
  if (eventIds.length > 0) {
    await db.delete(webhookEvents).where(inArray(webhookEvents.id, eventIds.splice(0)));
  }
  if (userIds.length > 0) {
    await db.delete(users).where(inArray(users.id, userIds.splice(0)));
  }
});

afterAll(async () => {
  await close();
});

describe("checkout", () => {
  it("cria a order pending com o preço do produto e devolve a url", async () => {
    const user = await makeUser();
    const result = await service.checkout(user, "pack3");

    expect(result).toEqual({ url: "http://app.test/pagamento/sucesso" });
    const order = await orderOf(user.id);
    expect(order).toMatchObject({
      product: "pack3",
      credits: 3,
      amountCents: 8900,
      status: "pending",
      providerSessionId: `fake_cs_${order.id}`,
      providerPaymentIntent: null,
      paidAt: null
    });
  });

  it("sem provider lança PaymentNotConfiguredError", async () => {
    const user = await makeUser();
    await expect(disabled.checkout(user, "single")).rejects.toBeInstanceOf(PaymentNotConfiguredError);
    await expect(disabled.applyWebhook(Buffer.alloc(0), "fake")).rejects.toBeInstanceOf(
      PaymentNotConfiguredError
    );
  });
});

describe("me", () => {
  it("devolve saldo, grátis e as orders da mais nova para a mais velha", async () => {
    const user = await makeUser();
    await service.checkout(user, "single");
    await new Promise((r) => setTimeout(r, 5));
    await service.checkout(user, "pack3");

    const me = await service.me(user.id);
    expect(me.credits).toBe(0);
    expect(me.freeItineraryUsed).toBe(false);
    expect(me.orders.map((o) => o.product)).toEqual(["pack3", "single"]);
    expect(me.orders[0]).toMatchObject({ credits: 3, amountCents: 8900, status: "pending" });
    expect(typeof me.orders[0]!.createdAt).toBe("string");
  });
});

describe("applyWebhook", () => {
  it("paid: order → paid com payment_intent, e o saldo sobe", async () => {
    const user = await makeUser();
    await service.checkout(user, "pack3");
    const order = await orderOf(user.id);

    await webhook(evt({ type: "paid", sessionId: order.providerSessionId, paymentIntent: "pi_1" }));

    expect(await creditsOf(user.id)).toBe(3);
    const paid = await orderOf(user.id);
    expect(paid.status).toBe("paid");
    expect(paid.providerPaymentIntent).toBe("pi_1");
    expect(paid.paidAt).not.toBeNull();
  });

  it("replay do mesmo event.id credita uma vez só", async () => {
    const user = await makeUser();
    await service.checkout(user, "single");
    const order = await orderOf(user.id);
    const event = evt({ type: "paid", sessionId: order.providerSessionId, paymentIntent: "pi_2" });

    await webhook(event);
    await service.applyWebhook(Buffer.from(JSON.stringify(event)), "fake");

    expect(await creditsOf(user.id)).toBe(1);
  });

  it("um segundo paid (id novo) para order já paga não credita de novo", async () => {
    const user = await makeUser();
    await service.checkout(user, "single");
    const order = await orderOf(user.id);

    await webhook(evt({ type: "paid", sessionId: order.providerSessionId, paymentIntent: "pi_3" }));
    await webhook(evt({ type: "paid", sessionId: order.providerSessionId, paymentIntent: "pi_3" }));

    expect(await creditsOf(user.id)).toBe(1);
  });

  it("expired: pending → expired; order paga não muda", async () => {
    const user = await makeUser();
    await service.checkout(user, "single");
    const order = await orderOf(user.id);

    await webhook(evt({ type: "expired", sessionId: order.providerSessionId }));
    expect((await orderOf(user.id)).status).toBe("expired");

    // paid depois de expired não ressuscita: "só se estava pending".
    await webhook(evt({ type: "paid", sessionId: order.providerSessionId, paymentIntent: "pi_4" }));
    expect((await orderOf(user.id)).status).toBe("expired");
    expect(await creditsOf(user.id)).toBe(0);
  });

  it("refunded: paid → refunded e o saldo desce sem ficar negativo", async () => {
    const user = await makeUser();
    await service.checkout(user, "pack3");
    const order = await orderOf(user.id);
    await webhook(evt({ type: "paid", sessionId: order.providerSessionId, paymentIntent: "pi_5" }));
    // gasta 2 dos 3 antes do estorno
    await db.update(users).set({ credits: 1 }).where(eq(users.id, user.id));

    await webhook(evt({ type: "refunded", paymentIntent: "pi_5" }));

    expect((await orderOf(user.id)).status).toBe("refunded");
    expect(await creditsOf(user.id)).toBe(0);
  });

  it("refunded antes de paid, ou com payment_intent desconhecido, só registra o evento", async () => {
    const user = await makeUser();
    await service.checkout(user, "single");

    const event = evt({ type: "refunded", paymentIntent: "pi_nunca_pago" });
    await webhook(event);

    expect((await orderOf(user.id)).status).toBe("pending");
    expect(await creditsOf(user.id)).toBe(0);
    const seen = await db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id));
    expect(seen).toHaveLength(1);
  });

  it("ignored só registra o evento", async () => {
    const event = evt({ type: "ignored" });
    await webhook(event);
    const seen = await db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id));
    expect(seen[0]!.type).toBe("ignored");
  });

  it("assinatura inválida lança e não grava evento", async () => {
    const event = evt({ type: "ignored" });
    await expect(
      service.applyWebhook(Buffer.from(JSON.stringify(event)), "errada")
    ).rejects.toMatchObject({ code: "validation" });
    const seen = await db.select().from(webhookEvents).where(eq(webhookEvents.id, event.id));
    expect(seen).toHaveLength(0);
  });
});
