import { Inject, Injectable } from "@nestjs/common";
import { hotelSelections, type Database } from "@farol/db";
import type { HotelProvider } from "@farol/providers";
import { DomainError, NotFoundError, type HotelOffer, type ProviderSection } from "@farol/shared";
import { DB } from "../db/db.module";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { ProviderCacheRepository } from "../providers/provider-cache.repository";
import { cachedSection, degradeSection } from "../providers/provider-section";
import { HOTEL_PROVIDER } from "../providers/providers.module";
import { buildHotelParams, chosenIata } from "../providers/trip-search";
import { TripsService } from "../trips/trips.service";
import { GeoService } from "../geo/geo.service";
import { toHotelSelection, type HotelSelection } from "./hotel-selection";

const PROVIDER = "liteapi-hotel";
const ENDPOINT = "hotel-offers";

@Injectable()
export class HotelsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(HOTEL_PROVIDER) private readonly provider: HotelProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly cache: ProviderCacheRepository,
    private readonly trips: TripsService,
    private readonly geo: GeoService
  ) {}

  async search(userId: string, tripId: string): Promise<ProviderSection<HotelOffer>> {
    const trip = await this.trips.get(userId, tripId);
    // Fora do degrade: sem destino escolhido é erro de uso, não provider fora do ar.
    const iata = chosenIata(trip);

    return degradeSection("hotel_search_failed", { tripId }, async () => {
      // Sem cidade no catálogo não há país nem coordenada, e a LiteAPI exige
      // país. Degrada como qualquer falha de provider (§7.3).
      const city = await this.geo.findCity(iata);
      if (city === null) {
        throw new DomainError(
          "destination_city_unknown",
          `cidade do destino ${iata} não está no catálogo`
        );
      }
      const params = buildHotelParams(trip, {
        name: city.name,
        countryCode: city.countryCode,
        lat: city.lat,
        lon: city.lon
      });

      return cachedSection(this.cache, {
        provider: PROVIDER,
        endpoint: ENDPOINT,
        params: { ...params },
        ttlSeconds: this.env.HOTEL_CACHE_TTL_SECONDS,
        load: () => this.provider.search(params)
      });
    });
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
