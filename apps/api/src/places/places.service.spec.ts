import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createDbClient, runMigrations, providerCache } from "@farol/db";
import { PlacesService } from "./places.service";
import { ProviderCacheRepository, cacheKey } from "../providers/provider-cache.repository";
import {
  FakePlacesProvider,
  FAKE_PLACES,
  FAKE_PLACE_DETAILS
} from "../../test/support/fake-providers";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const cache = new ProviderCacheRepository(db);
const env = { PLACES_CACHE_TTL_SECONDS: 86_400 } as never;

beforeAll(() => runMigrations(url));
afterEach(async () => {
  await db.delete(providerCache).where(eq(providerCache.provider, "google-places"));
});
afterAll(() => close());

describe("PlacesService.findFirst", () => {
  it("devolve o primeiro lugar da busca", async () => {
    const service = new PlacesService(new FakePlacesProvider(), env, cache);
    await expect(service.findFirst("museu do azulejo Lisboa")).resolves.toEqual(FAKE_PLACES[0]);
  });

  it("usa o cache na 2a chamada com a mesma query", async () => {
    const provider = new FakePlacesProvider();
    const spy = vi.spyOn(provider, "textSearch");
    const service = new PlacesService(provider, env, cache);

    await service.findFirst("museu do azulejo Lisboa");
    await service.findFirst("museu do azulejo Lisboa");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("opções diferentes são chaves de cache diferentes", async () => {
    const provider = new FakePlacesProvider();
    const spy = vi.spyOn(provider, "textSearch");
    const service = new PlacesService(provider, env, cache);

    await service.findFirst("restaurante", { type: "restaurant" });
    await service.findFirst("restaurante", { type: "restaurant", minPrice: 1 });
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("grava o provider 'google-places' no cache", async () => {
    const service = new PlacesService(new FakePlacesProvider(), env, cache);
    await service.findFirst("museu do azulejo Lisboa");
    const key = cacheKey("google-places", "text-search", { query: "museu do azulejo Lisboa" });
    const rows = await db.select().from(providerCache).where(eq(providerCache.key, key));
    expect(rows[0]?.provider).toBe("google-places");
  });

  it("devolve null quando a busca não acha nada", async () => {
    const service = new PlacesService(new FakePlacesProvider({ places: [] }), env, cache);
    await expect(service.findFirst("lugar que não existe")).resolves.toBeNull();
  });

  it("degrada para null e loga quando o provider falha", async () => {
    const service = new PlacesService(new FakePlacesProvider({ fail: true }), env, cache);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(service.findFirst("museu")).resolves.toBeNull();
      expect(errSpy.mock.calls[0]![0]).toContain("places_search_failed");
    } finally {
      errSpy.mockRestore();
    }
  });

  it("repassa near, type e faixa de preço para o provider", async () => {
    const provider = new FakePlacesProvider();
    const spy = vi.spyOn(provider, "textSearch");
    const service = new PlacesService(provider, env, cache);

    await service.findFirst("restaurante", {
      near: { lat: 38.7, lng: -9.1 },
      type: "restaurant",
      minPrice: 1,
      maxPrice: 3
    });
    expect(spy).toHaveBeenCalledWith({
      query: "restaurante",
      near: { lat: 38.7, lng: -9.1 },
      type: "restaurant",
      minPrice: 1,
      maxPrice: 3
    });
  });
});

describe("PlacesService.details", () => {
  it("devolve o detalhe do lugar e cacheia", async () => {
    const provider = new FakePlacesProvider();
    const spy = vi.spyOn(provider, "details");
    const service = new PlacesService(provider, env, cache);

    await expect(service.details("place-museu")).resolves.toEqual(FAKE_PLACE_DETAILS);
    await service.details("place-museu");
    expect(spy).toHaveBeenCalledOnce();
  });

  it("propaga a falha do provider (details não degrada)", async () => {
    const service = new PlacesService(new FakePlacesProvider({ fail: true }), env, cache);
    await expect(service.details("place-museu")).rejects.toThrow("places indisponível");
  });
});
