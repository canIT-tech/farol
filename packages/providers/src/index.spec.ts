import { describe, it, expect } from "vitest";
import { isFlightProvider } from "./index";

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
