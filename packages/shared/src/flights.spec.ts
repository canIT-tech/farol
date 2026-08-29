import { describe, it, expect } from "vitest";
import { flightSearchParamsSchema, flightOfferSchema } from "./flights";

const baseParams = {
  originIata: "GRU",
  destinationIata: "LIS",
  departDate: "2026-09-10",
  adults: 2,
  children: 0
};

const baseOffer = {
  id: "off-1",
  price: 3200.5,
  currency: "BRL",
  carrier: "TP",
  stops: 1,
  departAt: "2026-09-10T22:10:00",
  arriveAt: "2026-09-11T12:40:00",
  returnAt: null,
  durationMinutes: 750,
  deepLink: "https://parceiro.example.com/voos?o=GRU&d=LIS"
};

describe("flightSearchParamsSchema", () => {
  it("aceita parâmetros válidos sem returnDate/maxStops", () => {
    const parsed = flightSearchParamsSchema.parse(baseParams);
    expect(parsed.returnDate).toBeUndefined();
    expect(parsed.maxStops).toBeUndefined();
  });

  it("aceita returnDate e maxStops opcionais", () => {
    const parsed = flightSearchParamsSchema.parse({
      ...baseParams,
      returnDate: "2026-09-20",
      maxStops: 0
    });
    expect(parsed.returnDate).toBe("2026-09-20");
    expect(parsed.maxStops).toBe(0);
  });

  it("rejeita iata que não tem 3 letras", () => {
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, originIata: "GR" })).toThrow();
    expect(() =>
      flightSearchParamsSchema.parse({ ...baseParams, destinationIata: "LISB" })
    ).toThrow();
  });

  it("rejeita departDate fora do formato YYYY-MM-DD", () => {
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, departDate: "10/09/2026" })).toThrow();
  });

  it("exige ao menos 1 adulto e children >= 0", () => {
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, adults: 0 })).toThrow();
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, children: -1 })).toThrow();
  });

  it("rejeita maxStops negativo ou fracionário", () => {
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, maxStops: -1 })).toThrow();
    expect(() => flightSearchParamsSchema.parse({ ...baseParams, maxStops: 1.5 })).toThrow();
  });
});

describe("flightOfferSchema", () => {
  it("aceita uma oferta completa", () => {
    expect(flightOfferSchema.parse(baseOffer).id).toBe("off-1");
  });

  it("aceita returnAt string quando é ida-e-volta", () => {
    const parsed = flightOfferSchema.parse({ ...baseOffer, returnAt: "2026-09-20T08:00:00" });
    expect(parsed.returnAt).toBe("2026-09-20T08:00:00");
  });

  it("rejeita stops negativo", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, stops: -1 })).toThrow();
  });

  it("aceita stops zero (voo direto)", () => {
    expect(flightOfferSchema.parse({ ...baseOffer, stops: 0 }).stops).toBe(0);
  });

  it("rejeita price não-positivo", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, price: 0 })).toThrow();
  });

  it("rejeita durationMinutes não-positivo ou fracionário", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, durationMinutes: 0 })).toThrow();
    expect(() => flightOfferSchema.parse({ ...baseOffer, durationMinutes: 12.5 })).toThrow();
  });

  it("rejeita deepLink que não é URL", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, deepLink: "nao-e-url" })).toThrow();
  });

  it("rejeita carrier vazio", () => {
    expect(() => flightOfferSchema.parse({ ...baseOffer, carrier: "" })).toThrow();
  });
});
