import { Inject, Injectable } from "@nestjs/common";
import type { PlacesProvider } from "@farol/providers";
import type { Place, PlaceDetails, PlacesTextSearchParams } from "@farol/shared";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { ProviderCacheRepository } from "../providers/provider-cache.repository";
import { PLACES_PROVIDER } from "../providers/providers.module";

const PROVIDER = "google-places";
const SEARCH_ENDPOINT = "text-search";
const DETAILS_ENDPOINT = "details";

export type FindFirstOptions = Omit<PlacesTextSearchParams, "query">;

@Injectable()
export class PlacesService {
  constructor(
    @Inject(PLACES_PROVIDER) private readonly provider: PlacesProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly cache: ProviderCacheRepository
  ) {}

  // Primeiro resultado da busca textual, com cache de 24 h.
  // Falha do Places degrada para null (design §7.3): o item fica needsReview.
  async findFirst(query: string, opts: FindFirstOptions = {}): Promise<Place | null> {
    const params: PlacesTextSearchParams = { query, ...opts };
    try {
      const { value } = await this.cache.getOrSet<Place[]>({
        provider: PROVIDER,
        endpoint: SEARCH_ENDPOINT,
        params: { ...params },
        ttlSeconds: this.env.PLACES_CACHE_TTL_SECONDS,
        load: () => this.provider.textSearch(params)
      });
      return value[0] ?? null;
    } catch (err) {
      console.error(
        JSON.stringify({ event: "places_search_failed", query, message: (err as Error).message })
      );
      return null;
    }
  }

  // Detalhe de um lugar, com o mesmo cache. Não degrada: quem chama decide.
  async details(placeId: string): Promise<PlaceDetails> {
    const { value } = await this.cache.getOrSet<PlaceDetails>({
      provider: PROVIDER,
      endpoint: DETAILS_ENDPOINT,
      params: { placeId },
      ttlSeconds: this.env.PLACES_CACHE_TTL_SECONDS,
      load: () => this.provider.details(placeId)
    });
    return value;
  }
}
