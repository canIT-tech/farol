import { describe, expect, it, vi } from "vitest";
import { GoogleFlightsHttpError, createGoogleFlightsHttp } from "./http.js";

function respondWith(body: string, status = 200): typeof fetch {
  return vi.fn(async () => new Response(body, { status })) as unknown as typeof fetch;
}

describe("createGoogleFlightsHttp", () => {
  it("devolve o corpo da resposta", async () => {
    const http = createGoogleFlightsHttp({ fetchImpl: respondWith("<html>ok</html>") });
    expect(await http.getHtml("https://exemplo.test/f")).toBe("<html>ok</html>");
  });

  // Sem User-Agent de browser o Google devolve uma página degradada, sem o
  // script ds:1 — o parser acharia que o layout mudou.
  it("se apresenta como um browser", async () => {
    const fetchImpl = respondWith("<html></html>");
    await createGoogleFlightsHttp({ fetchImpl }).getHtml("https://exemplo.test/f");
    const headers = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]![1]!.headers as Record<string, string>;
    expect(headers["user-agent"]).toMatch(/Chrome/);
    expect(headers["accept-language"]).toMatch(/pt-BR/);
    expect(headers.accept).toMatch(/text\/html/);
  });

  it("aceita idioma diferente no accept-language", async () => {
    const fetchImpl = respondWith("<html></html>");
    await createGoogleFlightsHttp({ fetchImpl, locale: "en-US" }).getHtml("https://exemplo.test/f");
    const headers = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock
      .calls[0]![1]!.headers as Record<string, string>;
    expect(headers["accept-language"]).toMatch(/en-US/);
  });

  it("erra com o status quando o Google recusa", async () => {
    const http = createGoogleFlightsHttp({ fetchImpl: respondWith("nope", 429), retries: 0 });
    await expect(http.getHtml("https://exemplo.test/f")).rejects.toBeInstanceOf(
      GoogleFlightsHttpError
    );
  });

  it("tenta de novo em erro transitório", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      return calls === 1 ? new Response("erro", { status: 503 }) : new Response("<html>ok</html>");
    }) as unknown as typeof fetch;
    const http = createGoogleFlightsHttp({ fetchImpl, retries: 1, retryMinTimeoutMs: 1 });
    expect(await http.getHtml("https://exemplo.test/f")).toBe("<html>ok</html>");
    expect(calls).toBe(2);
  });

  // 404 é layout/rota errada, não indisponibilidade: repetir só gasta tempo e
  // aproxima do bloqueio por volume.
  it("não repete em erro definitivo", async () => {
    const fetchImpl = vi.fn(async () => new Response("nope", { status: 404 })) as unknown as typeof fetch;
    const http = createGoogleFlightsHttp({ fetchImpl, retries: 3, retryMinTimeoutMs: 1 });
    await expect(http.getHtml("https://exemplo.test/f")).rejects.toThrow(GoogleFlightsHttpError);
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(1);
  });
});

describe("createGoogleFlightsHttp sem fetch injetado", () => {
  // O caminho de produção: sem fetchImpl o cliente usa o fetch global.
  it("usa o fetch global", async () => {
    const global = vi.fn(async () => new Response("<html>global</html>"));
    vi.stubGlobal("fetch", global);
    try {
      expect(await createGoogleFlightsHttp().getHtml("https://exemplo.test/f")).toBe(
        "<html>global</html>"
      );
      expect(global).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
