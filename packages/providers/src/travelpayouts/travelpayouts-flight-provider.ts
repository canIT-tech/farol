import {
  flightSearchParamsSchema,
  type FlightOffer,
  type FlightSearchParams,
  type RouteDeal,
  type RoutePriceSample
} from "@farol/shared";
import type { FlightProvider } from "../flight-provider.js";
import { AVIASALES_SEARCH_TEMPLATE } from "./deep-link.js";
import {
  createTravelpayoutsHttp,
  type TravelpayoutsHttp,
  type TravelpayoutsHttpConfig
} from "./http.js";
import {
  normalizeCheap,
  normalizeKeyedDeals,
  normalizeMatrixSamples,
  normalizeNearestPlaces,
  type DeepLinkContext,
  type TpCheapResponse,
  type TpKeyedDealsResponse,
  type TpMatrixResponse,
  type TpNearestResponse
} from "./normalize-flight.js";

export interface TravelpayoutsFlightProviderConfig extends TravelpayoutsHttpConfig {
  /** Id de afiliado — vai em todo deep link de saída. */
  marker: string;
  currency?: string;
  deepLinkTemplate?: string;
  http?: TravelpayoutsHttp;
}

export const CHEAP_PATH = "/v1/prices/cheap";
export const MONTHLY_PATH = "/v1/prices/monthly";
export const CITY_DIRECTIONS_PATH = "/v1/city-directions";
export const LATEST_PATH = "/v2/prices/latest";
export const MONTH_MATRIX_PATH = "/v2/prices/month-matrix";
export const NEAREST_PLACES_PATH = "/v2/prices/nearest-places-matrix";

export interface RouteQuery {
  originIata: string;
  destinationIata: string;
}

export interface LatestPricesQuery extends RouteQuery {
  /** "year" ou "month" — janela que o Travelpayouts varre. */
  periodType?: "year" | "month";
  page?: number;
  limit?: number;
}

const DEFAULT_CURRENCY = "brl";
const DEFAULT_LATEST_LIMIT = 30;

// "2026-09-17" -> "2026-09". Os endpoints v1 aceitam mês, e com mês eles
// devolvem resultado; com data exata a base cacheada quase sempre vem vazia.
export function toMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

// Provider de voo sobre a Data API do Travelpayouts (Aviasales).
// Sem OAuth: token no header, marker de afiliado em cada link (spec de migração).
// O preço é cacheado/agregado, não busca live — a UI mostra "preço aproximado".
export class TravelpayoutsFlightProvider implements FlightProvider {
  private readonly http: TravelpayoutsHttp;
  private readonly currency: string;
  private readonly template: string;

  constructor(private readonly cfg: TravelpayoutsFlightProviderConfig) {
    this.http = cfg.http ?? createTravelpayoutsHttp(cfg);
    this.currency = cfg.currency ?? DEFAULT_CURRENCY;
    this.template = cfg.deepLinkTemplate ?? AVIASALES_SEARCH_TEMPLATE;
  }

  private deepLinkContext(passengers: number): DeepLinkContext {
    return { template: this.template, marker: this.cfg.marker, passengers };
  }

  // Duas fontes complementares: /v1/prices/cheap dá a tarifa mais barata da rota
  // com ida e volta reais; /v2/prices/nearest-places-matrix dá alternativas de
  // aeroporto vizinho já com link direto para a tarifa. Uma falhando, a outra
  // ainda responde (§7.3 — degradação graciosa dentro da própria seção).
  async search(params: FlightSearchParams): Promise<FlightOffer[]> {
    const p = flightSearchParamsSchema.parse(params);

    const results = await Promise.allSettled([
      this.cheapest(p),
      this.nearbyOptions(p)
    ]);
    if (results.every((r) => r.status === "rejected")) {
      throw (results[0] as PromiseRejectedResult).reason as Error;
    }

    const byId = new Map<string, FlightOffer>();
    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const offer of result.value) {
          byId.set(offer.id, offer);
        }
      }
    }

    let offers = [...byId.values()];
    if (p.maxStops !== undefined) {
      offers = offers.filter((offer) => offer.stops <= p.maxStops!);
    }
    return offers.sort((a, b) => a.price - b.price);
  }

  /** /v1/prices/cheap — tarifa mais barata da rota no mês pedido. */
  async cheapest(params: FlightSearchParams): Promise<FlightOffer[]> {
    const p = flightSearchParamsSchema.parse(params);
    const raw = await this.http.get<TpCheapResponse>(CHEAP_PATH, {
      origin: p.originIata,
      destination: p.destinationIata,
      depart_date: toMonth(p.departDate),
      return_date: p.returnDate === undefined ? undefined : toMonth(p.returnDate),
      currency: this.currency
    });
    return normalizeCheap(raw, this.deepLinkContext(p.adults + p.children), p.originIata);
  }

  /** /v2/prices/nearest-places-matrix — aeroportos vizinhos de origem e destino. */
  async nearbyOptions(params: FlightSearchParams): Promise<FlightOffer[]> {
    const p = flightSearchParamsSchema.parse(params);
    const raw = await this.http.get<TpNearestResponse>(NEAREST_PLACES_PATH, {
      origin: p.originIata,
      destination: p.destinationIata,
      depart_date: p.departDate,
      return_date: p.returnDate,
      currency: this.currency,
      show_to_affiliates: true
    });
    return normalizeNearestPlaces(
      raw,
      this.deepLinkContext(p.adults + p.children),
      this.currency
    );
  }

  /** /v2/prices/month-matrix — preço por dia, para escolher o melhor dia do mês. */
  async priceCalendar(query: RouteQuery, passengers = 1): Promise<RoutePriceSample[]> {
    const raw = await this.http.get<TpMatrixResponse>(MONTH_MATRIX_PATH, {
      origin: query.originIata,
      destination: query.destinationIata,
      currency: this.currency,
      show_to_affiliates: true
    });
    return normalizeMatrixSamples(raw, this.deepLinkContext(passengers)).sort(
      (a, b) => a.departDate.localeCompare(b.departDate)
    );
  }

  /** /v2/prices/latest — o que a rota custou recentemente ("faixa de preço"). */
  async latestPrices(query: LatestPricesQuery, passengers = 1): Promise<RoutePriceSample[]> {
    const raw = await this.http.get<TpMatrixResponse>(LATEST_PATH, {
      origin: query.originIata,
      destination: query.destinationIata,
      currency: this.currency,
      period_type: query.periodType ?? "year",
      page: query.page ?? 1,
      limit: query.limit ?? DEFAULT_LATEST_LIMIT,
      show_to_affiliates: true,
      sorting: "price",
      trip_class: 0
    });
    return normalizeMatrixSamples(raw, this.deepLinkContext(passengers)).sort(
      (a, b) => a.price - b.price
    );
  }

  /** /v1/prices/monthly — melhor preço mês a mês, para responder "quando ir". */
  async monthlyPrices(query: RouteQuery, passengers = 1): Promise<RouteDeal[]> {
    const raw = await this.http.get<TpKeyedDealsResponse>(MONTHLY_PATH, {
      origin: query.originIata,
      destination: query.destinationIata,
      currency: this.currency
    });
    return normalizeKeyedDeals(raw, this.deepLinkContext(passengers)).sort((a, b) =>
      a.key.localeCompare(b.key)
    );
  }

  /** /v1/city-directions — destinos mais baratos saindo da origem (descoberta). */
  async cityDirections(originIata: string, passengers = 1): Promise<RouteDeal[]> {
    const raw = await this.http.get<TpKeyedDealsResponse>(CITY_DIRECTIONS_PATH, {
      origin: originIata,
      currency: this.currency
    });
    return normalizeKeyedDeals(raw, this.deepLinkContext(passengers)).sort(
      (a, b) => a.price - b.price
    );
  }
}
