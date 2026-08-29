import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, users } from "@farol/db";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de profile");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

const validBody = {
  interests: ["praia", "gastronomia", "sossego"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: { kids: true }
};

async function tokenForNewUser(): Promise<{ id: string; token: string }> {
  const id = crypto.randomUUID();
  createdIds.push(id);
  return { id, token: await jwks.sign({ sub: id, email: `${id}@farol.test` }) };
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

describe("me/profile", () => {
  it("PUT sem auth responde 401", async () => {
    const res = await request(app.getHttpServer()).put("/me/profile").send(validBody);
    expect(res.status).toBe(401);
  });

  it("GET responde 404 quando o usuário ainda não tem perfil", async () => {
    const { token } = await tokenForNewUser();
    const res = await request(app.getHttpServer())
      .get("/me/profile")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("not_found");
  });

  it("PUT válido cria o perfil e GET devolve o mesmo payload", async () => {
    const { token } = await tokenForNewUser();
    const put = await request(app.getHttpServer())
      .put("/me/profile")
      .set("Authorization", `Bearer ${token}`)
      .send(validBody);
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({
      interests: validBody.interests,
      pace: "moderado",
      partyType: "casal",
      budgetBand: "medio",
      constraints: { kids: true }
    });
    expect(typeof put.body.id).toBe("string");

    const get = await request(app.getHttpServer())
      .get("/me/profile")
      .set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body).toEqual(put.body);
  });

  it("PUT com menos de 3 interesses responde 400", async () => {
    const { token } = await tokenForNewUser();
    const res = await request(app.getHttpServer())
      .put("/me/profile")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validBody, interests: ["praia", "sol"] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation");
  });
});
