import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  hotelSearchParamsSchema,
  hotelOfferSchema,
  providerSectionSchema
} from "./hotels.js";

const baseParams = {
  cityCode: "LIS",
  countryCode: "PT",
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
  address: "R. Nova do Almada 114",
  reviewCount: 1280,
  stars: 4,
  photoUrl: "https://static.cupid.travel/hotels/1.jpg",
  lat: 38.71,
  lng: -9.14,
  deepLink: "https://parceiro.example.com/hoteis?c=LIS"
};

describe("hotelSearchParamsSchema", () => {
  it("aceita parâmetros válidos sem localização", () => {
    const parsed = hotelSearchParamsSchema.parse(baseParams);
    expect(parsed.latitude).toBeUndefined();
    expect(parsed.longitude).toBeUndefined();
    expect(parsed.radiusMeters).toBeUndefined();
    expect(parsed.cityName).toBeUndefined();
  });

  it("aceita coordenada, raio e nome de cidade", () => {
    const parsed = hotelSearchParamsSchema.parse({
      ...baseParams,
      latitude: 38.72,
      longitude: -9.13,
      radiusMeters: 5000,
      cityName: "Lisbon"
    });
    expect(parsed.latitude).toBe(38.72);
    expect(parsed.radiusMeters).toBe(5000);
    expect(parsed.cityName).toBe("Lisbon");
  });

  it("rejeita countryCode fora de 2 letras", () => {
    expect(() => hotelSearchParamsSchema.parse({ ...baseParams, countryCode: "PRT" })).toThrow();
  });

  it("rejeita coordenada fora do intervalo válido", () => {
    expect(() => hotelSearchParamsSchema.parse({ ...baseParams, latitude: 91 })).toThrow();
    expect(() => hotelSearchParamsSchema.parse({ ...baseParams, longitude: -181 })).toThrow();
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

  it("rejeita raio menor que o mínimo aceito pelo provider", () => {
    expect(() => hotelSearchParamsSchema.parse({ ...baseParams, radiusMeters: 999 })).toThrow();
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

describe("hotelOfferSchema — campos do cartão hi-fi", () => {
  it("assume nulo em foto, endereço, estrelas, avaliações e coordenada", () => {
    const magro: Partial<typeof baseOffer> = { ...baseOffer };
    for (const key of ["address", "reviewCount", "stars", "photoUrl", "lat", "lng"] as const) {
      delete magro[key];
    }
    const parsed = hotelOfferSchema.parse(magro);
    expect(parsed.address).toBeNull();
    expect(parsed.reviewCount).toBeNull();
    expect(parsed.stars).toBeNull();
    expect(parsed.photoUrl).toBeNull();
    expect(parsed.lat).toBeNull();
    expect(parsed.lng).toBeNull();
  });

  it("aceita hotel sem classificação oficial (stars 0)", () => {
    expect(hotelOfferSchema.parse({ ...baseOffer, stars: 0 }).stars).toBe(0);
  });

  it("rejeita stars fora de 0..5 e reviewCount negativo", () => {
    expect(() => hotelOfferSchema.parse({ ...baseOffer, stars: 6 })).toThrow();
    expect(() => hotelOfferSchema.parse({ ...baseOffer, reviewCount: -1 })).toThrow();
  });

  it("rejeita photoUrl que não é URL", () => {
    expect(() => hotelOfferSchema.parse({ ...baseOffer, photoUrl: "foto.jpg" })).toThrow();
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
