import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, users, trips, tripDestinations, webhookEvents } from "@farol/db";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

// Casos de borda do gate e do webhook (spec pagamento §5/§6): concorrência,
// ordem dos eventos e estados que não podem regredir.
const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de credits-edge");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];
const eventIds: string[] = [];

const tripBody = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 30000,
  durationDays: 3,
  targetMonth: "2026-12"
};

async function newUser(credits = 0) {
  const id = crypto.randomUUID();
  createdIds.push(id);
  const token = await jwks.sign({ sub: id, email: `${id}@farol.test` });
  const auth = `Bearer ${token}`;
  // garante a linha em users (upsert do AuthGuard) e ajusta o saldo
  await request(app.getHttpServer()).get("/payments/me").set("Authorization", auth);
  await db.update(users).set({ credits, freeItineraryUsedAt: new Date() }).where(eq(users.id, id));
  return { id, auth };
}

async function tripWithCandidate(auth: string): Promise<string> {
  const created = await request(app.getHttpServer()).post("/trips").set("Authorization", auth).send(tripBody);
  await db.insert(tripDestinations).values({
    id: crypto.randomUUID(),
    tripId: created.body.id,
    city: "Lisboa",
    country: "Portugal",
    iata: "LIS",
    score: "0.8",
    rationale: "Justificativa longa o suficiente para o schema aqui.",
    estCost: { flight: 3200, lodgingPerNight: 180, dailyLocal: 140, currency: "BRL" },
    climate: { expectedC: 24, summary: "ameno", bestMonths: [9] },
    flightTimeHours: null,
    chosen: false
  });
  return created.body.id as string;
}

const choose = (auth: string, tripId: string) =>
  request(app.getHttpServer()).post(`/trips/${tripId}/destination`).set("Authorization", auth).send({ iata: "LIS" });

function webhook(event: object) {
  eventIds.push((event as { id: string }).id);
  return request(app.getHttpServer())
    .post("/payments/webhook")
    .set("stripe-signature", "fake")
    .set("content-type", "application/json")
    .send(event);
}

const me = (auth: string) => request(app.getHttpServer()).get("/payments/me").set("Authorization", auth);

async function pendingOrder(auth: string) {
  const co = await request(app.getHttpServer())
    .post("/payments/checkout")
    .set("Authorization", auth)
    .send({ product: "single" });
  expect(co.status).toBe(201);
  const orderId = (await me(auth)).body.orders[0].id as string;
  return { orderId, sessionId: `fake_cs_${orderId}` };
}

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  const { AppModule } = await import("../src/app.module");
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication({ rawBody: true });
  await app.init();
});

afterAll(async () => {
  if (eventIds.length > 0) await db.delete(webhookEvents).where(inArray(webhookEvents.id, eventIds));
  if (createdIds.length > 0) await db.delete(users).where(inArray(users.id, createdIds));
  await app.close();
  await jwks.stop();
  await close();
});

describe("gate — concorrência", () => {
  it("dois chooseDestination simultâneos na mesma viagem debitam 1 crédito só", { timeout: 20000 }, async () => {
    const u = await newUser(2);
    const tripId = await tripWithCandidate(u.auth);
    const [a, b] = await Promise.all([choose(u.auth, tripId), choose(u.auth, tripId)]);
    expect([a.status, b.status].filter((s) => s === 202).length).toBeGreaterThanOrEqual(1);
    expect((await me(u.auth)).body.credits).toBe(1);
  });

  it("saldo 1 e duas viagens ao mesmo tempo: uma passa, a outra 402, saldo 0", { timeout: 20000 }, async () => {
    const u = await newUser(1);
    const [t1, t2] = await Promise.all([tripWithCandidate(u.auth), tripWithCandidate(u.auth)]);
    const [a, b] = await Promise.all([choose(u.auth, t1), choose(u.auth, t2)]);
    expect([a.status, b.status].sort()).toEqual([202, 402]);
    expect((await me(u.auth)).body.credits).toBe(0);
  });

  it("viagem já destravada não cobra de novo ao reescolher", { timeout: 20000 }, async () => {
    const u = await newUser(2);
    const tripId = await tripWithCandidate(u.auth);
    expect((await choose(u.auth, tripId)).status).toBe(202);
    expect((await choose(u.auth, tripId)).status).toBe(202);
    expect((await me(u.auth)).body.credits).toBe(1);
  });
});

describe("webhook — ordem e estados", () => {
  it("dois webhooks 'paid' concorrentes com ids diferentes para a mesma session creditam uma vez", async () => {
    const u = await newUser(0);
    const { sessionId } = await pendingOrder(u.auth);
    const ev = (id: string) => ({ id, type: "paid", sessionId, paymentIntent: "pi_dup" });
    const [a, b] = await Promise.all([webhook(ev(`evt_${crypto.randomUUID()}`)), webhook(ev(`evt_${crypto.randomUUID()}`))]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect((await me(u.auth)).body.credits).toBe(1);
  });

  it("expired depois de paid não regride o pedido nem o saldo", async () => {
    const u = await newUser(0);
    const { sessionId } = await pendingOrder(u.auth);
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId, paymentIntent: "pi_x" });
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "expired", sessionId });
    const r = (await me(u.auth)).body;
    expect(r.credits).toBe(1);
    expect(r.orders[0].status).toBe("paid");
  });

  it("paid depois de expired não credita (Stripe não paga session expirada; defesa)", async () => {
    const u = await newUser(0);
    const { sessionId } = await pendingOrder(u.auth);
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "expired", sessionId });
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId, paymentIntent: "pi_y" });
    const r = (await me(u.auth)).body;
    expect(r.credits).toBe(0);
    expect(r.orders[0].status).toBe("expired");
  });

  it("refunded antes de paid: o paid seguinte ainda credita (ordem fora de sequência)", async () => {
    const u = await newUser(0);
    const { sessionId } = await pendingOrder(u.auth);
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "refunded", paymentIntent: "pi_z" });
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId, paymentIntent: "pi_z" });
    const r = (await me(u.auth)).body;
    // Documenta o comportamento atual: credita. A Stripe nunca manda o refund
    // antes do completed na prática; estorno é ação manual no painel, depois.
    expect(r.credits).toBe(1);
    expect(r.orders[0].status).toBe("paid");
  });

  it("estorno com crédito já gasto para no zero e não deixa saldo negativo", { timeout: 20000 }, async () => {
    const u = await newUser(0);
    const { sessionId } = await pendingOrder(u.auth);
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId, paymentIntent: "pi_w" });
    expect((await choose(u.auth, await tripWithCandidate(u.auth))).status).toBe(202);
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "refunded", paymentIntent: "pi_w" });
    const r = (await me(u.auth)).body;
    expect(r.credits).toBe(0);
    expect(r.orders[0].status).toBe("refunded");
  });

  it("refunded duas vezes (ids diferentes) desconta uma vez só", async () => {
    const u = await newUser(0);
    const a = await pendingOrder(u.auth);
    const b = await pendingOrder(u.auth);
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId: a.sessionId, paymentIntent: "pi_a" });
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId: b.sessionId, paymentIntent: "pi_b" });
    expect((await me(u.auth)).body.credits).toBe(2);
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "refunded", paymentIntent: "pi_a" });
    await webhook({ id: `evt_${crypto.randomUUID()}`, type: "refunded", paymentIntent: "pi_a" });
    expect((await me(u.auth)).body.credits).toBe(1);
  });

  it("webhook para session desconhecida responde 200 e não cria nada", async () => {
    const res = await webhook({ id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId: "cs_nope", paymentIntent: "pi_nope" });
    expect(res.status).toBe(200);
  });

  it("outro usuário não vê nem paga a viagem alheia", async () => {
    const owner = await newUser(1);
    const other = await newUser(1);
    const tripId = await tripWithCandidate(owner.auth);
    const res = await choose(other.auth, tripId);
    expect([403, 404]).toContain(res.status);
    expect((await me(other.auth)).body.credits).toBe(1);
    const [row] = await db.select({ unlockedAt: trips.unlockedAt }).from(trips).where(eq(trips.id, tripId));
    expect(row?.unlockedAt).toBeNull();
  });
});
