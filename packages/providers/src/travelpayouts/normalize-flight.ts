import {
  flightOfferSchema,
  routeDealSchema,
  routePriceSampleSchema,
  type FlightOffer,
  type RouteDeal,
  type RoutePriceSample
} from "@farol/shared";
import { fillTemplate } from "../template.js";
import { aviasalesLink, ddmm } from "./deep-link.js";

// ── Shapes crus do Travelpayouts ────────────────────────────────────────────

/** Item de /v2/prices/latest e /v2/prices/month-matrix — mesmo shape nos dois. */
export interface TpMatrixItem {
  depart_date: string;
  return_date: string;
  origin: string;
  destination: string;
  gate: string;
  found_at: string;
  trip_class: number;
  value: number;
  number_of_changes: number;
  duration: number;
  distance: number;
}
export interface TpMatrixResponse {
  data?: TpMatrixItem[];
  currency?: string;
}

/** Item de /v2/prices/nearest-places-matrix — o único que traz link e companhia. */
export interface TpNearestItem {
  link: string;
  origin: string;
  destination: string;
  gate: string;
  main_airline: string;
  depart_date: string;
  found_at: string;
  transfers: number;
  duration: number;
  distance: number;
  price: number;
}
export interface TpNearestResponse {
  prices?: TpNearestItem[];
  origins?: string[];
  destinations?: string[];
}

/** Item de /v1/prices/cheap — indexado por destino e depois por posição. */
export interface TpCheapItem {
  airline: string;
  departure_at: string;
  return_at: string;
  price: number;
  flight_number: number;
  duration: number;
  duration_to?: number;
  duration_back?: number;
  transfers?: number;
}
export interface TpCheapResponse {
  data?: Record<string, Record<string, TpCheapItem>>;
  currency?: string;
}

/** Item de /v1/prices/monthly (chave = mês) e /v1/city-directions (chave = IATA). */
export interface TpDealItem {
  origin: string;
  destination: string;
  airline: string;
  departure_at: string;
  return_at: string;
  price: number;
  flight_number: number;
  transfers: number;
}
export interface TpKeyedDealsResponse {
  data?: Record<string, TpDealItem>;
  currency?: string;
}

// ── Contexto de deep link ───────────────────────────────────────────────────

export interface DeepLinkContext {
  /** Template com {origin} {destination} {departDdmm} {returnDdmm} {passengers} {marker}. */
  template: string;
  marker: string;
  passengers: number;
}

export interface Route {
  origin: string;
  destination: string;
  departDate: string;
  returnDate: string | null;
}

export function buildDeepLink(ctx: DeepLinkContext, route: Route): string {
  return fillTemplate(ctx.template, {
    origin: route.origin,
    destination: route.destination,
    departDdmm: ddmm(route.departDate),
    returnDdmm: route.returnDate === null ? "" : ddmm(route.returnDate),
    passengers: String(ctx.passengers),
    marker: ctx.marker
  });
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Campo textual do Travelpayouts que vem "" quando não há valor. */
export function nullIfEmpty(value: string | undefined): string | null {
  return value === undefined || value === "" ? null : value;
}

export function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

const DEFAULT_CURRENCY = "brl";

function currencyOf(raw: { currency?: string }): string {
  return raw.currency ?? DEFAULT_CURRENCY;
}

// ── Normalizadores ──────────────────────────────────────────────────────────

// /v2/prices/latest e /v2/prices/month-matrix → amostras de preço da rota.
// Não são ofertas: não têm companhia nem horário, só "custou X no dia Y".
export function normalizeMatrixSamples(
  raw: TpMatrixResponse,
  ctx: DeepLinkContext
): RoutePriceSample[] {
  const currency = currencyOf(raw);
  return (raw.data ?? []).map((item) => {
    const departDate = item.depart_date.slice(0, 10);
    const returnDate = nullIfEmpty(item.return_date);
    return routePriceSampleSchema.parse({
      origin: item.origin,
      destination: item.destination,
      departDate,
      returnDate,
      price: item.value,
      currency,
      transfers: item.number_of_changes,
      durationMinutes: item.duration,
      gate: nullIfEmpty(item.gate),
      foundAt: nullIfEmpty(item.found_at),
      deepLink: buildDeepLink(ctx, {
        origin: item.origin,
        destination: item.destination,
        departDate,
        returnDate: returnDate === null ? null : returnDate.slice(0, 10)
      })
    });
  });
}

// /v2/prices/nearest-places-matrix → ofertas de voo. É a melhor fonte do MVP:
// traz companhia, escalas, duração e o link direto para a tarifa no Aviasales,
// além de cobrir aeroportos vizinhos da origem e do destino.
export function normalizeNearestPlaces(
  raw: TpNearestResponse,
  ctx: DeepLinkContext,
  currency: string
): FlightOffer[] {
  return (raw.prices ?? []).map((item) =>
    flightOfferSchema.parse({
      id: `np:${item.origin}:${item.destination}:${item.depart_date}:${item.price}`,
      price: item.price,
      currency,
      carrier: nullIfEmpty(item.main_airline) ?? nullIfEmpty(item.gate) ?? item.origin,
      stops: item.transfers,
      departAt: item.depart_date,
      arriveAt: addMinutes(item.depart_date, item.duration),
      returnAt: null,
      durationMinutes: item.duration,
      deepLink: aviasalesLink(item.link, ctx.marker)
    })
  );
}

// /v1/prices/cheap → ofertas mais baratas da rota, com ida e volta reais.
export function normalizeCheap(
  raw: TpCheapResponse,
  ctx: DeepLinkContext,
  origin: string
): FlightOffer[] {
  const currency = currencyOf(raw);
  const offers: FlightOffer[] = [];
  for (const [destination, byIndex] of Object.entries(raw.data ?? {})) {
    for (const [index, item] of Object.entries(byIndex)) {
      const returnAt = nullIfEmpty(item.return_at);
      offers.push(
        flightOfferSchema.parse({
          id: `cheap:${origin}:${destination}:${index}`,
          price: item.price,
          currency,
          carrier: item.airline,
          stops: item.transfers ?? 0,
          departAt: item.departure_at,
          arriveAt: addMinutes(item.departure_at, item.duration_to ?? item.duration),
          returnAt,
          durationMinutes: item.duration,
          deepLink: buildDeepLink(ctx, {
            origin,
            destination,
            departDate: item.departure_at.slice(0, 10),
            returnDate: returnAt === null ? null : returnAt.slice(0, 10)
          })
        })
      );
    }
  }
  return offers;
}

// /v1/prices/monthly (chave = mês) e /v1/city-directions (chave = IATA do
// destino) → melhor achado por chave. Mesmo shape, normalizador único.
export function normalizeKeyedDeals(
  raw: TpKeyedDealsResponse,
  ctx: DeepLinkContext
): RouteDeal[] {
  const currency = currencyOf(raw);
  return Object.entries(raw.data ?? {}).map(([key, item]) => {
    const returnAt = nullIfEmpty(item.return_at);
    return routeDealSchema.parse({
      key,
      origin: item.origin,
      destination: item.destination,
      airline: item.airline,
      departAt: item.departure_at,
      returnAt,
      price: item.price,
      currency,
      flightNumber: item.flight_number === 0 ? null : String(item.flight_number),
      transfers: item.transfers,
      deepLink: buildDeepLink(ctx, {
        origin: item.origin,
        destination: item.destination,
        departDate: item.departure_at.slice(0, 10),
        returnDate: returnAt === null ? null : returnAt.slice(0, 10)
      })
    });
  });
}
