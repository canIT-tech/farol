import { describe, it, expect } from "vitest";
import { isFlightInsightsProvider } from "./flight-provider.js";

const complete = {
  search: () => Promise.resolve([]),
  nearbyOptions: () => Promise.resolve([]),
  priceCalendar: () => Promise.resolve([]),
  latestPrices: () => Promise.resolve([]),
  monthlyPrices: () => Promise.resolve([]),
  cityDirections: () => Promise.resolve([])
};

describe("isFlightInsightsProvider", () => {
  it("aceita um provider com search e os cinco métodos de contexto", () => {
    expect(isFlightInsightsProvider(complete)).toBe(true);
  });

  it("rejeita um provider que só tem search", () => {
    expect(isFlightInsightsProvider({ search: () => Promise.resolve([]) })).toBe(false);
  });

  it("rejeita null e objeto vazio", () => {
    expect(isFlightInsightsProvider(null)).toBe(false);
    expect(isFlightInsightsProvider({})).toBe(false);
  });

  it("rejeita quando falta um único método de contexto", () => {
    for (const key of Object.keys(complete)) {
      const partial = { ...complete } as Record<string, unknown>;
      delete partial[key];
      expect(isFlightInsightsProvider(partial)).toBe(false);
    }
  });
});
