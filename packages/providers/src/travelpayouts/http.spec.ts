import { describe, it, expect, vi } from "vitest";
import {
  createTravelpayoutsHttp,
  TravelpayoutsHttpError,
  TRAVELPAYOUTS_BASE_URL
} from "./http.js";
import { CircuitOpenError } from "../http/circuit-breaker.js";

type ResSpec = { body: string; status: number };

function fetchSeq(specs: ResSpec[]): {
  impl: typeof fetch;
  calls: { url: string; init?: RequestInit }[];
} {
  const calls: { url: string; init?: RequestInit }[] = [];
  let i = 0;
  const impl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const spec = specs[Math.min(i, specs.length - 1)]!;
    i += 1;
    return new Response(spec.body, { status: spec.status });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

const base = { token: "tok", retryMinTimeoutMs: 0, now: () => 0 };

describe("createTravelpayoutsHttp", () => {
  it("usa a base pública por padrão e manda o token no header", async () => {
    const { impl, calls } = fetchSeq([{ body: '{"ok":true}', status: 200 }]);
    const http = createTravelpayoutsHttp({ ...base, fetchImpl: impl });

    await expect(http.get("/v1/prices/monthly", { origin: "GRU" })).resolves.toEqual({ ok: true });
    expect(calls[0]!.url).toBe(`${TRAVELPAYOUTS_BASE_URL}/v1/prices/monthly?origin=GRU`);
    expect((calls[0]!.init!.headers as Record<string, string>)["x-access-token"]).toBe("tok");
  });

  it("respeita a baseUrl configurada", async () => {
    const { impl, calls } = fetchSeq([{ body: "{}", status: 200 }]);
    const http = createTravelpayoutsHttp({ ...base, baseUrl: "https://tp.local", fetchImpl: impl });

    await http.get("/x");
    expect(calls[0]!.url).toBe("https://tp.local/x");
  });

  it("usa a URL como está quando o path já é absoluto", async () => {
    const { impl, calls } = fetchSeq([{ body: "useriata({})", status: 200 }]);
    const http = createTravelpayoutsHttp({ ...base, fetchImpl: impl });

    await expect(
      http.getText("https://www.travelpayouts.com/whereami", { ip: "1.2.3.4" })
    ).resolves.toBe("useriata({})");
    expect(calls[0]!.url).toBe("https://www.travelpayouts.com/whereami?ip=1.2.3.4");
  });

  it("retenta em 503 e sucede na tentativa seguinte", async () => {
    const { impl, calls } = fetchSeq([
      { body: "indisponível", status: 503 },
      { body: '{"data":[]}', status: 200 }
    ]);
    const http = createTravelpayoutsHttp({ ...base, fetchImpl: impl });

    await expect(http.get("/x")).resolves.toEqual({ data: [] });
    expect(calls).toHaveLength(2);
  });

  it("não retenta em 400 e propaga o status e o corpo", async () => {
    const { impl, calls } = fetchSeq([{ body: "origin inválido", status: 400 }]);
    const http = createTravelpayoutsHttp({ ...base, fetchImpl: impl });

    const err = await http.get("/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TravelpayoutsHttpError);
    expect((err as TravelpayoutsHttpError).status).toBe(400);
    expect((err as TravelpayoutsHttpError).body).toBe("origin inválido");
    expect((err as Error).message).toBe("Travelpayouts respondeu 400");
    expect((err as Error).name).toBe("TravelpayoutsHttpError");
    expect(calls).toHaveLength(1);
  });

  it("abre o circuito depois do limiar de falhas", async () => {
    const { impl } = fetchSeq([{ body: "erro", status: 500 }]);
    const http = createTravelpayoutsHttp({
      ...base,
      fetchImpl: impl,
      retries: 0,
      failureThreshold: 2
    });

    await expect(http.get("/x")).rejects.toBeInstanceOf(TravelpayoutsHttpError);
    await expect(http.get("/x")).rejects.toBeInstanceOf(TravelpayoutsHttpError);
    await expect(http.get("/x")).rejects.toBeInstanceOf(CircuitOpenError);
  });

  it("aponta para a Data API pública por padrão", () => {
    expect(TRAVELPAYOUTS_BASE_URL).toBe("https://api.travelpayouts.com");
  });

  it("tenta 4 vezes por padrão (3 retries) antes de desistir", async () => {
    const { impl, calls } = fetchSeq([{ body: "erro", status: 503 }]);
    const http = createTravelpayoutsHttp({ token: "t", retryMinTimeoutMs: 0, fetchImpl: impl });

    await expect(http.get("/x")).rejects.toBeInstanceOf(TravelpayoutsHttpError);
    expect(calls).toHaveLength(4);
  });

  it("monta com os defaults quando só recebe o token", () => {
    expect(() => createTravelpayoutsHttp({ token: "t" })).not.toThrow();
  });
});
