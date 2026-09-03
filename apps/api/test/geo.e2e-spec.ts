import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import type { GeoProvider } from "@farol/providers";
import { GEO_PROVIDER } from "../src/providers/providers.module";
import { startFakeJwks, type FakeJwks } from "./support/test-jwt";

let app: INestApplication;
let jwks: FakeJwks;

const GRU = {
  iata: "GRU",
  name: "Sao Paulo-Guarulhos International Airport",
  cityCode: "SAO",
  countryCode: "BR",
  timeZone: "America/Sao_Paulo",
  lat: -23.435555,
  lon: -46.473055,
  flightable: true
};

const fakeGeo: GeoProvider = {
  whereami: (ip) =>
    Promise.resolve(
      ip === "0.0.0.0"
        ? null
        : {
            iata: "XAP",
            name: "Chapeco",
            countryName: "Brazil",
            countryCode: "BR",
            lat: -27.100935,
            lon: -52.6157
          }
    ),
  airport: (iata) => Promise.resolve(iata.toUpperCase() === "GRU" ? GRU : null),
  city: (iata) =>
    Promise.resolve(
      iata.toUpperCase() === "LIS"
        ? { iata: "LIS", name: "Lisbon", countryCode: "PT", lat: 38.72, lon: -9.13 }
        : null
    ),
  airline: (code) =>
    Promise.resolve(
      code.toUpperCase() === "LA" ? { code: "LA", name: "LATAM Airlines Group", isLowcost: false } : null
    ),
  searchAirports: (term, limit = 10) =>
    Promise.resolve(term.toLowerCase().startsWith("g") ? [GRU].slice(0, limit) : [])
};

beforeAll(async () => {
  jwks = await startFakeJwks();
  process.env.SUPABASE_JWKS_URL = jwks.jwksUrl;
  const { AppModule } = await import("../src/app.module");
  const mod = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GEO_PROVIDER)
    .useValue(fakeGeo)
    .compile();
  app = mod.createNestApplication();
  await app.init();
});

afterAll(async () => {
  await app.close();
  await jwks.stop();
});

describe("/geo", () => {
  it("whereami é público e devolve a origem provável pelo IP", async () => {
    const res = await request(app.getHttpServer()).get("/geo/whereami?ip=191.240.129.27");
    expect(res.status).toBe(200);
    expect(res.body.iata).toBe("XAP");
  });

  it("whereami devolve corpo vazio quando o IP não resolve", async () => {
    const res = await request(app.getHttpServer()).get("/geo/whereami?ip=0.0.0.0");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it("busca de aeroporto devolve os candidatos e respeita o limite", async () => {
    const res = await request(app.getHttpServer()).get("/geo/airports?q=gua&limit=1");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].iata).toBe("GRU");
  });

  it("busca de aeroporto sem termo responde 400", async () => {
    const res = await request(app.getHttpServer()).get("/geo/airports");
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation");
  });

  it("resolve aeroporto e companhia por código", async () => {
    const airport = await request(app.getHttpServer()).get("/geo/airports/gru");
    expect(airport.status).toBe(200);
    expect(airport.body.cityCode).toBe("SAO");

    const airline = await request(app.getHttpServer()).get("/geo/airlines/la");
    expect(airline.status).toBe(200);
    expect(airline.body.name).toContain("LATAM");
  });

  it("código desconhecido responde 404", async () => {
    expect((await request(app.getHttpServer()).get("/geo/airports/ZZZ")).status).toBe(404);
    expect((await request(app.getHttpServer()).get("/geo/airlines/ZZ")).status).toBe(404);
  });
});
