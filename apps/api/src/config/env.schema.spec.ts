import { describe, it, expect } from "vitest";
import { parseEnv } from "./env.schema";

describe("parseEnv", () => {
  it("aplica default de API_PORT", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x" });
    expect(env.API_PORT).toBe(3333);
  });

  it("coage API_PORT para número", () => {
    const env = parseEnv({ DATABASE_URL: "postgres://x", API_PORT: "4000" });
    expect(env.API_PORT).toBe(4000);
  });

  it("lança quando DATABASE_URL falta", () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it("lança quando API_PORT não é um inteiro positivo", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgres://x", API_PORT: "-1" })).toThrow(/API_PORT/);
  });

  it("lista os campos inválidos separados por vírgula", () => {
    expect(() => parseEnv({ API_PORT: "-1" })).toThrow("Env inválida: DATABASE_URL, API_PORT");
  });
});
