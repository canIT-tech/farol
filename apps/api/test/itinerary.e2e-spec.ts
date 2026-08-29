import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, users, tripDestinations } from "@farol/db";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de itinerary");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

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

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  const { AppModule } = await import("../src/app.module");
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});

afterAll(async () => {
  if (createdIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdIds));
  }
  await app.close();
  await jwks.stop();
  await close();
});

describe("roteiro", () => {
  it("POST /trips/:id/destination sem auth responde 401", async () => {
    const res = await request(app.getHttpServer()).post("/trips/x/destination").send({ iata: "LIS" });
    expect(res.status).toBe(401);
  });

  it("POST /trips/:id/destination responde 202 { itineraryId } e GET traz status pending", async () => {
    const u = await newUser();
    const tripId = await tripWithCandidate(u.auth);

    const choose = await request(app.getHttpServer())
      .post(`/trips/${tripId}/destination`)
      .set("Authorization", u.auth)
      .send({ iata: "LIS" });
    expect(choose.status).toBe(202);
    expect(typeof choose.body.itineraryId).toBe("string");

    const latest = await request(app.getHttpServer())
      .get(`/trips/${tripId}/itinerary`)
      .set("Authorization", u.auth);
    expect(latest.status).toBe(200);
    expect(latest.body.status).toBe("pending");
    expect(latest.body.days).toEqual([]);
  });

  it("POST /trips/:id/destination com iata fora dos candidatos responde 404", async () => {
    const u = await newUser();
    const tripId = await tripWithCandidate(u.auth);
    const res = await request(app.getHttpServer())
      .post(`/trips/${tripId}/destination`)
      .set("Authorization", u.auth)
      .send({ iata: "ZZZ" });
    expect(res.status).toBe(404);
  });

  it("GET /trips/:id/itinerary sem roteiro responde 404", async () => {
    const u = await newUser();
    const tripId = await tripWithCandidate(u.auth);
    const res = await request(app.getHttpServer())
      .get(`/trips/${tripId}/itinerary`)
      .set("Authorization", u.auth);
    expect(res.status).toBe(404);
  });

  it("POST .../itinerary/days/1/regenerate sem auth responde 401", async () => {
    const res = await request(app.getHttpServer()).post("/trips/x/itinerary/days/1/regenerate");
    expect(res.status).toBe(401);
  });

  it("POST .../itinerary/days/1/regenerate responde 409 enquanto o roteiro está pending", async () => {
    const u = await newUser();
    const tripId = await tripWithCandidate(u.auth);
    await request(app.getHttpServer())
      .post(`/trips/${tripId}/destination`)
      .set("Authorization", u.auth)
      .send({ iata: "LIS" });
    const res = await request(app.getHttpServer())
      .post(`/trips/${tripId}/itinerary/days/1/regenerate`)
      .set("Authorization", u.auth);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("itinerary_not_ready");
  });
});
