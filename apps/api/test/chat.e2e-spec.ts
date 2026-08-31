import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, users } from "@farol/db";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";
import { LlmService } from "../src/llm/llm.service";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de chat");

let app: INestApplication;
let jwks: FakeJwks;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

async function tokenForNewUser(): Promise<string> {
  const id = crypto.randomUUID();
  createdIds.push(id);
  return jwks.sign({ sub: id, email: `${id}@farol.test` });
}

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  const { AppModule } = await import("../src/app.module");

  const mockLlm = {
    chat: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Olá! Como posso ajudar na sua viagem?" }],
      usage: { input_tokens: 50, output_tokens: 10 }
    }),
    rankDestinations: vi.fn(),
    buildItinerary: vi.fn()
  };

  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(LlmService)
    .useValue(mockLlm)
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

describe("chat e2e", () => {
  it("POST /trips/:id/chat sem auth responde 401", async () => {
    const res = await request(app.getHttpServer())
      .post(`/trips/${crypto.randomUUID()}/chat`)
      .send({ message: "Olá" });
    expect(res.status).toBe(401);
  });

  it("POST /trips/:id/chat com id inválido responde 400", async () => {
    const token = await tokenForNewUser();
    const res = await request(app.getHttpServer())
      .post("/trips/not-a-uuid/chat")
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Olá" });
    expect(res.status).toBe(400);
  });

  it("POST /trips/:id/chat com auth processa a conversa", async () => {
    const token = await tokenForNewUser();

    // 1. Cria uma viagem
    const trip = await request(app.getHttpServer())
      .post("/trips")
      .set("Authorization", `Bearer ${token}`)
      .send({
        originIata: "GRU",
        party: { adults: 1, children: 0 },
        budgetTotal: 5000,
        durationDays: 5
      });
    expect(trip.status).toBe(201);

    // 2. Envia mensagem no chat
    const res = await request(app.getHttpServer())
      .post(`/trips/${trip.body.id}/chat`)
      .set("Authorization", `Bearer ${token}`)
      .send({ message: "Olá, me dê sugestões" });

    expect(res.status).toBe(201);
    expect(res.body.message.role).toBe("assistant");
    expect(res.body.message.content).toBe("Olá! Como posso ajudar na sua viagem?");
    expect(res.body.tripState.id).toBe(trip.body.id);
  });
});
