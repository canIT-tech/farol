import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  GooglePlacesProvider,
  GooglePlacesHttpError,
  priceLevelsBetween
} from "./google-places-provider";

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)), "utf8")
  ) as unknown;
}
const searchFixture = loadFixture("text-search.json");
const detailsFixture = loadFixture("details.json");

function providerWith(payload: unknown, ok = true, status = 200) {
  const fetchImpl = vi.fn(async () => ({
    ok,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload)
  })) as unknown as typeof fetch;
  const provider = new GooglePlacesProvider({ apiKey: "KEY-123", fetchImpl });
  return { provider, fetchImpl: fetchImpl as unknown as ReturnType<typeof vi.fn> };
}

function callOf(fetchImpl: ReturnType<typeof vi.fn>, index = 0) {
  const [url, init] = fetchImpl.mock.calls[index]! as [string, RequestInit];
  return { url, init, body: JSON.parse(String(init.body ?? "{}")) as Record<string, unknown> };
}

describe("priceLevelsBetween", () => {
  it("sem min nem max devolve lista vazia", () => {
    expect(priceLevelsBetween(undefined, undefined)).toEqual([]);
  });

  it("só min completa até 4", () => {
    expect(priceLevelsBetween(3, undefined)).toEqual([
      "PRICE_LEVEL_EXPENSIVE",
      "PRICE_LEVEL_VERY_EXPENSIVE"
    ]);
  });

  it("só max começa em 0", () => {
    expect(priceLevelsBetween(undefined, 1)).toEqual([
      "PRICE_LEVEL_FREE",
      "PRICE_LEVEL_INEXPENSIVE"
    ]);
  });

  it("min e max delimitam a faixa inclusive", () => {
    expect(priceLevelsBetween(1, 3)).toEqual([
      "PRICE_LEVEL_INEXPENSIVE",
      "PRICE_LEVEL_MODERATE",
      "PRICE_LEVEL_EXPENSIVE"
    ]);
  });

  it("faixa invertida devolve lista vazia", () => {
    expect(priceLevelsBetween(3, 1)).toEqual([]);
  });
});

describe("GooglePlacesProvider.textSearch", () => {
  it("devolve os lugares normalizados da fixture", async () => {
    const { provider } = providerWith(searchFixture);
    const places = await provider.textSearch({ query: "museus em Lisboa" });
    expect(places).toHaveLength(3);
    expect(places[0]).toMatchObject({
      placeId: "ChIJZ3VqNbc0GQ0RRfCB8ZKQPqE",
      name: "Museu Nacional do Azulejo",
      priceLevel: 1
    });
  });

  it("faz POST em places:searchText com a chave e o field mask", async () => {
    const { provider, fetchImpl } = providerWith(searchFixture);
    await provider.textSearch({ query: "museus em Lisboa" });

    const { url, init, body } = callOf(fetchImpl);
    expect(url).toBe("https://places.googleapis.com/v1/places:searchText");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Goog-Api-Key"]).toBe("KEY-123");
    expect(headers["X-Goog-FieldMask"]).toContain("places.location");
    expect(body).toEqual({ textQuery: "museus em Lisboa" });
  });

  it("traduz near para locationBias com raio", async () => {
    const { provider, fetchImpl } = providerWith(searchFixture);
    await provider.textSearch({ query: "restaurante", near: { lat: 38.7, lng: -9.1 } });
    expect(callOf(fetchImpl).body.locationBias).toEqual({
      circle: { center: { latitude: 38.7, longitude: -9.1 }, radius: 3000 }
    });
  });

  it("traduz type para includedType", async () => {
    const { provider, fetchImpl } = providerWith(searchFixture);
    await provider.textSearch({ query: "restaurante", type: "restaurant" });
    expect(callOf(fetchImpl).body.includedType).toBe("restaurant");
  });

  it("traduz a faixa de preço para priceLevels", async () => {
    const { provider, fetchImpl } = providerWith(searchFixture);
    await provider.textSearch({ query: "restaurante", minPrice: 1, maxPrice: 2 });
    expect(callOf(fetchImpl).body.priceLevels).toEqual([
      "PRICE_LEVEL_INEXPENSIVE",
      "PRICE_LEVEL_MODERATE"
    ]);
  });

  it("não manda priceLevels quando a faixa fica vazia", async () => {
    const { provider, fetchImpl } = providerWith(searchFixture);
    await provider.textSearch({ query: "restaurante", minPrice: 3, maxPrice: 1 });
    expect(callOf(fetchImpl).body.priceLevels).toBeUndefined();
  });

  it("resposta não-ok vira GooglePlacesHttpError com o status", async () => {
    const { provider } = providerWith({ error: "quota" }, false, 429);
    await expect(provider.textSearch({ query: "museus" })).rejects.toBeInstanceOf(
      GooglePlacesHttpError
    );
    await expect(provider.textSearch({ query: "museus" })).rejects.toMatchObject({ status: 429 });
  });

  it("rejeita params inválidos antes de chamar o fetch", async () => {
    const { provider, fetchImpl } = providerWith(searchFixture);
    await expect(provider.textSearch({ query: "x" })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("respeita um baseUrl customizado", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => searchFixture,
      text: async () => ""
    })) as unknown as typeof fetch;
    const provider = new GooglePlacesProvider({
      apiKey: "K",
      baseUrl: "https://places.example.com",
      fetchImpl
    });
    await provider.textSearch({ query: "museus" });
    const [url] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]! as [string];
    expect(url).toBe("https://places.example.com/v1/places:searchText");
  });

  it("monta com o fetch global quando não recebe fetchImpl", () => {
    expect(() => new GooglePlacesProvider({ apiKey: "K" })).not.toThrow();
  });
});

describe("GooglePlacesProvider.details", () => {
  it("faz GET no lugar e devolve PlaceDetails", async () => {
    const { provider, fetchImpl } = providerWith(detailsFixture);
    const details = await provider.details("ChIJZ3VqNbc0GQ0RRfCB8ZKQPqE");

    expect(details).toMatchObject({
      placeId: "ChIJZ3VqNbc0GQ0RRfCB8ZKQPqE",
      address: "R. Me. Deus 4, 1900-312 Lisboa, Portugal"
    });
    expect(details.openingHours).toHaveLength(7);

    const { url, init } = callOf(fetchImpl);
    expect(url).toBe("https://places.googleapis.com/v1/places/ChIJZ3VqNbc0GQ0RRfCB8ZKQPqE");
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["X-Goog-FieldMask"]).toContain(
      "regularOpeningHours"
    );
  });

  it("escapa o placeId na URL", async () => {
    const { provider, fetchImpl } = providerWith(detailsFixture);
    await provider.details("a/b?c");
    expect(callOf(fetchImpl).url).toBe("https://places.googleapis.com/v1/places/a%2Fb%3Fc");
  });

  it("resposta não-ok vira GooglePlacesHttpError", async () => {
    const { provider } = providerWith({ error: "not found" }, false, 404);
    await expect(provider.details("xxx")).rejects.toMatchObject({ status: 404 });
  });
});
