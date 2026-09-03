import { describe, it, expect, vi } from "vitest";
import { createLiteApiHttp, LiteApiHttpError, LITEAPI_BASE_URL } from "./http.js";
import { CircuitOpenError } from "../http/circuit-breaker.js";

type ResSpec = { body: string; status: number };

function fetchSeq(specs: ResSpec[]): {
  impl: typeof fetch;
  calls: { url: string; init: RequestInit }[];
} {
  const calls: { url: string; init: RequestInit }[] = [];
  let i = 0;
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const spec = specs[Math.min(i, specs.length - 1)]!;
    i += 1;
    return new Response(spec.body, { status: spec.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const base = { apiKey: "sand_x", retryMinTimeoutMs: 0, now: () => 0 };

describe("createLiteApiHttp", () => {
  it("usa a base pública v3.0 e manda a chave no header", async () => {
    const { impl, calls } = fetchSeq([{ body: '{"data":[]}', status: 200 }]);
    const http = createLiteApiHttp({ ...base, fetchImpl: impl });

    await expect(http.get("/data/hotels", { countryCode: "PT" })).resolves.toEqual({ data: [] });
    expect(calls[0]!.url).toBe(`${LITEAPI_BASE_URL}/data/hotels?countryCode=PT`);
    expect(calls[0]!.init.method).toBe("GET");
    expect((calls[0]!.init.headers as Record<string, string>)["x-api-key"]).toBe("sand_x");
  });

  it("aponta para a base pública v3.0 por padrão", () => {
    expect(LITEAPI_BASE_URL).toBe("https://api.liteapi.travel/v3.0");
  });

  it("respeita a baseUrl configurada e omite a query vazia", async () => {
    const { impl, calls } = fetchSeq([{ body: "{}", status: 200 }]);
    const http = createLiteApiHttp({ ...base, baseUrl: "https://lite.local", fetchImpl: impl });

    await http.get("/x");
    expect(calls[0]!.url).toBe("https://lite.local/x");
  });

  it("post manda JSON no corpo, com a chave e o content-type", async () => {
    const { impl, calls } = fetchSeq([{ body: '{"data":[]}', status: 200 }]);
    const http = createLiteApiHttp({ ...base, fetchImpl: impl });

    await http.post("/hotels/min-rates", { hotelIds: ["a"] });

    expect(calls[0]!.url).toBe(`${LITEAPI_BASE_URL}/hotels/min-rates`);
    expect(calls[0]!.init.method).toBe("POST");
    expect(calls[0]!.init.body).toBe('{"hotelIds":["a"]}');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["x-api-key"]).toBe("sand_x");
  });

  it("retenta em 429 — o sandbox limita a 5 req/s", async () => {
    const { impl, calls } = fetchSeq([
      { body: "rate limited", status: 429 },
      { body: '{"data":[]}', status: 200 }
    ]);
    const http = createLiteApiHttp({ ...base, fetchImpl: impl });

    await expect(http.get("/x")).resolves.toEqual({ data: [] });
    expect(calls).toHaveLength(2);
  });

  it("não retenta em 401 e propaga status, corpo e nome do erro", async () => {
    const { impl, calls } = fetchSeq([{ body: '{"error":{"code":401}}', status: 401 }]);
    const http = createLiteApiHttp({ ...base, fetchImpl: impl });

    const err = await http.get("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LiteApiHttpError);
    expect((err as LiteApiHttpError).status).toBe(401);
    expect((err as LiteApiHttpError).body).toBe('{"error":{"code":401}}');
    expect((err as Error).message).toBe("LiteAPI respondeu 401");
    expect((err as Error).name).toBe("LiteApiHttpError");
    expect(calls).toHaveLength(1);
  });

  it("tenta 4 vezes por padrão antes de desistir", async () => {
    const { impl, calls } = fetchSeq([{ body: "erro", status: 503 }]);
    const http = createLiteApiHttp({ apiKey: "k", retryMinTimeoutMs: 0, fetchImpl: impl });

    await expect(http.get("/x")).rejects.toBeInstanceOf(LiteApiHttpError);
    expect(calls).toHaveLength(4);
  });

  it("abre o circuito depois do limiar de falhas", async () => {
    const { impl } = fetchSeq([{ body: "erro", status: 500 }]);
    const http = createLiteApiHttp({ ...base, fetchImpl: impl, retries: 0, failureThreshold: 2 });

    await expect(http.get("/x")).rejects.toBeInstanceOf(LiteApiHttpError);
    await expect(http.post("/x", {})).rejects.toBeInstanceOf(LiteApiHttpError);
    await expect(http.get("/x")).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("monta com os defaults quando só recebe a chave", () => {
    expect(() => createLiteApiHttp({ apiKey: "k" })).not.toThrow();
  });
});
