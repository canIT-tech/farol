import { describe, it, expect } from "vitest";
import { parseEnv } from "./env.schema";

const valid = {
  DATABASE_URL: "postgres://x",
  SUPABASE_JWKS_URL: "https://proj.supabase.co/auth/v1/.well-known/jwks.json",
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

  it("mantém SUPABASE_JWKS_URL", () => {
    expect(parseEnv({ ...valid }).SUPABASE_JWKS_URL).toBe(valid.SUPABASE_JWKS_URL);
  });

  it("aplica default de JOBS_SCHEMA e respeita o valor informado", () => {
    expect(parseEnv({ ...valid }).JOBS_SCHEMA).toBe("pgboss");
    expect(parseEnv({ ...valid, JOBS_SCHEMA: "pgboss_test" }).JOBS_SCHEMA).toBe("pgboss_test");
  });

  it("lança quando DATABASE_URL falta", () => {
    expect(() => parseEnv({ SUPABASE_JWKS_URL: valid.SUPABASE_JWKS_URL })).toThrow(
      /DATABASE_URL/
    );
  });

  it("lança quando as credenciais do Amadeus faltam", () => {
    expect(() =>
      parseEnv({
        DATABASE_URL: "postgres://x",
        SUPABASE_JWKS_URL: valid.SUPABASE_JWKS_URL,
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
      parseEnv({ DATABASE_URL: "postgres://x", SUPABASE_JWKS_URL: "nao-e-url" })
    ).toThrow(/SUPABASE_JWKS_URL/);
  });

  it("lança quando API_PORT não é um inteiro positivo", () => {
    expect(() => parseEnv({ ...valid, API_PORT: "-1" })).toThrow(/API_PORT/);
  });

  it("lança quando GOOGLE_PLACES_KEY falta", () => {
    const semChave: Record<string, string | undefined> = { ...valid };
    delete semChave.GOOGLE_PLACES_KEY;
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
      "Env inválida: DATABASE_URL, API_PORT, SUPABASE_JWKS_URL, AMADEUS_CLIENT_ID, AMADEUS_CLIENT_SECRET, GOOGLE_PLACES_KEY"
    );
  });
});

const comLlm = {
  ...valid,
  LLM_PROVIDER: "groq",
  LLM_API_KEY: "chave-de-teste",
  LLM_MODEL_CAPABLE: "llama-3.3-70b-versatile",
  LLM_MODEL_CHEAP: "llama-3.1-8b-instant"
};

describe("flags de deploy", () => {
  it("desligadas por padrão — dev sobe web e worker separados", () => {
    const env = parseEnv({ ...valid });
    expect(env.RUN_JOB_HANDLERS).toBe("false");
    expect(env.SERVE_WEB).toBe("false");
  });

  it("aceita as duas ligadas", () => {
    const env = parseEnv({ ...valid, RUN_JOB_HANDLERS: "true", SERVE_WEB: "true" });
    expect(env.RUN_JOB_HANDLERS).toBe("true");
    expect(env.SERVE_WEB).toBe("true");
  });

  it("rejeita valor que não é true nem false", () => {
    expect(() => parseEnv({ ...valid, SERVE_WEB: "1" })).toThrow(/SERVE_WEB/);
    expect(() => parseEnv({ ...valid, RUN_JOB_HANDLERS: "yes" })).toThrow(/RUN_JOB_HANDLERS/);
  });
});

describe("env de LLM", () => {
  it("é válida sem nenhuma env de LLM (IA desligada)", () => {
    const env = parseEnv({ ...valid });
    expect(env.LLM_PROVIDER).toBeUndefined();
    expect(env.LLM_API_KEY).toBeUndefined();
  });

  it("aceita os três providers quando tudo está preenchido", () => {
    for (const provider of ["anthropic", "groq", "openai"]) {
      expect(parseEnv({ ...comLlm, LLM_PROVIDER: provider }).LLM_PROVIDER).toBe(provider);
    }
  });

  it("rejeita provider desconhecido", () => {
    expect(() => parseEnv({ ...comLlm, LLM_PROVIDER: "marte" })).toThrow(/LLM_PROVIDER/);
  });

  it("provider sem chave é erro de boot", () => {
    const semChave: Record<string, string | undefined> = { ...comLlm };
    delete semChave.LLM_API_KEY;
    expect(() => parseEnv(semChave)).toThrow(/LLM_API_KEY/);
  });

  it("provider sem modelo capable é erro de boot", () => {
    const sem: Record<string, string | undefined> = { ...comLlm };
    delete sem.LLM_MODEL_CAPABLE;
    expect(() => parseEnv(sem)).toThrow(/LLM_MODEL_CAPABLE/);
  });

  it("provider sem modelo cheap é erro de boot", () => {
    const sem: Record<string, string | undefined> = { ...comLlm };
    delete sem.LLM_MODEL_CHEAP;
    expect(() => parseEnv(sem)).toThrow(/LLM_MODEL_CHEAP/);
  });

  it("chave sem provider é ignorada (IA segue desligada)", () => {
    expect(parseEnv({ ...valid, LLM_API_KEY: "solta" }).LLM_PROVIDER).toBeUndefined();
  });

  // O E2E sobe a api como processo externo, onde overrideProvider do Vitest não
  // alcança. "fake" é como o teste desliga a chamada real sem env nova.
  it("aceita o provider fake sem chave nem modelos", () => {
    expect(parseEnv({ ...valid, LLM_PROVIDER: "fake" }).LLM_PROVIDER).toBe("fake");
  });

  it("aceita o provider fake mesmo com os modelos informados", () => {
    const env = parseEnv({ ...comLlm, LLM_PROVIDER: "fake" });
    expect(env.LLM_PROVIDER).toBe("fake");
    expect(env.LLM_MODEL_CAPABLE).toBe("llama-3.3-70b-versatile");
  });
});

describe("env de e-mail", () => {
  it("é válida sem nenhuma env de e-mail (envio desligado)", () => {
    const env = parseEnv({ ...valid });
    expect(env.EMAIL_PROVIDER).toBeUndefined();
    expect(env.EMAIL_API_KEY).toBeUndefined();
    expect(env.EMAIL_FROM).toBeUndefined();
  });

  it("aceita resend com chave e remetente", () => {
    const env = parseEnv({
      ...valid,
      EMAIL_PROVIDER: "resend",
      EMAIL_API_KEY: "re_x",
      EMAIL_FROM: "Farol <oi@farol.app>"
    });
    expect(env.EMAIL_PROVIDER).toBe("resend");
    expect(env.EMAIL_FROM).toBe("Farol <oi@farol.app>");
  });

  it("fake não exige chave nem remetente", () => {
    expect(parseEnv({ ...valid, EMAIL_PROVIDER: "fake" }).EMAIL_PROVIDER).toBe("fake");
  });

  it("rejeita provider desconhecido", () => {
    expect(() => parseEnv({ ...valid, EMAIL_PROVIDER: "sendgrid" })).toThrow(/EMAIL_PROVIDER/);
  });

  it("resend sem chave é erro de boot", () => {
    expect(() => parseEnv({ ...valid, EMAIL_PROVIDER: "resend", EMAIL_FROM: "oi@farol.app" })).toThrow(
      "Env inválida: EMAIL_API_KEY"
    );
  });

  it("resend sem remetente é erro de boot", () => {
    expect(() => parseEnv({ ...valid, EMAIL_PROVIDER: "resend", EMAIL_API_KEY: "re_x" })).toThrow(
      "Env inválida: EMAIL_FROM"
    );
  });

  it("faltas de LLM e de e-mail aparecem juntas, nessa ordem", () => {
    expect(() => parseEnv({ ...valid, LLM_PROVIDER: "groq", EMAIL_PROVIDER: "resend" })).toThrow(
      "Env inválida: LLM_API_KEY, LLM_MODEL_CAPABLE, LLM_MODEL_CHEAP, EMAIL_API_KEY, EMAIL_FROM"
    );
  });
});
