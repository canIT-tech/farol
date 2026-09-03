import { describe, it, expect } from "vitest";
import { isGeoProvider } from "./geo-provider.js";

const complete = {
  whereami: () => Promise.resolve(null),
  airport: () => Promise.resolve(null),
  airline: () => Promise.resolve(null),
  searchAirports: () => Promise.resolve([])
};

describe("isGeoProvider", () => {
  it("aceita um objeto com os quatro métodos", () => {
    expect(isGeoProvider(complete)).toBe(true);
  });

  it("rejeita null, primitivo e objeto sem os métodos", () => {
    expect(isGeoProvider(null)).toBe(false);
    expect(isGeoProvider("x")).toBe(false);
    expect(isGeoProvider({})).toBe(false);
  });

  it("rejeita quando falta um único método", () => {
    for (const key of Object.keys(complete)) {
      const partial = { ...complete } as Record<string, unknown>;
      delete partial[key];
      expect(isGeoProvider(partial)).toBe(false);
    }
  });
});
