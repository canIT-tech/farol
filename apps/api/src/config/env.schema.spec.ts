import { describe, it, expect } from "vitest";
import { parseEnv } from "./env.schema";

const valid = {
  DATABASE_URL: "postgres://x",
  SUPABASE_JWKS_URL: "https://proj.supabase.co/auth/v1/.well-known/jwks.json"
};

describe("parseEnv", () => {
  it("aplica default de API_PORT", () => {
    expect(parseEnv({ ...valid }).API_PORT).toBe(3333);
  });

  it("coage API_PORT para número", () => {
    expect(parseEnv({ ...valid, API_PORT: "4000" }).API_PORT).toBe(4000);
  });

  it("mantém SUPABASE_JWKS_URL", () => {
    expect(parseEnv({ ...valid }).SUPABASE_JWKS_URL).toBe(valid.SUPABASE_JWKS_URL);
  });

  it("lança quando DATABASE_URL falta", () => {
    expect(() => parseEnv({ SUPABASE_JWKS_URL: valid.SUPABASE_JWKS_URL })).toThrow(/DATABASE_URL/);
  });

  it("lança quando SUPABASE_JWKS_URL não é uma URL", () => {
    expect(() => parseEnv({ DATABASE_URL: "postgres://x", SUPABASE_JWKS_URL: "nao-e-url" })).toThrow(
      /SUPABASE_JWKS_URL/
    );
  });

  it("lança quando API_PORT não é um inteiro positivo", () => {
    expect(() => parseEnv({ ...valid, API_PORT: "-1" })).toThrow(/API_PORT/);
  });

  it("lista os campos inválidos separados por vírgula", () => {
    expect(() => parseEnv({ API_PORT: "-1" })).toThrow(
      "Env inválida: DATABASE_URL, API_PORT, SUPABASE_JWKS_URL"
    );
  });
});
