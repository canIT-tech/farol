import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { hotelOfferSchema } from "@farol/shared";
import {
  HOTELS_PATH,
  LiteApiHotelProvider,
  MIN_RATES_PATH
} from "./liteapi-hotel-provider.js";
import type { LiteApiHttp } from "./http.js";
import type { Query } from "../http/query.js";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8")
  ) as unknown;
}

interface Recorded {
  path: string;
  query?: Query;
  body?: unknown;
}

function fakeHttp(overrides: Record<string, unknown> = {}): {
  http: LiteApiHttp;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  const answer = (path: string) => {
    if (path in overrides) {
      const value = overrides[path];
      if (value instanceof Error) throw value;
      return value;
    }
    return fixture(path === HOTELS_PATH ? "data-hotels.json" : "min-rates.json");
  };
  const http: LiteApiHttp = {
    get: vi.fn(async (path: string, query: Query = {}) => {
      calls.push({ path, query });
      return answer(path);
    }) as LiteApiHttp["get"],
    post: vi.fn(async (path: string, body: unknown) => {
      calls.push({ path, body });
      return answer(path);
    }) as LiteApiHttp["post"]
  };
  return { http, calls };
}

const TEMPLATE = "https://parceiro.example.com/h?c={cityName}&in={checkIn}&out={checkOut}";

const params = {
  cityCode: "LIS",
  countryCode: "PT",
  cityName: "Lisbon",
  latitude: 38.7222524,
  longitude: -9.1393366,
  checkIn: "2026-11-10",
  checkOut: "2026-11-15",
  adults: 2
};

function provider(http: LiteApiHttp, over: Record<string, unknown> = {}): LiteApiHotelProvider {
  return new LiteApiHotelProvider({
    apiKey: "sand_x",
    deepLinkTemplate: TEMPLATE,
    http,
    ...over
  });
}

describe("LiteApiHotelProvider.search", () => {
  it("busca conteúdo e tarifa e devolve ofertas válidas", async () => {
    const { http, calls } = fakeHttp();
    const offers = await provider(http).search(params);

    expect(calls.map((c) => c.path)).toEqual([HOTELS_PATH, MIN_RATES_PATH]);
    expect(offers.length).toBeGreaterThan(0);
    for (const offer of offers) {
      expect(() => hotelOfferSchema.parse(offer)).not.toThrow();
    }
  });

  it("prefere coordenada e raio — nome de cidade depende do idioma", async () => {
    const { http, calls } = fakeHttp();
    await provider(http).search(params);

    expect(calls[0]!.query).toEqual({
      countryCode: "PT",
      latitude: 38.7222524,
      longitude: -9.1393366,
      radius: 5000,
      cityName: undefined,
      limit: 25
    });
  });

  it("respeita o raio informado nos parâmetros e o default configurado", async () => {
    const comRaio = fakeHttp();
    await provider(comRaio.http).search({ ...params, radiusMeters: 12_000 });
    expect(comRaio.calls[0]!.query!.radius).toBe(12_000);

    const configurado = fakeHttp();
    await provider(configurado.http, { defaultRadiusMeters: 3000 }).search(params);
    expect(configurado.calls[0]!.query!.radius).toBe(3000);
  });

  it("cai no nome da cidade quando não há coordenada", async () => {
    const { http, calls } = fakeHttp();
    const { latitude: _lat, longitude: _lon, ...semCoordenada } = params;
    await provider(http).search(semCoordenada);

    expect(calls[0]!.query).toMatchObject({
      countryCode: "PT",
      cityName: "Lisbon",
      latitude: undefined,
      longitude: undefined,
      radius: undefined
    });
  });

  it("manda hóspedes, datas, moeda e nacionalidade na busca de tarifa", async () => {
    const { http, calls } = fakeHttp();
    await provider(http).search(params);

    expect(calls[1]!.body).toEqual({
      hotelIds: ["lp65571137", "lpaf35b", "lp36b7f", "lp74dd5"],
      occupancies: [{ adults: 2 }],
      checkin: "2026-11-10",
      checkout: "2026-11-15",
      currency: "BRL",
      guestNationality: "BR"
    });
  });

  it("respeita moeda, nacionalidade e limite configurados", async () => {
    const { http, calls } = fakeHttp();
    await provider(http, { currency: "EUR", guestNationality: "PT", limit: 5 }).search(params);

    expect(calls[0]!.query!.limit).toBe(5);
    expect(calls[1]!.body).toMatchObject({ currency: "EUR", guestNationality: "PT" });
  });

  it("não pede tarifa quando o destino não tem hotel — pouparia uma chamada à toa", async () => {
    const vazio = fakeHttp({ [HOTELS_PATH]: { data: [] } });
    await expect(provider(vazio.http).search(params)).resolves.toEqual([]);
    expect(vazio.calls.map((c) => c.path)).toEqual([HOTELS_PATH]);

    const semData = fakeHttp({ [HOTELS_PATH]: {} });
    await expect(provider(semData.http).search(params)).resolves.toEqual([]);
    expect(semData.calls.map((c) => c.path)).toEqual([HOTELS_PATH]);
  });

  it("usa o IATA no deep link quando o destino não tem nome de cidade", async () => {
    const { http } = fakeHttp();
    const { cityName: _drop, ...semNome } = params;
    const offers = await provider(http, {
      deepLinkTemplate: "https://parceiro.example.com/h?c={cityName}"
    }).search(semNome);

    expect(offers[0]!.deepLink).toBe("https://parceiro.example.com/h?c=LIS");
  });

  it("propaga a falha do provider — quem degrada a seção é o serviço", async () => {
    const { http } = fakeHttp({ [HOTELS_PATH]: new Error("503") });
    await expect(provider(http).search(params)).rejects.toThrow("503");
  });

  it("rejeita parâmetros inválidos antes de chamar a rede", async () => {
    const { http, calls } = fakeHttp();
    await expect(provider(http).search({ ...params, adults: 0 })).rejects.toThrow();
    expect(calls).toHaveLength(0);
  });

  it("monta o http real quando nenhum é injetado", () => {
    expect(
      () => new LiteApiHotelProvider({ apiKey: "k", deepLinkTemplate: TEMPLATE })
    ).not.toThrow();
  });
});
