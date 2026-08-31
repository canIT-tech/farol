import { describe, it, expect } from "vitest";
import { parseEnv } from "./env.schema";

const valid = {
  DATABASE_URL: "postgres://x",
  SUPABASE_JWKS_URL: "https://proj.supabase.co/auth/v1/.well-known/jwks.json",
  ANTHROPIC_API_KEY: "sk-ant-test",
  AMADEUS_CLIENT_ID: "amadeus-id",
  AMADEUS_CLIENT_SECRET: "amadeus-secret",
  GOOGLE_PLACES_KEY: "google-places-key"
};

describe("parseEnv", () => {
  it("aplica default de API_PORT", () => {
    expect(parseEnv({ ...valid }).API_PORT).toBe(3333);
  });

  it("coage API_PORT para número", () => {
    expect(parseEnv({ ...valid, API_PORT: "4000" }).API_PORT).toBe(4000);
  });

  it("mantém SUPABASE_JWKS_URL e ANTHROPIC_API_KEY", () => {
    const env = parseEnv({ ...valid });
    expect(env.SUPABASE_JWKS_URL).toBe(valid.SUPABASE_JWKS_URL);
    expect(env.ANTHROPIC_API_KEY).toBe("sk-ant-test");
  });

  it("aplica defaults de roteamento de modelo", () => {
    const env = parseEnv({ ...valid });
    expect(env.LLM_MODEL_CAPABLE).toBe("claude-sonnet-5");
    expect(env.LLM_MODEL_CHEAP).toBe("claude-haiku-4-5-20251001");
  });

  it("aplica default de JOBS_SCHEMA e respeita o valor informado", () => {
    expect(parseEnv({ ...valid }).JOBS_SCHEMA).toBe("pgboss");
    expect(parseEnv({ ...valid, JOBS_SCHEMA: "pgboss_test" }).JOBS_SCHEMA).toBe("pgboss_test");
  });

  it("respeita os modelos informados por env", () => {
    const env = parseEnv({ ...valid, LLM_MODEL_CAPABLE: "x-capable", LLM_MODEL_CHEAP: "x-cheap" });
    expect(env.LLM_MODEL_CAPABLE).toBe("x-capable");
    expect(env.LLM_MODEL_CHEAP).toBe("x-cheap");
  });

  it("lança quando DATABASE_URL falta", () => {
    expect(() =>
      parseEnv({ SUPABASE_JWKS_URL: valid.SUPABASE_JWKS_URL, ANTHROPIC_API_KEY: "k" })
    ).toThrow(/DATABASE_URL/);
  });

  it("lança quando ANTHROPIC_API_KEY falta", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgres://x", SUPABASE_JWKS_URL: valid.SUPABASE_JWKS_URL })
    ).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("lança quando as credenciais do Amadeus faltam", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgres://x",
        SUPABASE_JWKS_URL: valid.SUPABASE_JWKS_URL,
        ANTHROPIC_API_KEY: "k"
      })
    ).toThrow(/AMADEUS_CLIENT_ID/);
  });

  it("aplica defaults de Amadeus (base url, templates de deep link, TTLs)", () => {
    const env = parseEnv({ ...valid });
    expect(env.AMADEUS_BASE_URL).toBe("https://test.api.amadeus.com");
    expect(env.FLIGHT_DEEPLINK_TEMPLATE).toContain("{origin}");
    expect(env.HOTEL_DEEPLINK_TEMPLATE).toContain("{cityCode}");
    expect(env.FLIGHT_CACHE_TTL_SECONDS).toBe(600);
    expect(env.HOTEL_CACHE_TTL_SECONDS).toBe(3600);
  });

  it("respeita AMADEUS_BASE_URL e TTLs informados", () => {
    const env = parseEnv({
      ...valid,
      AMADEUS_BASE_URL: "https://api.amadeus.com",
      FLIGHT_CACHE_TTL_SECONDS: "120",
      HOTEL_CACHE_TTL_SECONDS: "7200"
    });
    expect(env.AMADEUS_BASE_URL).toBe("https://api.amadeus.com");
    expect(env.FLIGHT_CACHE_TTL_SECONDS).toBe(120);
    expect(env.HOTEL_CACHE_TTL_SECONDS).toBe(7200);
  });

  it("lança quando SUPABASE_JWKS_URL não é uma URL", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgres://x", SUPABASE_JWKS_URL: "nao-e-url", ANTHROPIC_API_KEY: "k" })
    ).toThrow(/SUPABASE_JWKS_URL/);
  });

  it("lança quando API_PORT não é um inteiro positivo", () => {
    expect(() => parseEnv({ ...valid, API_PORT: "-1" })).toThrow(/API_PORT/);
  });

  it("lança quando GOOGLE_PLACES_KEY falta", () => {
    const { GOOGLE_PLACES_KEY: _omitida, ...semChave } = valid;
    expect(() => parseEnv(semChave)).toThrow(/GOOGLE_PLACES_KEY/);
  });

  it("aplica o default de 24h do cache de Places e respeita o valor informado", () => {
    expect(parseEnv({ ...valid }).PLACES_CACHE_TTL_SECONDS).toBe(86_400);
    expect(parseEnv({ ...valid, PLACES_CACHE_TTL_SECONDS: "600" }).PLACES_CACHE_TTL_SECONDS).toBe(
      600
    );
  });

  it("lista os campos inválidos separados por vírgula", () => {
    expect(() => parseEnv({ API_PORT: "-1" })).toThrow(
      "Env inválida: DATABASE_URL, API_PORT, SUPABASE_JWKS_URL, ANTHROPIC_API_KEY, AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, GOOGLE_PLACES_KEY"
    );
  });
});
