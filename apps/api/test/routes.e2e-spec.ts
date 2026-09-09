import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, users, providerCache } from "@farol/db";
import { FLIGHT_PROVIDER } from "../src/providers/providers.module";
import { FakeFlightProvider } from "./support/fake-providers";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de routes");

let app: INestApplication;
let jwks: FakeJwks;
let auth: string;
const { db, close } = createDbClient(dbUrl);
const createdIds: string[] = [];

async function appWith(provider: FakeFlightProvider): Promise<INestApplication> {
  const { AppModule } = await import("../src/app.module");
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(FLIGHT_PROVIDER)
    .useValue(provider)
    .compile();
  const created = mod.createNestApplication();
  await created.init();
  return created;
}

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  app = await appWith(new FakeFlightProvider());
  const id = crypto.randomUUID();
  createdIds.push(id);
  auth = `Bearer ${await jwks.sign({ sub: id, email: `${id}@farol.test` })}`;
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

describe("GET /routes/months", () => {
  // O ponto do endpoint: não há viagem, não há catálogo, não há destino
  // escolhido — e SYD não existe no catálogo de 23 cidades.
  it("responde a rota sem viagem, catálogo ou destino escolhido", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/months?origin=FLN&destination=SYD&adults=1")
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.offers.length).toBeGreaterThan(0);
    expect(res.body.error).toBeNull();
  });

  it("exige credencial", async () => {
    const res = await request(app.getHttpServer()).get(
      "/routes/months?origin=FLN&destination=SYD"
    );
    expect(res.status).toBe(401);
  });

  it("recusa IATA inválido com 400", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/months?origin=FL&destination=SYD")
      .set("Authorization", auth);
    expect(res.status).toBe(400);
  });
});

describe("GET /routes/offers", () => {
  it("busca ida e volta", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD&depart=2027-02-11&return=2027-02-25")
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.offers.length).toBeGreaterThan(0);
  });

  it("busca ida só", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD&depart=2027-02-11")
      .set("Authorization", auth);
    expect(res.status).toBe(200);
    expect(res.body.offers.length).toBeGreaterThan(0);
  });

  // O caminho é o que o `stops` apagava: sem os trechos, "via Santiago" e "via
  // Doha" são a mesma linha na tela.
  it("traz os trechos da oferta com escala", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD&depart=2027-02-11")
      .set("Authorization", auth);
    const comEscala = res.body.offers.find((o: { stops: number }) => o.stops > 0);
    expect(comEscala.segments).toHaveLength(comEscala.stops + 1);
  });

  it("oferta sem caminho conhecido chega com segments vazio", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD&depart=2027-02-11")
      .set("Authorization", auth);
    const direto = res.body.offers.find((o: { id: string }) => o.id === "flt-direct");
    expect(direto.segments).toEqual([]);
  });

  it("exige a data de ida", async () => {
    const res = await request(app.getHttpServer())
      .get("/routes/offers?origin=FLN&destination=SYD")
      .set("Authorization", auth);
    expect(res.status).toBe(400);
  });

  it("exige credencial", async () => {
    const res = await request(app.getHttpServer()).get(
      "/routes/offers?origin=FLN&destination=SYD&depart=2027-02-11"
    );
    expect(res.status).toBe(401);
  });
});

describe("provider fora do ar", () => {
  it("devolve seção degradada com 200, não 500", async () => {
    const caido = await appWith(new FakeFlightProvider({ fail: true }));
    try {
      const res = await request(caido.getHttpServer())
        .get("/routes/months?origin=POA&destination=NRT")
        .set("Authorization", auth);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ offers: [], error: "unavailable" });
    } finally {
      await caido.close();
    }
  });
});
