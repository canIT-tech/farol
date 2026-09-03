import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, users } from "@farol/db";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de trips");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

const body = {
  originIata: "GRU",
  party: { adults: 2, children: 0 },
  budgetTotal: 15000,
  durationDays: 7,
  targetMonth: "2026-09"
};

async function tokenForNewUser(): Promise<string> {
  const id = crypto.randomUUID();
  createdIds.push(id);
  return jwks.sign({ sub: id, email: `${id}@farol.test` });
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

describe("trips", () => {
  it("POST /trips sem auth responde 401", async () => {
    const res = await request(app.getHttpServer()).post("/trips").send(body);
    expect(res.status).toBe(401);
  });

  it("POST /trips com auth cria a viagem (201) e GET /trips a lista", async () => {
    const token = await tokenForNewUser();
    const created = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    expect(created.status).toBe(201);
    expect(created.body.status).toBe("draft");
    expect(typeof created.body.id).toBe("string");

    const list = await request(app.getHttpServer())
      .get("/trips")
      .set("Authorization", `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.map((t: { id: string }) => t.id)).toContain(created.body.id);
  });

  it("GET /trips/:id devolve o TripState com destinations vazio", async () => {
    const token = await tokenForNewUser();
    const created = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", `Bearer ${token}`)
      .send(body);
    const state = await request(app.getHttpServer())
      .get(`/trips/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(state.status).toBe(200);
    expect(state.body.destinations).toEqual([]);
    expect(state.body.chosenDestination).toBeNull();
  });

  it("GET /trips/:id de outro usuário responde 403", async () => {
    const ownerToken = await tokenForNewUser();
    const intruderToken = await tokenForNewUser();
    const created = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", `Bearer ${ownerToken}`)
      .send(body);
    const res = await request(app.getHttpServer())
      .get(`/trips/${created.body.id}`)
      .set("Authorization", `Bearer ${intruderToken}`);
    expect(res.status).toBe(403);
  });

  it("POST /trips com datas e duração juntas responde 400", async () => {
    const token = await tokenForNewUser();
    const res = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...body, dateStart: "2026-09-10", dateEnd: "2026-09-17" });
    expect(res.status).toBe(400);
  });

  it("DELETE /trips/:id apaga a viagem (204) e ela some da lista", async () => {
    const token = await tokenForNewUser();
    const created = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", `Bearer ${token}`)
      .send(body);

    const removed = await request(app.getHttpServer())
      .delete(`/trips/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(removed.status).toBe(204);

    const list = await request(app.getHttpServer())
      .get("/trips")
      .set("Authorization", `Bearer ${token}`);
    expect(list.body.map((t: { id: string }) => t.id)).not.toContain(created.body.id);

    const gone = await request(app.getHttpServer())
      .get(`/trips/${created.body.id}`)
      .set("Authorization", `Bearer ${token}`);
    expect(gone.status).toBe(404);
  });

  it("DELETE /trips/:id sem auth responde 401", async () => {
    const res = await request(app.getHttpServer()).delete(`/trips/${crypto.randomUUID()}`);
    expect(res.status).toBe(401);
  });

  it("DELETE /trips/:id de outra pessoa responde 403 e não apaga", async () => {
    const dono = await tokenForNewUser();
    const intruso = await tokenForNewUser();
    const created = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", `Bearer ${dono}`)
      .send(body);

    const res = await request(app.getHttpServer())
      .delete(`/trips/${created.body.id}`)
      .set("Authorization", `Bearer ${intruso}`);
    expect(res.status).toBe(403);

    const ainda = await request(app.getHttpServer())
      .get(`/trips/${created.body.id}`)
      .set("Authorization", `Bearer ${dono}`);
    expect(ainda.status).toBe(200);
  });
});
