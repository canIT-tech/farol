import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { flightOfferSchema } from "@farol/shared";
import {
  CHEAP_PATH,
  CITY_DIRECTIONS_PATH,
  LATEST_PATH,
  MONTHLY_PATH,
  MONTH_MATRIX_PATH,
  NEAREST_PLACES_PATH,
  TravelpayoutsFlightProvider,
  toMonth
} from "./travelpayouts-flight-provider.js";
import type { Query, TravelpayoutsHttp } from "./http.js";

function fixture(name: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8")
  ) as unknown;
}

const FIXTURES: Record<string, string> = {
  [CHEAP_PATH]: "prices-cheap.json",
  [MONTHLY_PATH]: "prices-monthly.json",
  [CITY_DIRECTIONS_PATH]: "city-directions.json",
  [LATEST_PATH]: "prices-latest.json",
  [MONTH_MATRIX_PATH]: "month-matrix.json",
  [NEAREST_PLACES_PATH]: "nearest-places-matrix.json"
};

interface Recorded {
  path: string;
  query: Query;
}

function fakeHttp(overrides: Record<string, unknown> = {}): {
  http: TravelpayoutsHttp;
  calls: Recorded[];
} {
  const calls: Recorded[] = [];
  const http: TravelpayoutsHttp = {
    get: vi.fn(async (path: string, query: Query = {}) => {
      calls.push({ path, query });
      if (path in overrides) {
        const value = overrides[path];
        if (value instanceof Error) {
          throw value;
        }
        return value;
      }
      return fixture(FIXTURES[path]!);
    }) as TravelpayoutsHttp["get"],
    getText: vi.fn(async () => "")
  };
  return { http, calls };
}

const params = {
  originIata: "XAP",
  destinationIata: "GRU",
  departDate: "2026-09-17",
  returnDate: "2026-09-21",
  adults: 2,
  children: 1
};

function provider(http: TravelpayoutsHttp): TravelpayoutsFlightProvider {
  return new TravelpayoutsFlightProvider({ token: "tok", marker: "555", http });
}

describe("toMonth", () => {
  it("reduz uma data ISO ao mês", () => {
    expect(toMonth("2026-09-17")).toBe("2026-09");
  });
});

describe("TravelpayoutsFlightProvider.search", () => {
  it("junta /v1/prices/cheap e /v2/prices/nearest-places-matrix, ordenado por preço", async () => {
    const { http, calls } = fakeHttp();
    const offers = await provider(http).search(params);

    expect(calls.map((c) => c.path).sort()).toEqual([CHEAP_PATH, NEAREST_PLACES_PATH].sort());
    expect(offers.length).toBeGreaterThan(1);
    for (const offer of offers) {
      expect(() => flightOfferSchema.parse(offer)).not.toThrow();
    }
    const prices = offers.map((o) => o.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("manda mês nos params do cheap e data exata no nearest-places", async () => {
    const { http, calls } = fakeHttp();
    await provider(http).search(params);

    const cheap = calls.find((c) => c.path === CHEAP_PATH)!.query;
    expect(cheap).toMatchObject({
      origin: "XAP",
      destination: "GRU",
      depart_date: "2026-09",
      return_date: "2026-09",
      currency: "brl"
    });

    const nearest = calls.find((c) => c.path === NEAREST_PLACES_PATH)!.query;
    expect(nearest).toMatchObject({
      depart_date: "2026-09-17",
      return_date: "2026-09-21",
      show_to_affiliates: true
    });
  });

  it("omite return_date quando a viagem é só de ida", async () => {
    const { http, calls } = fakeHttp();
    const oneWay: Omit<typeof params, "returnDate"> & { returnDate?: string } = { ...params };
    delete oneWay.returnDate;
    await provider(http).search(oneWay);

    expect(calls.find((c) => c.path === CHEAP_PATH)!.query.return_date).toBeUndefined();
  });

  it("segue respondendo quando só uma das duas fontes falha", async () => {
    const { http } = fakeHttp({ [NEAREST_PLACES_PATH]: new Error("503") });
    const offers = await provider(http).search(params);
    expect(offers).toHaveLength(1);
    expect(offers[0]!.id).toBe("cheap:XAP:SAO:0");
  });

  it("propaga o erro quando as duas fontes falham", async () => {
    const { http } = fakeHttp({
      [CHEAP_PATH]: new Error("cheap fora"),
      [NEAREST_PLACES_PATH]: new Error("nearest fora")
    });
    await expect(provider(http).search(params)).rejects.toThrow("cheap fora");
  });

  it("filtra por maxStops quando o parâmetro vem", async () => {
    const { http } = fakeHttp({
      [CHEAP_PATH]: {
        currency: "brl",
        data: {
          GRU: {
            "0": {
              airline: "LA",
              departure_at: "2026-09-17T09:50:00-03:00",
              return_at: "",
              price: 100,
              flight_number: 1,
              duration: 100,
              transfers: 2
            }
          }
        }
      },
      [NEAREST_PLACES_PATH]: { prices: [] }
    });
    await expect(provider(http).search({ ...params, maxStops: 1 })).resolves.toEqual([]);
    await expect(provider(http).search({ ...params, maxStops: 2 })).resolves.toHaveLength(1);
  });

  it("deduplica ofertas com o mesmo id vindas das duas fontes", async () => {
    const offer = {
      link: "/s",
      origin: "SAO",
      destination: "RIO",
      gate: "g",
      main_airline: "AD",
      depart_date: "2027-05-02T10:10:00-03:00",
      found_at: "",
      transfers: 0,
      duration: 60,
      distance: 1,
      price: 164
    };
    const { http } = fakeHttp({
      [CHEAP_PATH]: {},
      [NEAREST_PLACES_PATH]: { prices: [offer, { ...offer }] }
    });
    await expect(provider(http).search(params)).resolves.toHaveLength(1);
  });
});

describe("TravelpayoutsFlightProvider — endpoints de contexto", () => {
  it("priceCalendar usa /v2/prices/month-matrix ordenado por data", async () => {
    const { http, calls } = fakeHttp();
    const days = await provider(http).priceCalendar({
      originIata: "GRU",
      destinationIata: "SDU"
    });

    expect(calls[0]!.path).toBe(MONTH_MATRIX_PATH);
    expect(calls[0]!.query).toMatchObject({ origin: "GRU", destination: "SDU", currency: "brl" });
    const dates = days.map((d) => d.departDate);
    expect(dates).toEqual([...dates].sort());
  });

  it("latestPrices usa /v2/prices/latest com os defaults de período e paginação", async () => {
    const { http, calls } = fakeHttp();
    const samples = await provider(http).latestPrices({
      originIata: "GRU",
      destinationIata: "BKK"
    });

    expect(calls[0]!.query).toMatchObject({
      period_type: "year",
      page: 1,
      limit: 30,
      sorting: "price",
      trip_class: 0
    });
    const prices = samples.map((s) => s.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("latestPrices respeita periodType, page e limit informados", async () => {
    const { http, calls } = fakeHttp();
    await provider(http).latestPrices({
      originIata: "GRU",
      destinationIata: "BKK",
      periodType: "month",
      page: 3,
      limit: 5
    });
    expect(calls[0]!.query).toMatchObject({ period_type: "month", page: 3, limit: 5 });
  });

  it("monthlyPrices usa /v1/prices/monthly ordenado por mês", async () => {
    const { http, calls } = fakeHttp();
    const months = await provider(http).monthlyPrices({
      originIata: "GRU",
      destinationIata: "BSB"
    });

    expect(calls[0]!.path).toBe(MONTHLY_PATH);
    const keys = months.map((m) => m.key);
    expect(keys).toEqual([...keys].sort());
    expect(keys[0]).toMatch(/^\d{4}-\d{2}$/);
  });

  it("cityDirections usa /v1/city-directions ordenado por preço", async () => {
    const { http, calls } = fakeHttp();
    const deals = await provider(http).cityDirections("MOW");

    expect(calls[0]!.path).toBe(CITY_DIRECTIONS_PATH);
    expect(calls[0]!.query).toMatchObject({ origin: "MOW" });
    const prices = deals.map((d) => d.price);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it("passa os passageiros para o deep link e respeita currency e template configurados", async () => {
    const { http } = fakeHttp();
    const custom = new TravelpayoutsFlightProvider({
      token: "tok",
      marker: "555",
      currency: "usd",
      deepLinkTemplate: "https://x.example.com/{origin}-{destination}?p={passengers}&m={marker}",
      http
    });
    const deals = await custom.cityDirections("MOW", 3);
    expect(deals[0]!.deepLink).toContain("?p=3&m=555");
  });

  it("monta o http real quando nenhum é injetado", () => {
    expect(() => new TravelpayoutsFlightProvider({ token: "t", marker: "m" })).not.toThrow();
  });
});
