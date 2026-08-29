import { describe, it, expect } from "vitest";
import { isFlightProvider, isHotelProvider } from "./index";

describe("isFlightProvider", () => {
  it("reconhece um objeto com search()", () => {
    expect(isFlightProvider({ search: async () => [] })).toBe(true);
  });

  it("rejeita objeto sem search", () => {
    expect(isFlightProvider({})).toBe(false);
  });

  it("rejeita null", () => {
    expect(isFlightProvider(null)).toBe(false);
  });

  it("rejeita quando search não é função", () => {
    expect(isFlightProvider({ search: 42 })).toBe(false);
  });

  it("rejeita primitivos que não são objeto", () => {
    expect(isFlightProvider(42)).toBe(false);
    expect(isFlightProvider("search")).toBe(false);
    expect(isFlightProvider(undefined)).toBe(false);
  });
});

describe("isHotelProvider", () => {
  it("reconhece um objeto com search()", () => {
    expect(isHotelProvider({ search: async () => [] })).toBe(true);
  });

  it("rejeita null, objeto sem search e search não-função", () => {
    expect(isHotelProvider(null)).toBe(false);
    expect(isHotelProvider({})).toBe(false);
    expect(isHotelProvider({ search: 1 })).toBe(false);
    expect(isHotelProvider("x")).toBe(false);
  });
});
