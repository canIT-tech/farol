import { describe, it, expect } from "vitest";
import { buildQuery } from "./query.js";

describe("buildQuery", () => {
  it("serializa string, número e boolean", () => {
    expect(buildQuery({ a: "x", b: 2, c: true })).toBe("a=x&b=2&c=true");
  });

  it("omite as chaves undefined — param vazio é filtro, não ausência", () => {
    expect(buildQuery({ a: "x", b: undefined })).toBe("a=x");
  });

  it("escapa os valores", () => {
    expect(buildQuery({ q: "Rio de Janeiro" })).toBe("q=Rio+de+Janeiro");
  });

  it("devolve string vazia quando não há query", () => {
    expect(buildQuery({})).toBe("");
  });
});
