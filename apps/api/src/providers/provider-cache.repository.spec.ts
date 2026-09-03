import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createDbClient, runMigrations, providerCache } from "@farol/db";
import { ProviderCacheRepository, cacheKey } from "./provider-cache.repository";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const repo = new ProviderCacheRepository(db);
const keys: string[] = [];

function trackKey(provider: string, endpoint: string, params: Record<string, unknown>): string {
  const key = cacheKey(provider, endpoint, params);
  keys.push(key);
  return key;
}

beforeAll(() => runMigrations(url));
afterEach(async () => {
  if (keys.length > 0) {
    await db.delete(providerCache).where(inArray(providerCache.key, keys));
    keys.length = 0;
  }
});
afterAll(() => close());

describe("cacheKey", () => {
  it("é estável independente da ordem das chaves dos params", () => {
    expect(cacheKey("p", "e", { a: 1, b: 2 })).toBe(cacheKey("p", "e", { b: 2, a: 1 }));
  });

  it("muda quando provider, endpoint ou params mudam", () => {
    const base = cacheKey("p", "e", { a: 1 });
    expect(cacheKey("q", "e", { a: 1 })).not.toBe(base);
    expect(cacheKey("p", "f", { a: 1 })).not.toBe(base);
    expect(cacheKey("p", "e", { a: 2 })).not.toBe(base);
  });
});

describe("ProviderCacheRepository.getOrSet", () => {
  const params = { origin: "GRU", dest: "LIS" };

  it("na 1a chamada carrega, grava e devolve stale=false", async () => {
    trackKey("cache-spec-provider", "cache-spec-endpoint", params);
    const load = vi.fn().mockResolvedValue([{ id: "a" }]);

    const out = await repo.getOrSet({
      provider: "cache-spec-provider",
      endpoint: "cache-spec-endpoint",
      params,
      ttlSeconds: 600,
      load
    });

    expect(out.value).toEqual([{ id: "a" }]);
    expect(out.stale).toBe(false);
    expect(out.fetchedAt).toBeInstanceOf(Date);
    expect(load).toHaveBeenCalledOnce();

    const key = cacheKey("cache-spec-provider", "cache-spec-endpoint", params);
    const rows = await db.select().from(providerCache).where(eq(providerCache.key, key));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.provider).toBe("cache-spec-provider");
  });

  it("na 2a chamada dentro do TTL usa o cache e não chama load", async () => {
    trackKey("cache-spec-provider", "cache-spec-endpoint", params);
    const load = vi.fn().mockResolvedValue([{ id: "b" }]);

    await repo.getOrSet({ provider: "cache-spec-provider", endpoint: "cache-spec-endpoint", params, ttlSeconds: 600, load });
    load.mockResolvedValue([{ id: "OUTRO" }]);
    const second = await repo.getOrSet({
      provider: "cache-spec-provider",
      endpoint: "cache-spec-endpoint",
      params,
      ttlSeconds: 600,
      load
    });

    expect(second.value).toEqual([{ id: "b" }]);
    expect(load).toHaveBeenCalledOnce();
    // No acerto de cache o fetchedAt é o da gravação, não "agora".
    const [row] = await db
      .select()
      .from(providerCache)
      .where(eq(providerCache.key, cacheKey("cache-spec-provider", "cache-spec-endpoint", params)));
    expect(second.fetchedAt).toEqual(row!.fetchedAt);
  });

  it("quando o registro está expirado, recarrega e sobrescreve", async () => {
    const key = trackKey("cache-spec-provider", "cache-spec-endpoint", params);
    // grava um registro já vencido diretamente
    await db.insert(providerCache).values({
      key,
      provider: "cache-spec-provider",
      payload: [{ id: "velho" }],
      fetchedAt: new Date(Date.now() - 10_000),
      expiresAt: new Date(Date.now() - 1000)
    });

    const load = vi.fn().mockResolvedValue([{ id: "novo" }]);
    const out = await repo.getOrSet({
      provider: "cache-spec-provider",
      endpoint: "cache-spec-endpoint",
      params,
      ttlSeconds: 600,
      load
    });

    expect(out.value).toEqual([{ id: "novo" }]);
    expect(load).toHaveBeenCalledOnce();
    const rows = await db.select().from(providerCache).where(eq(providerCache.key, key));
    expect(rows[0]!.payload).toEqual([{ id: "novo" }]);
  });

  it("propaga o erro de load em cache miss (sem fallback)", async () => {
    trackKey("cache-spec-provider", "cache-spec-endpoint", { origin: "erro" });
    await expect(
      repo.getOrSet({
        provider: "cache-spec-provider",
        endpoint: "cache-spec-endpoint",
        params: { origin: "erro" },
        ttlSeconds: 600,
        load: () => Promise.reject(new Error("provider caiu"))
      })
    ).rejects.toThrow("provider caiu");
  });
});
