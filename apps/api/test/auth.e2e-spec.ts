import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { sql, inArray } from "drizzle-orm";
import { createDbClient, users } from "@farol/db";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de auth");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  // import tardio: garante que o AppModule seja avaliado depois do env ajustado
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

describe("GET /me", () => {
  it("responde 401 sem header Authorization", async () => {
    const res = await request(app.getHttpServer()).get("/me");
    expect(res.status).toBe(401);
  });

  it("responde 401 com token inválido", async () => {
    const res = await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", "Bearer aaa.bbb.ccc");
    expect(res.status).toBe(401);
  });

  it("responde 200 com o usuário e faz upsert em users", async () => {
    const id = crypto.randomUUID();
    createdIds.push(id);
    const token = await jwks.sign({ sub: id, email: "e2e@farol.test" });

    const res = await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id, email: "e2e@farol.test" });

    const rows = await db.select().from(users).where(sql`${users.id} = ${id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("e2e@farol.test");
  });

  it("atualiza o e-mail em um segundo acesso sem duplicar a linha", async () => {
    const id = crypto.randomUUID();
    createdIds.push(id);
    const first = await jwks.sign({ sub: id, email: "antes@farol.test" });
    const second = await jwks.sign({ sub: id, email: "depois@farol.test" });

    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${first}`);
    const res = await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${second}`);
    expect(res.body).toEqual({ id, email: "depois@farol.test" });

    const rows = await db.select().from(users).where(sql`${users.id} = ${id}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toBe("depois@farol.test");
  });
});
