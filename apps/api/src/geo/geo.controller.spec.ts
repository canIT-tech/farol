import { describe, it, expect, vi } from "vitest";
import { airportQuerySchema, GeoController } from "./geo.controller";
import type { GeoService } from "./geo.service";

function controller(): { ctrl: GeoController; service: GeoService } {
  const service = {
    whereami: vi.fn(() => Promise.resolve(null)),
    searchAirports: vi.fn(() => Promise.resolve([])),
    airport: vi.fn(() => Promise.resolve({ iata: "GRU" })),
    airline: vi.fn(() => Promise.resolve({ code: "LA" }))
  } as unknown as GeoService;
  return { ctrl: new GeoController(service), service };
}

describe("airportQuerySchema", () => {
  it("assume limite 10 quando não vem", () => {
    expect(airportQuerySchema.parse({ q: "gru" })).toEqual({ q: "gru", limit: 10 });
  });

  it("converte o limite que chega como string na query", () => {
    expect(airportQuerySchema.parse({ q: "gru", limit: "5" }).limit).toBe(5);
  });

  it("rejeita termo vazio e limite fora da faixa", () => {
    expect(() => airportQuerySchema.parse({ q: "" })).toThrow();
    expect(() => airportQuerySchema.parse({ q: "a", limit: 0 })).toThrow();
    expect(() => airportQuerySchema.parse({ q: "a", limit: 51 })).toThrow();
  });
});

describe("GeoController", () => {
  it("usa o IP da requisição quando não há override na query", async () => {
    const { ctrl, service } = controller();
    await ctrl.whereami("200.1.2.3");
    expect(service.whereami).toHaveBeenCalledWith("200.1.2.3");
  });

  it("prefere o IP passado na query", async () => {
    const { ctrl, service } = controller();
    await ctrl.whereami("200.1.2.3", "191.240.129.27");
    expect(service.whereami).toHaveBeenCalledWith("191.240.129.27");
  });

  it("repassa termo e limite na busca de aeroporto", async () => {
    const { ctrl, service } = controller();
    await ctrl.airports({ q: "gua", limit: 5 });
    expect(service.searchAirports).toHaveBeenCalledWith("gua", 5);
  });

  it("repassa o código em airport e airline", async () => {
    const { ctrl, service } = controller();
    await ctrl.airport("GRU");
    await ctrl.airline("LA");
    expect(service.airport).toHaveBeenCalledWith("GRU");
    expect(service.airline).toHaveBeenCalledWith("LA");
  });
});
