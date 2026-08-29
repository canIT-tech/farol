import { Inject, Injectable } from "@nestjs/common";
import { flightSelections, type Database } from "@farol/db";
import type { FlightProvider } from "@farol/providers";
import { NotFoundError, type FlightOffer, type ProviderSection } from "@farol/shared";
import { DB } from "../db/db.module";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { ProviderCacheRepository } from "../providers/provider-cache.repository";
import { FLIGHT_PROVIDER } from "../providers/providers.module";
import { buildFlightParams } from "../providers/trip-search";
import { TripsService } from "../trips/trips.service";
import { toFlightSelection, type FlightSelection } from "./flight-selection";

const PROVIDER = "amadeus-flight";
const ENDPOINT = "flight-offers";

@Injectable()
export class FlightsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(FLIGHT_PROVIDER) private readonly provider: FlightProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly cache: ProviderCacheRepository,
    private readonly trips: TripsService
  ) {}

  async search(userId: string, tripId: string): Promise<ProviderSection<FlightOffer>> {
    const trip = await this.trips.get(userId, tripId);
    const params = buildFlightParams(trip);

    try {
      const { value } = await this.cache.getOrSet<FlightOffer[]>({
        provider: PROVIDER,
        endpoint: ENDPOINT,
        params: { ...params },
        ttlSeconds: this.env.FLIGHT_CACHE_TTL_SECONDS,
        load: () => this.provider.search(params)
      });
      return { offers: value, stale: false, error: null };
    } catch (err) {
      // §7.3: falha do provider degrada a seção sem derrubar a página.
      // no_destination_chosen é lançado por buildFlightParams (fora do try) e propaga.
      console.error(
        JSON.stringify({ event: "flight_search_failed", tripId, message: (err as Error).message })
      );
      return { offers: [], stale: false, error: "unavailable" };
    }
  }

  async select(userId: string, tripId: string, offerId: string): Promise<FlightSelection> {
    const section = await this.search(userId, tripId);
    const offer = section.offers.find((candidate) => candidate.id === offerId);
    if (offer === undefined) {
      throw new NotFoundError("oferta de voo não encontrada");
    }

    const rows = await this.db
      .insert(flightSelections)
      .values({
        id: crypto.randomUUID(),
        tripId,
        offer,
        price: String(offer.price),
        currency: offer.currency,
        carrier: offer.carrier,
        stops: offer.stops,
        departAt: new Date(offer.departAt),
        returnAt: offer.returnAt === null ? null : new Date(offer.returnAt),
        deepLink: offer.deepLink
      })
      .returning();
    return toFlightSelection(rows[0]!);
  }
}
