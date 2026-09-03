import { Inject, Injectable } from "@nestjs/common";
import { flightSelections, type Database } from "@farol/db";
import type { FlightInsightsProvider, RouteQuery } from "@farol/providers";
import {
  NotFoundError,
  type FlightOffer,
  type ProviderSection,
  type RouteDeal,
  type RoutePriceSample
} from "@farol/shared";
import { DB } from "../db/db.module";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { ProviderCacheRepository } from "../providers/provider-cache.repository";
import { FLIGHT_PROVIDER } from "../providers/providers.module";
import { buildFlightParams } from "../providers/trip-search";
import { TripsService } from "../trips/trips.service";
import { GeoService } from "../geo/geo.service";
import { toFlightSelection, type FlightSelection } from "./flight-selection";

const PROVIDER = "travelpayouts-flight";

export const FLIGHT_ENDPOINTS = {
  search: "search",
  nearby: "nearest-places-matrix",
  calendar: "month-matrix",
  latest: "prices-latest",
  monthly: "prices-monthly",
  directions: "city-directions"
} as const;

@Injectable()
export class FlightsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(FLIGHT_PROVIDER) private readonly provider: FlightInsightsProvider,
    @Inject(ENV) private readonly env: Env,
    private readonly cache: ProviderCacheRepository,
    private readonly trips: TripsService,
    private readonly geo: GeoService
  ) {}

  // O provider devolve só códigos ("AD", "GRU"). A tela mostra "Azul" e
  // "São Paulo — Guarulhos", então os nomes são resolvidos aqui, no catálogo
  // que já está em memória. Código fora do catálogo fica nulo e a UI cai no
  // código cru — nunca em um nome inventado.
  async enrich(offers: FlightOffer[]): Promise<FlightOffer[]> {
    const airportNames = new Map<string, string | null>();
    const airlineNames = new Map<string, string | null>();

    const resolve = async <T extends { name: string }>(
      cacheMap: Map<string, string | null>,
      code: string,
      load: (code: string) => Promise<T | null>
    ): Promise<string | null> => {
      if (!cacheMap.has(code)) {
        const found = await load(code).catch(() => null);
        cacheMap.set(code, found === null ? null : found.name);
      }
      return cacheMap.get(code) ?? null;
    };

    return Promise.all(
      offers.map(async (offer) => ({
        ...offer,
        carrierName: await resolve(airlineNames, offer.carrier, (c) => this.geo.findAirline(c)),
        originName: await resolve(airportNames, offer.originIata, (c) => this.geo.findAirport(c)),
        destinationName: await resolve(airportNames, offer.destinationIata, (c) =>
          this.geo.findAirport(c)
        )
      }))
    );
  }

  // Uma seção = uma chamada cacheada ao provider. Falha do provider degrada só
  // esta seção e devolve error "unavailable" (design §7.3) — a página segue de pé.
  private async section<T>(
    tripId: string,
    endpoint: string,
    params: Record<string, unknown>,
    load: () => Promise<T[]>
  ): Promise<ProviderSection<T>> {
    try {
      const { value, fetchedAt } = await this.cache.getOrSet<T[]>({
        provider: PROVIDER,
        endpoint,
        params,
        ttlSeconds: this.env.FLIGHT_CACHE_TTL_SECONDS,
        load
      });
      return { offers: value, stale: false, fetchedAt: fetchedAt.toISOString(), error: null };
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "flight_provider_failed",
          endpoint,
          tripId,
          message: (err as Error).message
        })
      );
      return { offers: [], stale: false, fetchedAt: null, error: "unavailable" };
    }
  }

  /** Ofertas da rota escolhida — /v1/prices/cheap + /v2/prices/nearest-places-matrix. */
  async search(userId: string, tripId: string): Promise<ProviderSection<FlightOffer>> {
    const trip = await this.trips.get(userId, tripId);
    const params = buildFlightParams(trip);
    return this.section(tripId, FLIGHT_ENDPOINTS.search, { ...params }, async () =>
      this.enrich(await this.provider.search(params))
    );
  }

  /** Aeroportos vizinhos de origem e destino — "sair de VCP sai mais barato". */
  async nearbyOptions(userId: string, tripId: string): Promise<ProviderSection<FlightOffer>> {
    const trip = await this.trips.get(userId, tripId);
    const params = buildFlightParams(trip);
    return this.section(tripId, FLIGHT_ENDPOINTS.nearby, { ...params }, async () =>
      this.enrich(await this.provider.nearbyOptions(params))
    );
  }

  // Os três recortes de contexto de preço só variam no endpoint e na chamada
  // ao provider — mesma rota, mesmos passageiros, mesma política de cache.
  private async routeSection<T>(
    userId: string,
    tripId: string,
    endpoint: string,
    call: (query: RouteQuery, passengers: number) => Promise<T[]>
  ): Promise<ProviderSection<T>> {
    const trip = await this.trips.get(userId, tripId);
    const params = buildFlightParams(trip);
    const query = { originIata: params.originIata, destinationIata: params.destinationIata };
    const passengers = params.adults + params.children;
    return this.section(tripId, endpoint, { ...query, passengers }, () =>
      call(query, passengers)
    );
  }

  /** Preço por dia do mês — "melhor dia para sair". */
  priceCalendar(userId: string, tripId: string): Promise<ProviderSection<RoutePriceSample>> {
    return this.routeSection(userId, tripId, FLIGHT_ENDPOINTS.calendar, (q, n) =>
      this.provider.priceCalendar(q, n)
    );
  }

  /** Preços recentes da rota — a faixa que embasa o "está caro ou está barato". */
  latestPrices(userId: string, tripId: string): Promise<ProviderSection<RoutePriceSample>> {
    return this.routeSection(userId, tripId, FLIGHT_ENDPOINTS.latest, (q, n) =>
      this.provider.latestPrices(q, n)
    );
  }

  /** Melhor preço mês a mês — "quando ir". */
  monthlyPrices(userId: string, tripId: string): Promise<ProviderSection<RouteDeal>> {
    return this.routeSection(userId, tripId, FLIGHT_ENDPOINTS.monthly, (q, n) =>
      this.provider.monthlyPrices(q, n)
    );
  }

  /** Destinos mais baratos saindo da origem — sinal de preço para a descoberta.
   *  Não exige destino escolhido: é justamente o que ajuda a escolher. */
  async cityDirections(userId: string, tripId: string): Promise<ProviderSection<RouteDeal>> {
    const trip = await this.trips.get(userId, tripId);
    const passengers = trip.party.adults + trip.party.children;
    return this.section(
      tripId,
      FLIGHT_ENDPOINTS.directions,
      { originIata: trip.originIata, passengers },
      () => this.provider.cityDirections(trip.originIata, passengers)
    );
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
