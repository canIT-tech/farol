import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { fileURLToPath } from "node:url";
import { inArray } from "drizzle-orm";
import { createDbClient, seedCatalog, DEFAULT_CATALOG_CSV, users } from "@farol/db";
import { LLM } from "../src/llm/llm.types";
import { FakeLlmService } from "../src/llm/fake-llm.service";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de discovery");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

const profileBody = {
  interests: ["praia", "gastronomia", "cultura e museus"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {}
};
const tripBody = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 60000,
  durationDays: 5,
  targetMonth: "2026-09"
};

async function newUser() {
  const id = crypto.randomUUID();
  createdIds.push(id);
  const token = await jwks.sign({ sub: id, email: `${id}@farol.test` });
  return { id, token, auth: `Bearer ${token}` };
}

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  await seedCatalog(dbUrl, fileURLToPath(DEFAULT_CATALOG_CSV));
  const { AppModule } = await import("../src/app.module");
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LLM)
    .useClass(FakeLlmService)
    .compile();
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

async function createTrip(auth: string, over: Record<string, unknown> = {}): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/trips")
    .set("Authorization", auth)
    .send({ ...tripBody, ...over });
  return res.body.id as string;
}

describe("POST /trips/:id/discovery", () => {
  it("com perfil e orçamento ok devolve 3..5 destinos com rationale", async () => {
    const u = await newUser();
    await request(app.getHttpServer()).put("/me/profile").set("Authorization", u.auth).send(profileBody);
    const tripId = await createTrip(u.auth);

    const res = await request(app.getHttpServer())
      .post(`/trips/${tripId}/discovery`)
      .set("Authorization", u.auth);

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
    expect(res.body.length).toBeLessThanOrEqual(5);
    expect(res.body.every((d: { rationale: string }) => d.rationale.length > 0)).toBe(true);
  });

  it("sem auth responde 401", async () => {
    const res = await request(app.getHttpServer()).post("/trips/qualquer/discovery");
    expect(res.status).toBe(401);
  });

  it("sem perfil de gosto responde 404", async () => {
    const u = await newUser();
    const tripId = await createTrip(u.auth);
    const res = await request(app.getHttpServer())
      .post(`/trips/${tripId}/discovery`)
      .set("Authorization", u.auth);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("taste_profile_required");
  });

  it("com orçamento minúsculo responde 422", async () => {
    const u = await newUser();
    await request(app.getHttpServer()).put("/me/profile").set("Authorization", u.auth).send(profileBody);
    const tripId = await createTrip(u.auth, { budgetTotal: 100 });
    const res = await request(app.getHttpServer())
      .post(`/trips/${tripId}/discovery`)
      .set("Authorization", u.auth);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("no_destinations_in_budget");
  });
});
