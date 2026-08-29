import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, users, tripDestinations, providerCache } from "@farol/db";
import { HOTEL_PROVIDER } from "../src/providers/providers.module";
import { FakeHotelProvider } from "./support/fake-providers";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de hotels");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

const tripBody = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 20000,
  durationDays: 7,
  targetMonth: "2026-09"
};

async function newUser() {
  const id = crypto.randomUUID();
  createdIds.push(id);
  return { id, auth: `Bearer ${await jwks.sign({ sub: id, email: `${id}@farol.test` })}` };
}

async function tripWithDestination(auth: string): Promise<string> {
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
    estCost: { flight: 4000, lodgingPerNight: 200, dailyLocal: 150, currency: "BRL" },
    climate: { expectedC: 22, summary: "ameno", bestMonths: [9] },
    flightTimeHours: null,
    chosen: true
  });
  return created.body.id as string;
}

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  const { AppModule } = await import("../src/app.module");
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(HOTEL_PROVIDER)
    .useValue(new FakeHotelProvider())
    .compile();
  app = mod.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await db.delete(providerCache);
  if (createdIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdIds));
  }
  await app.close();
  await jwks.stop();
  await close();
});

describe("trips/:id/hotels", () => {
  it("GET sem auth responde 401", async () => {
    const res = await request(app.getHttpServer()).get("/trips/x/hotels");
    expect(res.status).toBe(401);
  });

  it("GET devolve ProviderSection com ofertas de hotel", async () => {
    const u = await newUser();
    const tripId = await tripWithDestination(u.auth);
    const res = await request(app.getHttpServer())
      .get(`/trips/${tripId}/hotels`)
      .set("Authorization", u.auth);
    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.offers.length).toBeGreaterThan(0);
  });

  it("POST select grava a seleção e devolve 201", async () => {
    const u = await newUser();
    const tripId = await tripWithDestination(u.auth);
    const res = await request(app.getHttpServer())
      .post(`/trips/${tripId}/hotels/select`)
      .set("Authorization", u.auth)
      .send({ offerId: "htl-marriott" });
    expect(res.status).toBe(201);
    expect(res.body.offer.id).toBe("htl-marriott");
    expect(res.body.rating).toBe(5);
  });
});
