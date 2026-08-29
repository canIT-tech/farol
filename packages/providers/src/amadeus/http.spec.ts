import { describe, it, expect, vi } from "vitest";
import { createAmadeusHttp, AmadeusHttpError, isRetryableStatus } from "./http";

function jsonRes(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

type ResSpec = { body: string; status: number };

// fetch fake: responde token no endpoint de oauth; para o resto constrói uma
// Response NOVA a cada chamada a partir de `specs` (última se acabar).
function fakeFetch(specs: ResSpec[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url.includes("/v1/security/oauth2/token")) {
      return jsonRes({ access_token: "tok-abc", expires_in: 1800 });
    }
    const spec = specs[Math.min(i, specs.length - 1)]!;
    i += 1;
    return new Response(spec.body, { status: spec.status });
  });
  return { fn, calls };
}

const okJson = (value: unknown): ResSpec => ({ body: JSON.stringify(value), status: 200 });

const baseCfg = {
  baseUrl: "https://test.api.amadeus.com",
  clientId: "cid",
  clientSecret: "sec",
  retryMinTimeoutMs: 0,
  now: () => 0
};

describe("isRetryableStatus", () => {
  it("retenta em 429 e 5xx, não em 4xx comuns", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(500)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
    expect(isRetryableStatus(404)).toBe(false);
    expect(isRetryableStatus(200)).toBe(false);
  });
});

describe("createAmadeusHttp", () => {
  it("monta com os defaults quando só recebe as credenciais", () => {
    expect(() =>
      createAmadeusHttp({ baseUrl: "https://x", clientId: "c", clientSecret: "s" })
    ).not.toThrow();
  });
});

describe("createAmadeusHttp.get", () => {
  it("anexa o Bearer do token e devolve o JSON no caminho feliz", async () => {
    const { fn, calls } = fakeFetch([okJson({ data: [1, 2] })]);
    const http = createAmadeusHttp({ ...baseCfg, fetchImpl: fn as unknown as typeof fetch });

    await expect(http.get("/v2/shopping/flight-offers", { origin: "GRU" })).resolves.toEqual({
      data: [1, 2]
    });
    const dataCall = calls.find((c) => c.url.includes("flight-offers"))!;
    expect(dataCall.url).toBe("https://test.api.amadeus.com/v2/shopping/flight-offers?origin=GRU");
    expect((dataCall.init!.headers as Record<string, string>).authorization).toBe("Bearer tok-abc");
  });

  it("retenta em 503 e sucede", async () => {
    const { fn, calls } = fakeFetch([{ body: "busy", status: 503 }, okJson({ data: "ok" })]);
    const http = createAmadeusHttp({ ...baseCfg, fetchImpl: fn as unknown as typeof fetch });

    await expect(http.get("/x", {})).resolves.toEqual({ data: "ok" });
    const dataCalls = calls.filter((c) => !c.url.includes("oauth2/token"));
    expect(dataCalls).toHaveLength(2);
  });

  it("não retenta em 400 e propaga AmadeusHttpError", async () => {
    const { fn, calls } = fakeFetch([{ body: "bad", status: 400 }]);
    const http = createAmadeusHttp({ ...baseCfg, fetchImpl: fn as unknown as typeof fetch });

    await http.get("/x", {}).then(
      () => expect.unreachable("deveria rejeitar"),
      (err: unknown) => {
        expect(err).toBeInstanceOf(AmadeusHttpError);
        expect((err as AmadeusHttpError).status).toBe(400);
        expect((err as AmadeusHttpError).body).toBe("bad");
        expect((err as Error).name).toBe("AmadeusHttpError");
        expect((err as Error).message).toBe("Amadeus respondeu 400");
      }
    );
    const dataCalls = calls.filter((c) => !c.url.includes("oauth2/token"));
    expect(dataCalls).toHaveLength(1);
  });

  it("com retryMinTimeoutMs 0 as retentativas são praticamente imediatas", async () => {
    const { fn } = fakeFetch([{ body: "busy", status: 503 }, okJson({ data: "ok" })]);
    const http = createAmadeusHttp({
      ...baseCfg,
      retryMinTimeoutMs: 0,
      fetchImpl: fn as unknown as typeof fetch
    });
    const started = Date.now();
    await expect(http.get("/x", {})).resolves.toEqual({ data: "ok" });
    expect(Date.now() - started).toBeLessThan(250);
  });

  it("desiste após esgotar os retries em 5xx", async () => {
    const { fn, calls } = fakeFetch([{ body: "down", status: 500 }]);
    const http = createAmadeusHttp({
      ...baseCfg,
      retries: 2,
      fetchImpl: fn as unknown as typeof fetch
    });

    await expect(http.get("/x", {})).rejects.toBeInstanceOf(AmadeusHttpError);
    const dataCalls = calls.filter((c) => !c.url.includes("oauth2/token"));
    expect(dataCalls).toHaveLength(3); // 1 + 2 retries
  });

  it("o circuit breaker abre após failureThreshold falhas e rejeita rápido depois", async () => {
    const { fn, calls } = fakeFetch([{ body: "bad", status: 400 }]);
    const http = createAmadeusHttp({
      ...baseCfg,
      failureThreshold: 1,
      fetchImpl: fn as unknown as typeof fetch
    });

    await expect(http.get("/x", {})).rejects.toBeInstanceOf(AmadeusHttpError);
    const before = calls.length;
    await expect(http.get("/x", {})).rejects.toThrow("circuito aberto");
    expect(calls.length).toBe(before); // não chamou fetch de novo
  });
});
