import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  hotelSearchParamsSchema,
  hotelOfferSchema,
  providerSectionSchema
} from "./hotels.js";

const baseParams = {
  cityCode: "LIS",
  checkIn: "2026-09-10",
  checkOut: "2026-09-17",
  adults: 2
};

const baseOffer = {
  id: "hot-1",
  name: "Hotel do Chiado",
  region: "Chiado",
  pricePerNight: 180,
  priceTotal: 1260,
  currency: "BRL",
  rating: 4.5,
  deepLink: "https://parceiro.example.com/hoteis?c=LIS"
};

describe("hotelSearchParamsSchema", () => {
  it("aceita parâmetros válidos sem radiusKm", () => {
    expect(hotelSearchParamsSchema.parse(baseParams).radiusKm).toBeUndefined();
  });

  it("aceita radiusKm opcional", () => {
    expect(hotelSearchParamsSchema.parse({ ...baseParams, radiusKm: 5 }).radiusKm).toBe(5);
  });

  it("rejeita cityCode vazio", () => {
    expect(() => hotelSearchParamsSchema.parse({ ...baseParams, cityCode: "" })).toThrow();
  });

  it("rejeita checkIn fora do formato", () => {
    expect(() => hotelSearchParamsSchema.parse({ ...baseParams, checkIn: "2026/09/10" })).toThrow();
  });

  it("exige ao menos 1 adulto", () => {
    expect(() => hotelSearchParamsSchema.parse({ ...baseParams, adults: 0 })).toThrow();
  });

  it("rejeita radiusKm não-positivo", () => {
    expect(() => hotelSearchParamsSchema.parse({ ...baseParams, radiusKm: 0 })).toThrow();
  });
});

describe("hotelOfferSchema", () => {
  it("aceita uma oferta completa", () => {
    expect(hotelOfferSchema.parse(baseOffer).name).toBe("Hotel do Chiado");
  });

  it("aceita region e rating nulos", () => {
    const parsed = hotelOfferSchema.parse({ ...baseOffer, region: null, rating: null });
    expect(parsed.region).toBeNull();
    expect(parsed.rating).toBeNull();
  });

  it("rejeita rating fora de 0..5", () => {
    expect(() => hotelOfferSchema.parse({ ...baseOffer, rating: 5.5 })).toThrow();
    expect(() => hotelOfferSchema.parse({ ...baseOffer, rating: -0.1 })).toThrow();
  });

  it("aceita os limites de rating (0 e 5)", () => {
    expect(hotelOfferSchema.parse({ ...baseOffer, rating: 0 }).rating).toBe(0);
    expect(hotelOfferSchema.parse({ ...baseOffer, rating: 5 }).rating).toBe(5);
  });

  it("rejeita preços não-positivos", () => {
    expect(() => hotelOfferSchema.parse({ ...baseOffer, pricePerNight: 0 })).toThrow();
    expect(() => hotelOfferSchema.parse({ ...baseOffer, priceTotal: 0 })).toThrow();
  });

  it("rejeita deepLink que não é URL", () => {
    expect(() => hotelOfferSchema.parse({ ...baseOffer, deepLink: "x" })).toThrow();
  });
});

describe("providerSectionSchema", () => {
  const section = providerSectionSchema(z.object({ id: z.string() }));

  it("aceita uma seção com ofertas, sem erro", () => {
    const parsed = section.parse({ offers: [{ id: "a" }], stale: false, error: null });
    expect(parsed.offers).toHaveLength(1);
    expect(parsed.error).toBeNull();
  });

  it("aceita seção vazia degradada com error 'unavailable'", () => {
    const parsed = section.parse({ offers: [], stale: false, error: "unavailable" });
    expect(parsed.error).toBe("unavailable");
  });

  it("rejeita error com valor diferente de 'unavailable' ou null", () => {
    expect(() => section.parse({ offers: [], stale: false, error: "boom" })).toThrow();
  });

  it("rejeita stale que não é boolean", () => {
    expect(() => section.parse({ offers: [], stale: "no", error: null })).toThrow();
  });

  it("guarda o fetchedAt e assume nulo quando não vem", () => {
    const comData = section.parse({
      offers: [],
      stale: false,
      fetchedAt: "2026-09-02T21:00:00.000Z",
      error: null
    });
    expect(comData.fetchedAt).toBe("2026-09-02T21:00:00.000Z");
    expect(section.parse({ offers: [], stale: false, error: null }).fetchedAt).toBeNull();
  });

  it("rejeita fetchedAt vazio", () => {
    expect(() => section.parse({ offers: [], stale: false, fetchedAt: "", error: null })).toThrow();
  });
});
