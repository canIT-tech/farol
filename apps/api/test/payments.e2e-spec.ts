import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, users, tripDestinations, webhookEvents } from "@farol/db";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de payments");

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
  targetMonth: "2026-09"
};

async function newUser() {
  const id = crypto.randomUUID();
  createdIds.push(id);
  const token = await jwks.sign({ sub: id, email: `${id}@farol.test` });
  return { id, auth: `Bearer ${token}` };
}

async function tripWithCandidate(auth: string): Promise<string> {
  const created = await request(app.getHttpServer())
    .post("/trips")
    .set("Authorization", auth)
    .send(tripBody);
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

function choose(auth: string, tripId: string) {
  return request(app.getHttpServer())
    .post(`/trips/${tripId}/destination`)
    .set("Authorization", auth)
    .send({ iata: "LIS" });
}

function webhook(event: object) {
  eventIds.push((event as { id: string }).id);
  return request(app.getHttpServer())
    .post("/payments/webhook")
    .set("stripe-signature", "fake")
    .set("content-type", "application/json")
    .send(event);
}

function me(auth: string) {
  return request(app.getHttpServer()).get("/payments/me").set("Authorization", auth);
}

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  const { AppModule } = await import("../src/app.module");
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  // rawBody: o webhook verifica a assinatura sobre o corpo cru, como no main.ts.
  app = mod.createNestApplication({ rawBody: true });
  await app.init();
});

afterAll(async () => {
  if (eventIds.length > 0) {
    await db.delete(webhookEvents).where(inArray(webhookEvents.id, eventIds));
  }
  if (createdIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdIds));
  }
  await app.close();
  await jwks.stop();
  await close();
});

describe("pagamento por viagem", () => {
  it(
    "1ª viagem grátis → 2ª 402 → checkout → webhook → 2ª gera e debita",
    { timeout: 20000 },
    async () => {
      const u = await newUser();

      const first = await choose(u.auth, await tripWithCandidate(u.auth));
      expect(first.status).toBe(202);

      const second = await tripWithCandidate(u.auth);
      const denied = await choose(u.auth, second);
      expect(denied.status).toBe(402);
      expect(denied.body.code).toBe("payment_required");

      const co = await request(app.getHttpServer())
        .post("/payments/checkout")
        .set("Authorization", u.auth)
        .send({ product: "single" });
      expect(co.status).toBe(201);
      expect(co.body.url).toContain("/pagamento/sucesso");

      const before = await me(u.auth);
      expect(before.body).toMatchObject({ credits: 0, freeItineraryUsed: true });
      expect(before.body.orders[0].status).toBe("pending");
      const sessionId = `fake_cs_${before.body.orders[0].id}`;

      const event = { id: `evt_${crypto.randomUUID()}`, type: "paid", sessionId, paymentIntent: "pi_e2e" };
      expect((await webhook(event)).status).toBe(200);
      // replay: mesmo id, mesmo 200, sem crédito duplicado
      expect((await webhook(event)).status).toBe(200);

      const after = await me(u.auth);
      expect(after.body).toMatchObject({ credits: 1, freeItineraryUsed: true });
      expect(after.body.orders[0].status).toBe("paid");

      const ok = await choose(u.auth, second);
      expect(ok.status).toBe(202);
      expect((await me(u.auth)).body.credits).toBe(0);
    }
  );

  it("checkout com produto desconhecido responde 400", async () => {
    const u = await newUser();
    const res = await request(app.getHttpServer())
      .post("/payments/checkout")
      .set("Authorization", u.auth)
      .send({ product: "pack10" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation");
  });

  it("webhook com assinatura errada responde 400 e não grava nada", async () => {
    const id = `evt_${crypto.randomUUID()}`;
    const res = await request(app.getHttpServer())
      .post("/payments/webhook")
      .set("stripe-signature", "nope")
      .send({ id, type: "ignored" });
    expect(res.status).toBe(400);
    const seen = await db.select().from(webhookEvents).where(inArray(webhookEvents.id, [id]));
    expect(seen).toHaveLength(0);
  });

  it("webhook é público; /payments/me e /payments/checkout exigem token", async () => {
    const pub = await webhook({ id: `evt_${crypto.randomUUID()}`, type: "ignored" });
    expect(pub.status).toBe(200);
    expect((await request(app.getHttpServer()).get("/payments/me")).status).toBe(401);
    expect(
      (await request(app.getHttpServer()).post("/payments/checkout").send({ product: "single" })).status
    ).toBe(401);
  });
});
