import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, users, tripDestinations, providerCache } from "@farol/db";
import { FLIGHT_PROVIDER } from "../src/providers/providers.module";
import { FakeFlightProvider } from "./support/fake-providers";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de flights");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

const tripBody = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 20000,
  dateStart: "2026-09-10",
  dateEnd: "2026-09-17"
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
    .overrideProvider(FLIGHT_PROVIDER)
    .useValue(new FakeFlightProvider())
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

describe("trips/:id/flights", () => {
  it("GET sem auth responde 401", async () => {
    const res = await request(app.getHttpServer()).get("/trips/qualquer/flights");
    expect(res.status).toBe(401);
  });

  it("GET com destino escolhido devolve ProviderSection com ofertas", async () => {
    const u = await newUser();
    const tripId = await tripWithDestination(u.auth);

    const res = await request(app.getHttpServer())
      .get(`/trips/${tripId}/flights`)
      .set("Authorization", u.auth);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.stale).toBe(false);
    expect(res.body.offers.length).toBeGreaterThan(0);
  });

  it("GET sem destino escolhido responde 422 no_destination_chosen", async () => {
    const u = await newUser();
    const created = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", u.auth)
      .send(tripBody);
    const res = await request(app.getHttpServer())
      .get(`/trips/${created.body.id}/flights`)
      .set("Authorization", u.auth);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("no_destination_chosen");
  });

  it("POST select grava a seleção e devolve 201 com o deep link", async () => {
    const u = await newUser();
    const tripId = await tripWithDestination(u.auth);

    const res = await request(app.getHttpServer())
      .post(`/trips/${tripId}/flights/select`)
      .set("Authorization", u.auth)
      .send({ offerId: "flt-direct" });

    expect(res.status).toBe(201);
    expect(res.body.offer.id).toBe("flt-direct");
    expect(res.body.deepLink).toContain("flt-direct");
  });

  it("POST select com offerId inexistente responde 404", async () => {
    const u = await newUser();
    const tripId = await tripWithDestination(u.auth);
    const res = await request(app.getHttpServer())
      .post(`/trips/${tripId}/flights/select`)
      .set("Authorization", u.auth)
      .send({ offerId: "nao-existe" });
    expect(res.status).toBe(404);
  });

  it.each([
    ["nearby", "offers"],
    ["calendar", "offers"],
    ["latest", "offers"],
    ["months", "offers"],
    ["directions", "offers"]
  ])("GET /flights/%s devolve uma ProviderSection preenchida", async (rota) => {
    const u = await newUser();
    const tripId = await tripWithDestination(u.auth);

    const res = await request(app.getHttpServer())
      .get(`/trips/${tripId}/flights/${rota}`)
      .set("Authorization", u.auth);

    expect(res.status).toBe(200);
    expect(res.body.error).toBeNull();
    expect(res.body.offers.length).toBeGreaterThan(0);
  });

  it("GET /flights/directions funciona sem destino escolhido", async () => {
    const u = await newUser();
    const created = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", u.auth)
      .send(tripBody);

    const res = await request(app.getHttpServer())
      .get(`/trips/${created.body.id}/flights/directions`)
      .set("Authorization", u.auth);

    expect(res.status).toBe(200);
    expect(res.body.offers.length).toBeGreaterThan(0);
  });

  it("os recortes de contexto também exigem auth", async () => {
    for (const rota of ["nearby", "calendar", "latest", "months", "directions"]) {
      const res = await request(app.getHttpServer()).get(`/trips/qualquer/flights/${rota}`);
      expect(res.status).toBe(401);
    }
  });
});
