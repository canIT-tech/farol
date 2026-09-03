import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { flightOfferSchema, routeDealSchema, routePriceSampleSchema } from "@farol/shared";
import {
  addMinutes,
  buildDeepLink,
  normalizeCheap,
  normalizeKeyedDeals,
  normalizeMatrixSamples,
  normalizeNearestPlaces,
  type TpCheapResponse,
  type TpKeyedDealsResponse,
  type TpMatrixResponse,
  type TpNearestResponse
} from "./normalize-flight.js";
import { AVIASALES_BASE_URL, AVIASALES_SEARCH_TEMPLATE } from "./deep-link.js";
import { nullIfEmpty } from "../text.js";

function fixture<T>(name: string): T {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8")
  ) as T;
}

const ctx = { template: AVIASALES_SEARCH_TEMPLATE, marker: "555", passengers: 1 };

describe("nullIfEmpty", () => {
  it("devolve null para string vazia e para undefined", () => {
    expect(nullIfEmpty("")).toBeNull();
    expect(nullIfEmpty(undefined)).toBeNull();
  });

  it("devolve o valor quando há conteúdo", () => {
    expect(nullIfEmpty("Trip.com")).toBe("Trip.com");
  });
});

describe("addMinutes", () => {
  it("soma minutos a um instante ISO", () => {
    expect(addMinutes("2026-10-22T10:00:00Z", 65)).toBe("2026-10-22T11:05:00.000Z");
  });

  it("devolve o mesmo instante quando soma zero", () => {
    expect(addMinutes("2026-10-22T10:00:00Z", 0)).toBe("2026-10-22T10:00:00.000Z");
  });

  it("preserva offset negativo em vez de converter para UTC", () => {
    expect(addMinutes("2027-05-02T10:10:00-03:00", 60)).toBe("2027-05-02T11:10:00-03:00");
  });

  it("preserva offset positivo em vez de converter para UTC", () => {
    expect(addMinutes("2027-05-02T22:10:00+09:00", 60)).toBe("2027-05-02T23:10:00+09:00");
  });
});

describe("buildDeepLink", () => {
  it("monta a busca de ida e volta com marker e passageiros", () => {
    expect(
      buildDeepLink(
        { ...ctx, passengers: 2 },
        { origin: "GRU", destination: "LIS", departDate: "2026-09-10", returnDate: "2026-09-20" }
      )
    ).toBe(`${AVIASALES_BASE_URL}/search/GRU1009LIS20092?marker=555`);
  });

  it("omite o trecho de volta quando returnDate é null", () => {
    expect(
      buildDeepLink(ctx, {
        origin: "GRU",
        destination: "LIS",
        departDate: "2026-09-10",
        returnDate: null
      })
    ).toBe(`${AVIASALES_BASE_URL}/search/GRU1009LIS1?marker=555`);
  });
});

describe("normalizeMatrixSamples", () => {
  const monthMatrix = fixture<TpMatrixResponse>("month-matrix.json");
  const latest = fixture<TpMatrixResponse>("prices-latest.json");

  it("normaliza o calendário do mês (month-matrix) da fixture real", () => {
    const samples = normalizeMatrixSamples(monthMatrix, ctx);
    expect(samples.length).toBe(monthMatrix.data!.length);
    for (const sample of samples) {
      expect(() => routePriceSampleSchema.parse(sample)).not.toThrow();
      expect(sample.deepLink).toContain("marker=555");
    }
    expect(samples[0]!.origin).toBe("SAO");
    expect(samples[0]!.destination).toBe("RIO");
  });

  it("normaliza os preços recentes (latest) da fixture real, com ida e volta", () => {
    const samples = normalizeMatrixSamples(latest, ctx);
    expect(samples.length).toBe(latest.data!.length);
    expect(samples[0]!.returnDate).not.toBeNull();
    expect(samples[0]!.currency).toBe("brl");
  });

  it("mapeia value/number_of_changes/duration para price/transfers/durationMinutes", () => {
    const raw: TpMatrixResponse = {
      currency: "brl",
      data: [
        {
          depart_date: "2026-10-22",
          return_date: "",
          origin: "SAO",
          destination: "RIO",
          gate: "Trip.com",
          found_at: "2026-08-29T04:34:14Z",
          trip_class: 0,
          value: 337,
          number_of_changes: 1,
          duration: 65,
          distance: 343
        }
      ]
    };
    expect(normalizeMatrixSamples(raw, ctx)[0]).toEqual({
      origin: "SAO",
      destination: "RIO",
      departDate: "2026-10-22",
      returnDate: null,
      price: 337,
      currency: "brl",
      transfers: 1,
      durationMinutes: 65,
      gate: "Trip.com",
      foundAt: "2026-08-29T04:34:14Z",
      deepLink: `${AVIASALES_BASE_URL}/search/SAO2210RIO1?marker=555`
    });
  });

  it("corta a data quando o item vem com timestamp completo", () => {
    const raw: TpMatrixResponse = {
      currency: "brl",
      data: [
        {
          depart_date: "2026-10-22T10:10:00-03:00",
          return_date: "2026-10-30T08:00:00-03:00",
          origin: "SAO",
          destination: "RIO",
          gate: "",
          found_at: "",
          trip_class: 0,
          value: 337,
          number_of_changes: 0,
          duration: 0,
          distance: 343
        }
      ]
    };
    const sample = normalizeMatrixSamples(raw, ctx)[0]!;
    expect(sample.departDate).toBe("2026-10-22");
    expect(sample.returnDate).toBe("2026-10-30T08:00:00-03:00");
    expect(sample.gate).toBeNull();
    expect(sample.foundAt).toBeNull();
    expect(sample.deepLink).toBe(`${AVIASALES_BASE_URL}/search/SAO2210RIO30101?marker=555`);
  });

  it("cai para brl e lista vazia quando a resposta não traz currency nem data", () => {
    expect(normalizeMatrixSamples({}, ctx)).toEqual([]);
    expect(normalizeMatrixSamples({ data: [] }, ctx)).toEqual([]);
  });
});

describe("normalizeNearestPlaces", () => {
  const nearest = fixture<TpNearestResponse>("nearest-places-matrix.json");

  it("normaliza a fixture real em ofertas válidas com link do Aviasales", () => {
    const offers = normalizeNearestPlaces(nearest, ctx, "brl");
    expect(offers.length).toBe(nearest.prices!.length);
    for (const offer of offers) {
      expect(() => flightOfferSchema.parse(offer)).not.toThrow();
      expect(offer.deepLink.startsWith(`${AVIASALES_BASE_URL}/search/`)).toBe(true);
      expect(offer.deepLink).toContain("&marker=555");
      expect(offer.returnAt).toBeNull();
    }
    expect(offers[0]!.carrier).toBe("AD");
  });

  it("calcula arriveAt a partir da duração e usa transfers como escalas", () => {
    const raw: TpNearestResponse = {
      prices: [
        {
          link: "/search/SAO0205RIO1?t=abc",
          origin: "SAO",
          destination: "RIO",
          gate: "Trip.com",
          main_airline: "AD",
          depart_date: "2027-05-02T10:10:00-03:00",
          found_at: "2026-08-31T12:14:48Z",
          transfers: 2,
          duration: 60,
          distance: 343,
          price: 164
        }
      ]
    };
    const offer = normalizeNearestPlaces(raw, ctx, "brl")[0]!;
    expect(offer.id).toBe("np:SAO:RIO:2027-05-02T10:10:00-03:00:164");
    expect(offer.originIata).toBe("SAO");
    expect(offer.destinationIata).toBe("RIO");
    expect(offer.carrierName).toBeNull();
    expect(offer.originName).toBeNull();
    expect(offer.stops).toBe(2);
    expect(offer.arriveAt).toBe("2027-05-02T11:10:00-03:00");
    expect(offer.deepLink).toBe(`${AVIASALES_BASE_URL}/search/SAO0205RIO1?t=abc&marker=555`);
  });

  it("usa o gate como carrier quando não há main_airline, e a origem como último recurso", () => {
    const item = {
      link: "/s",
      origin: "SAO",
      destination: "RIO",
      gate: "Trip.com",
      main_airline: "",
      depart_date: "2027-05-02T10:10:00-03:00",
      found_at: "",
      transfers: 0,
      duration: 60,
      distance: 1,
      price: 164
    };
    expect(normalizeNearestPlaces({ prices: [item] }, ctx, "brl")[0]!.carrier).toBe("Trip.com");
    expect(
      normalizeNearestPlaces({ prices: [{ ...item, gate: "" }] }, ctx, "brl")[0]!.carrier
    ).toBe("SAO");
  });

  it("devolve lista vazia quando não há prices", () => {
    expect(normalizeNearestPlaces({}, ctx, "brl")).toEqual([]);
  });
});

describe("normalizeCheap", () => {
  const cheap = fixture<TpCheapResponse>("prices-cheap.json");

  it("normaliza a fixture real, achatando destino e índice", () => {
    const offers = normalizeCheap(cheap, ctx, "XAP");
    expect(offers).toHaveLength(1);
    const offer = offers[0]!;
    expect(() => flightOfferSchema.parse(offer)).not.toThrow();
    expect(offer.id).toBe("cheap:XAP:SAO:0");
    expect(offer.originIata).toBe("XAP");
    expect(offer.destinationIata).toBe("SAO");
    expect(offer.carrier).toBe("LA");
    expect(offer.stops).toBe(0);
    expect(offer.returnAt).toBe("2026-09-21T07:05:00-03:00");
    expect(offer.durationMinutes).toBe(190);
    expect(offer.deepLink).toBe(`${AVIASALES_BASE_URL}/search/XAP1709SAO21091?marker=555`);
  });

  it("usa duration_to para o arriveAt e cai para duration quando não vem", () => {
    const item = {
      airline: "LA",
      departure_at: "2026-09-17T09:50:00Z",
      return_at: "",
      price: 1097,
      flight_number: 3279,
      duration: 190,
      duration_to: 90,
      transfers: 1
    };
    const withTo = normalizeCheap({ data: { SAO: { "0": item } } }, ctx, "XAP")[0]!;
    expect(withTo.arriveAt).toBe("2026-09-17T11:20:00.000Z");
    expect(withTo.stops).toBe(1);
    expect(withTo.returnAt).toBeNull();
    expect(withTo.currency).toBe("brl");

    const noTo: Omit<typeof item, "duration_to"> & { duration_to?: number } = { ...item };
    delete noTo.duration_to;
    const fallback = normalizeCheap({ data: { SAO: { "0": noTo } } }, ctx, "XAP")[0]!;
    expect(fallback.arriveAt).toBe("2026-09-17T13:00:00.000Z");
  });

  it("devolve lista vazia quando não há data", () => {
    expect(normalizeCheap({}, ctx, "XAP")).toEqual([]);
  });
});

describe("normalizeKeyedDeals", () => {
  const monthly = fixture<TpKeyedDealsResponse>("prices-monthly.json");
  const directions = fixture<TpKeyedDealsResponse>("city-directions.json");

  it("normaliza /v1/prices/monthly com o mês como chave", () => {
    const deals = normalizeKeyedDeals(monthly, ctx);
    expect(deals.length).toBe(Object.keys(monthly.data!).length);
    for (const deal of deals) {
      expect(() => routeDealSchema.parse(deal)).not.toThrow();
      expect(deal.key).toMatch(/^\d{4}-\d{2}$/);
      expect(deal.deepLink).toContain("marker=555");
    }
    // Voo com número real vira string; só o 0 (ausente) vira null.
    const comNumero = deals.find((d) => d.flightNumber !== null)!;
    expect(comNumero.flightNumber).toMatch(/^\d+$/);
  });

  it("normaliza /v1/city-directions com o IATA do destino como chave", () => {
    const deals = normalizeKeyedDeals(directions, ctx);
    expect(deals.length).toBe(Object.keys(directions.data!).length);
    for (const deal of deals) {
      expect(deal.key).toBe(deal.destination);
    }
  });

  it("mapeia os campos e trata flight_number 0 e volta vazia", () => {
    const raw: TpKeyedDealsResponse = {
      currency: "BRL",
      data: {
        "2026-09": {
          origin: "SAO",
          destination: "BSB",
          airline: "G3",
          departure_at: "2026-09-26T08:40:00-03:00",
          return_at: "",
          price: 760,
          flight_number: 0,
          transfers: 1
        }
      }
    };
    expect(normalizeKeyedDeals(raw, ctx)[0]).toEqual({
      key: "2026-09",
      origin: "SAO",
      destination: "BSB",
      airline: "G3",
      departAt: "2026-09-26T08:40:00-03:00",
      returnAt: null,
      price: 760,
      currency: "BRL",
      flightNumber: null,
      transfers: 1,
      deepLink: `${AVIASALES_BASE_URL}/search/SAO2609BSB1?marker=555`
    });
  });

  it("devolve lista vazia quando não há data", () => {
    expect(normalizeKeyedDeals({}, ctx)).toEqual([]);
  });
});
