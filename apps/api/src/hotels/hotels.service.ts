import { Inject, Injectable } from "@nestjs/common";
import { hotelSelections, type Database } from "@farol/db";
import type { HotelProvider } from "@farol/providers";
import { NotFoundError, type HotelOffer, type ProviderSection } from "@farol/shared";
import { DB } from "../db/db.module";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { ProviderCacheRepository } from "../providers/provider-cache.repository";
import { HOTEL_PROVIDER } from "../providers/providers.module";
import { buildHotelParams } from "../providers/trip-search";
import { TripsService } from "../trips/trips.service";
import { toHotelSelection, type HotelSelection } from "./hotel-selection";

const PROVIDER = "amadeus-hotel";
const ENDPOINT = "hotel-offers";

@Injectable()
export class HotelsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(HOTEL_PROVIDER) private readonly provider: HotelProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly cache: ProviderCacheRepository,
    private readonly trips: TripsService
  ) {}

  async search(userId: string, tripId: string): Promise<ProviderSection<HotelOffer>> {
    const trip = await this.trips.get(userId, tripId);
    const params = buildHotelParams(trip);

    try {
      const { value, fetchedAt } = await this.cache.getOrSet<HotelOffer[]>({
        provider: PROVIDER,
        endpoint: ENDPOINT,
        params: { ...params },
        ttlSeconds: this.env.HOTEL_CACHE_TTL_SECONDS,
        load: () => this.provider.search(params)
      });
      return { offers: value, stale: false, fetchedAt: fetchedAt.toISOString(), error: null };
    } catch (err) {
      // §7.3: falha do provider degrada a seção sem derrubar a página.
      // no_destination_chosen é lançado por buildHotelParams (fora do try) e propaga.
      console.error(
        JSON.stringify({ event: "hotel_search_failed", tripId, message: (err as Error).message })
      );
      return { offers: [], stale: false, fetchedAt: null, error: "unavailable" };
    }
  }

  async select(userId: string, tripId: string, offerId: string): Promise<HotelSelection> {
    const section = await this.search(userId, tripId);
    const offer = section.offers.find((candidate) => candidate.id === offerId);
    if (offer === undefined) {
      throw new NotFoundError("oferta de hotel não encontrada");
    }

    const rows = await this.db
      .insert(hotelSelections)
      .values({
        id: crypto.randomUUID(),
        tripId,
        offer,
        name: offer.name,
        region: offer.region,
        pricePerNight: String(offer.pricePerNight),
        priceTotal: String(offer.priceTotal),
        currency: offer.currency,
        rating: offer.rating === null ? null : String(offer.rating),
        deepLink: offer.deepLink
      })
      .returning();
    return toHotelSelection(rows[0]!);
  }
}
