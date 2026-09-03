import {
  airlineSchema,
  airportSchema,
  geoLocationSchema,
  type Airline,
  type Airport,
  type GeoLocation
} from "@farol/shared";
import {
  createTravelpayoutsHttp,
  type TravelpayoutsHttp,
  type TravelpayoutsHttpConfig
} from "./http.js";
import type { GeoProvider } from "../geo-provider.js";

export const WHEREAMI_URL = "https://www.travelpayouts.com/whereami";
export const AIRPORTS_PATH = "/data/{locale}/airports.json";
export const AIRLINES_PATH = "/data/{locale}/airlines.json";

/** Callback fixo do JSONP do /whereami — o endpoint exige um e ecoa este. */
export const WHEREAMI_CALLBACK = "useriata";

export interface TravelpayoutsGeoProviderConfig extends TravelpayoutsHttpConfig {
  /** Locale dos dumps estáticos. Default "en" (é o único completo). */
  locale?: string;
  /** TTL do cache em memória dos dumps. Default 24 h — aeroporto não muda de lugar. */
  dumpTtlMs?: number;
  http?: TravelpayoutsHttp;
}

export interface TpWhereamiResponse {
  iata?: string;
  name?: string;
  country_name?: string;
  country_code?: string;
  /** "lon:lat" — nesta ordem, ao contrário do resto da API. */
  coordinates?: string;
}

export interface TpAirport {
  code: string;
  name: string;
  city_code?: string;
  country_code: string;
  time_zone?: string;
  coordinates?: { lat: number; lon: number } | null;
  flightable?: boolean;
  iata_type?: string;
}

export interface TpAirline {
  code: string;
  name: string;
  is_lowcost?: boolean;
}

// "useriata({...})" → objeto. O /whereami só fala JSONP; sem callback ele
// devolve HTML, então a chamada sempre manda um e a resposta é desembrulhada aqui.
export function parseJsonp(body: string): unknown {
  const open = body.indexOf("(");
  const close = body.lastIndexOf(")");
  if (open === -1 || close <= open) {
    throw new Error("resposta JSONP inesperada do Travelpayouts");
  }
  return JSON.parse(body.slice(open + 1, close)) as unknown;
}

// "-52.6157:-27.100935" → { lon, lat }. Coordenada ausente ou malformada vira null.
export function parseCoordinates(raw: string | undefined): { lat: number; lon: number } | null {
  if (raw === undefined) {
    return null;
  }
  const parts = raw.split(":");
  if (parts.length !== 2) {
    return null;
  }
  const lon = Number(parts[0]);
  const lat = Number(parts[1]);
  if (Number.isNaN(lon) || Number.isNaN(lat)) {
    return null;
  }
  return { lat, lon };
}

export function normalizeWhereami(raw: TpWhereamiResponse): GeoLocation | null {
  if (raw.iata === undefined || raw.country_code === undefined) {
    return null;
  }
  const coords = parseCoordinates(raw.coordinates);
  return geoLocationSchema.parse({
    iata: raw.iata,
    name: raw.name ?? raw.iata,
    countryName: raw.country_name ?? raw.country_code,
    countryCode: raw.country_code,
    lat: coords === null ? null : coords.lat,
    lon: coords === null ? null : coords.lon
  });
}

export function normalizeAirports(raw: TpAirport[]): Airport[] {
  return raw.map((item) =>
    airportSchema.parse({
      iata: item.code,
      name: item.name,
      cityCode: item.city_code ?? null,
      countryCode: item.country_code,
      timeZone: item.time_zone ?? null,
      lat: item.coordinates?.lat ?? null,
      lon: item.coordinates?.lon ?? null,
      flightable: item.flightable ?? false
    })
  );
}

export function normalizeAirlines(raw: TpAirline[]): Airline[] {
  return raw.map((item) =>
    airlineSchema.parse({
      code: item.code,
      name: item.name,
      isLowcost: item.is_lowcost ?? false
    })
  );
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_DUMP_TTL_MS = 86_400_000;

// Dados geográficos do Travelpayouts: origem pelo IP (/whereami) e os dumps
// estáticos de aeroportos e companhias, que traduzem "GRU" em "Guarulhos" e
// "LA" em "LATAM" na UI. Os dumps têm megabytes — ficam em cache na memória.
export class TravelpayoutsGeoProvider implements GeoProvider {
  private readonly http: TravelpayoutsHttp;
  private readonly locale: string;
  private readonly ttlMs: number;
  private readonly now: () => number;
  private airportsCache: CacheEntry<Airport[]> | null = null;
  private airlinesCache: CacheEntry<Airline[]> | null = null;

  constructor(cfg: TravelpayoutsGeoProviderConfig) {
    this.http = cfg.http ?? createTravelpayoutsHttp(cfg);
    this.locale = cfg.locale ?? "en";
    this.ttlMs = cfg.dumpTtlMs ?? DEFAULT_DUMP_TTL_MS;
    this.now = cfg.now ?? (() => Date.now());
  }

  /** Origem provável do usuário a partir do IP. null quando o IP é desconhecido. */
  async whereami(ip: string, locale = "br"): Promise<GeoLocation | null> {
    const body = await this.http.getText(WHEREAMI_URL, {
      ip,
      locale,
      callback: WHEREAMI_CALLBACK
    });
    return normalizeWhereami(parseJsonp(body) as TpWhereamiResponse);
  }

  async airports(): Promise<Airport[]> {
    if (this.airportsCache !== null && this.airportsCache.expiresAt > this.now()) {
      return this.airportsCache.value;
    }
    const raw = await this.http.get<TpAirport[]>(
      AIRPORTS_PATH.replace("{locale}", this.locale)
    );
    const value = normalizeAirports(raw);
    this.airportsCache = { value, expiresAt: this.now() + this.ttlMs };
    return value;
  }

  async airlines(): Promise<Airline[]> {
    if (this.airlinesCache !== null && this.airlinesCache.expiresAt > this.now()) {
      return this.airlinesCache.value;
    }
    const raw = await this.http.get<TpAirline[]>(
      AIRLINES_PATH.replace("{locale}", this.locale)
    );
    const value = normalizeAirlines(raw);
    this.airlinesCache = { value, expiresAt: this.now() + this.ttlMs };
    return value;
  }

  async airport(iata: string): Promise<Airport | null> {
    const upper = iata.toUpperCase();
    return (await this.airports()).find((a) => a.iata === upper) ?? null;
  }

  async airline(code: string): Promise<Airline | null> {
    const upper = code.toUpperCase();
    return (await this.airlines()).find((a) => a.code === upper) ?? null;
  }

  /** Busca por prefixo de IATA ou trecho do nome — autocomplete de origem. */
  async searchAirports(term: string, limit = 10): Promise<Airport[]> {
    const needle = term.trim().toLowerCase();
    if (needle === "") {
      return [];
    }
    const matches = (await this.airports()).filter(
      (a) =>
        a.flightable &&
        (a.iata.toLowerCase().startsWith(needle) || a.name.toLowerCase().includes(needle))
    );
    return matches.slice(0, limit);
  }
}
