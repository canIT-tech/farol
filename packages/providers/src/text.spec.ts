import { describe, it, expect } from "vitest";
import { nullIfEmpty } from "./text.js";

describe("nullIfEmpty", () => {
  it("devolve null para string vazia, undefined e null", () => {
    expect(nullIfEmpty("")).toBeNull();
    expect(nullIfEmpty(undefined)).toBeNull();
    expect(nullIfEmpty(null)).toBeNull();
  });

  it("devolve o valor quando há conteúdo", () => {
    expect(nullIfEmpty("Trip.com")).toBe("Trip.com");
    expect(nullIfEmpty(" ")).toBe(" ");
  });
});
