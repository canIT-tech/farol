import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { GoogleFlightsParseError } from "./payload.js";
import { GoogleFlightsProvider } from "./google-flights-provider.js";
import type { GoogleFlightsHttp } from "./http.js";

function pageOf(name: string): string {
  const json = readFileSync(
    fileURLToPath(new URL(`./__fixtures__/${name}.json`, import.meta.url)),
    "utf8"
  );
  return `<html><body><script class="ds:1" nonce="x">AF_initDataCallback({key: 'ds:1', hash: '9', data:${json}, sideChannel: {}});</script></body></html>`;
}

function httpServing(name: string): { http: GoogleFlightsHttp; urls: string[] } {
  const urls: string[] = [];
  return {
    urls,
    http: {
      getHtml: vi.fn(async (url: string) => {
        urls.push(url);
        return pageOf(name);
      })
    }
  };
}

const params = {
  originIata: "GRU",
  destinationIata: "LIS",
  departDate: "2026-11-15",
  adults: 1,
  children: 0
};

describe("GoogleFlightsProvider", () => {
  it("busca ofertas ordenadas pelo preço", async () => {
    const { http } = httpServing("one-way");
    const offers = await new GoogleFlightsProvider({ http }).search(params);
    expect(offers.length).toBeGreaterThan(4);
    expect(offers[0]!.price).toBe(1997);
    expect(offers[0]!.currency).toBe("BRL");
  });

  it("monta a URL com a rota, o idioma e a moeda", async () => {
    const { http, urls } = httpServing("one-way");
    await new GoogleFlightsProvider({ http, currency: "usd", locale: "en-US" }).search(params);
    const url = new URL(urls[0]!);
    expect(url.origin + url.pathname).toBe("https://www.google.com/travel/flights");
    // O Google só entende a moeda em maiúsculas; a env do Farol guarda "brl".
    expect(url.searchParams.get("curr")).toBe("USD");
    expect(url.searchParams.get("hl")).toBe("en-US");
  });

  it("usa a mesma URL como deep link das ofertas", async () => {
    const { http, urls } = httpServing("one-way");
    const offers = await new GoogleFlightsProvider({ http }).search(params);
    expect(offers.every((o) => o.deepLink === urls[0])).toBe(true);
  });

  // Ofertas e contexto de preço vêm da mesma página. Duas requisições seriam
  // dois carregamentos de 3 MB e o dobro de exposição a bloqueio.
  it("traz ofertas e contexto de preço numa requisição só", async () => {
    const { http } = httpServing("one-way");
    const result = await new GoogleFlightsProvider({ http }).searchWithContext(params);
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.priceContext!.cheapest).toBe(1997);
    expect(http.getHtml).toHaveBeenCalledTimes(1);
  });

  it("devolve contexto nulo quando a rota não tem preço de referência", async () => {
    const { http } = httpServing("no-flights");
    const result = await new GoogleFlightsProvider({ http }).searchWithContext(params);
    expect(result.offers).toEqual([]);
    expect(result.priceContext).toBeNull();
  });

  it("busca ida e volta quando há data de volta", async () => {
    const { http, urls } = httpServing("round-trip");
    const offers = await new GoogleFlightsProvider({ http }).search({
      ...params,
      returnDate: "2026-11-25"
    });
    expect(offers.length).toBeGreaterThan(0);
    // A data da volta tem que estar no blob. Procurar a substring no base64
    // não funciona: ele alinha de três em três bytes, então o mesmo texto vira
    // caracteres diferentes conforme a posição. A verificação é nos bytes.
    const tfs = new URL(urls[0]!).searchParams.get("tfs")!;
    const bytes = Buffer.from(tfs, "base64").toString("latin1");
    expect(bytes).toContain("2026-11-15");
    expect(bytes).toContain("2026-11-25");
  });

  it("propaga o erro de parsing quando a página não tem os dados", async () => {
    const http: GoogleFlightsHttp = { getHtml: vi.fn(async () => "<html>bloqueado</html>") };
    await expect(new GoogleFlightsProvider({ http }).search(params)).rejects.toBeInstanceOf(
      GoogleFlightsParseError
    );
  });

  it("respeita uma base alternativa", async () => {
    const { http, urls } = httpServing("one-way");
    await new GoogleFlightsProvider({ http, baseUrl: "https://espelho.test/voos" }).search(params);
    expect(urls[0]).toMatch(/^https:\/\/espelho\.test\/voos\?/);
  });
});

describe("GoogleFlightsProvider sem http injetado", () => {
  // O caminho de produção: sem http o provider monta o seu, que fala com o
  // Google de verdade. Aqui só provamos que ele chega ao fetch global com a
  // URL certa — a resposta real é papel do smoke.
  it("monta o próprio cliente e busca no Google", async () => {
    const global = vi.fn(async () => new Response("<html>vazio</html>"));
    vi.stubGlobal("fetch", global);
    try {
      await expect(new GoogleFlightsProvider().search(params)).rejects.toBeInstanceOf(
        GoogleFlightsParseError
      );
      expect(String(global.mock.calls[0]![0])).toContain("https://www.google.com/travel/flights?");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  // O idioma tem que atravessar até o accept-language do cliente que o provider
  // monta. Sem esta verificação, esquecer de repassar a locale passaria batido:
  // a URL continuaria com hl=en-US e só o cabeçalho ficaria em pt-BR.
  it("repassa a locale ao cliente que ele mesmo monta", async () => {
    const global = vi.fn(async () => new Response("<html>vazio</html>"));
    vi.stubGlobal("fetch", global);
    try {
      await new GoogleFlightsProvider({ locale: "en-US" }).search(params).catch(() => undefined);
      const headers = global.mock.calls[0]![1]!.headers as Record<string, string>;
      expect(headers["accept-language"]).toContain("en-US");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
