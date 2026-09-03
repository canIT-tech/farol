import type { ProviderSection } from "@farol/shared";
import type { ProviderCacheRepository, GetOrSetArgs } from "./provider-cache.repository";

// FlightsService.section() e HotelsService.search() reimplementavam o mesmo
// par: buscar no cache (ou no provider) e, se algo no meio do caminho falhar,
// devolver a seção degradada em vez de derrubar a página (design §7.3).

/** Sucesso do cache/provider já embrulhado como ProviderSection. */
export async function cachedSection<T>(
  cache: ProviderCacheRepository,
  args: GetOrSetArgs<T[]>
): Promise<ProviderSection<T>> {
  const { value, fetchedAt } = await cache.getOrSet(args);
  return { offers: value, stale: false, fetchedAt: fetchedAt.toISOString(), error: null };
}

/** Qualquer falha dentro de `run` (cache, provider, ou lookup antes dele) vira seção vazia. */
export async function degradeSection<T>(
  event: string,
  logFields: Record<string, unknown>,
  run: () => Promise<ProviderSection<T>>
): Promise<ProviderSection<T>> {
  try {
    return await run();
  } catch (err) {
    console.error(JSON.stringify({ event, ...logFields, message: (err as Error).message }));
    return { offers: [], stale: false, fetchedAt: null, error: "unavailable" };
  }
}
