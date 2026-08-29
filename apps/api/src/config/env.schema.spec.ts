import { describe, it, expect } from "vitest";
import { parseEnv } from "./env.schema";

const valid = {
  DATABASE_URL: "postgres://x",
  SUPABASE_JWKS_URL: "https://proj.supabase.co/auth/v1/.well-known/jwks.json",
  ANTHROPIC_API_KEY: "sk-ant-test"
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

  it("lança quando SUPABASE_JWKS_URL não é uma URL", () => {
    expect(() =>
      parseEnv({ DATABASE_URL: "postgres://x", SUPABASE_JWKS_URL: "nao-e-url", ANTHROPIC_API_KEY: "k" })
    ).toThrow(/SUPABASE_JWKS_URL/);
  });

  it("lança quando API_PORT não é um inteiro positivo", () => {
    expect(() => parseEnv({ ...valid, API_PORT: "-1" })).toThrow(/API_PORT/);
  });

  it("lista os campos inválidos separados por vírgula", () => {
    expect(() => parseEnv({ API_PORT: "-1" })).toThrow(
      "Env inválida: DATABASE_URL, API_PORT, SUPABASE_JWKS_URL, ANTHROPIC_API_KEY"
    );
  });
});
