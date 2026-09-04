import {
  airlineSchema,
  airportSchema,
  citySchema,
  geoLocationSchema,
  type Airline,
  type Airport,
  type City,
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
export const CITIES_PATH = "/data/{locale}/cities.json";

/** Callback fixo do JSONP do /whereami — o endpoint exige um e ecoa este. */
export const WHEREAMI_CALLBACK = "useriata";

const PRIVATE_IPV4 =
  /^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/;

/**
 * IP que a Travelpayouts consegue localizar. Endereço de loopback ou de rede
 * privada ela não resolve — e não erra: devolve Londres, o default dela. Em
 * desenvolvimento `req.ip` é sempre "::1", então mandar esse valor faria toda
 * origem sugerida virar Londres. Sem o parâmetro, ela usa o IP da conexão.
 */
export function isRoutableIp(ip: string): boolean {
  const clean = ip.trim().replace(/^::ffff:/i, "").toLowerCase();
  if (clean === "" || clean === "::1" || clean === "localhost") {
    return false;
  }
  if (PRIVATE_IPV4.test(clean)) {
    return false;
  }
  // fc00::/7 (ULA) e fe80::/10 (link-local) do IPv6.
  return !/^(?:f[cd]|fe[89ab])/.test(clean);
}

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

export interface TpCity {
  code: string;
  name: string;
  country_code: string;
  coordinates?: { lat: number; lon: number } | null;
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

export function normalizeCities(raw: TpCity[]): City[] {
  return raw.map((item) =>
    citySchema.parse({
      iata: item.code,
      name: item.name,
      countryCode: item.country_code,
      lat: item.coordinates?.lat ?? null,
      lon: item.coordinates?.lon ?? null
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
  private citiesCache: CacheEntry<City[]> | null = null;

  constructor(cfg: TravelpayoutsGeoProviderConfig) {
    this.http = cfg.http ?? createTravelpayoutsHttp(cfg);
    this.locale = cfg.locale ?? "en";
    this.ttlMs = cfg.dumpTtlMs ?? DEFAULT_DUMP_TTL_MS;
    this.now = cfg.now ?? (() => Date.now());
  }

  // Os três dumps (aeroportos, companhias, cidades) são o mesmo shape:
  // cache em memória com TTL, path fixo, normalizador próprio.
  private async cachedDump<Raw, T>(
    cache: CacheEntry<T> | null,
    setCache: (entry: CacheEntry<T>) => void,
    path: string,
    normalize: (raw: Raw[]) => T
  ): Promise<T> {
    if (cache !== null && cache.expiresAt > this.now()) {
      return cache.value;
    }
    const raw = await this.http.get<Raw[]>(path.replace("{locale}", this.locale));
    const value = normalize(raw);
    setCache({ value, expiresAt: this.now() + this.ttlMs });
    return value;
  }

  /** Origem provável do usuário a partir do IP. null quando o IP é desconhecido. */
  async whereami(ip: string, locale = "br"): Promise<GeoLocation | null> {
    const body = await this.http.getText(WHEREAMI_URL, {
      ip: isRoutableIp(ip) ? ip : undefined,
      locale,
      callback: WHEREAMI_CALLBACK
    });
    return normalizeWhereami(parseJsonp(body) as TpWhereamiResponse);
  }

  async airports(): Promise<Airport[]> {
    return this.cachedDump<TpAirport, Airport[]>(
      this.airportsCache,
      (entry) => (this.airportsCache = entry),
      AIRPORTS_PATH,
      normalizeAirports
    );
  }

  async airlines(): Promise<Airline[]> {
    return this.cachedDump<TpAirline, Airline[]>(
      this.airlinesCache,
      (entry) => (this.airlinesCache = entry),
      AIRLINES_PATH,
      normalizeAirlines
    );
  }

  async cities(): Promise<City[]> {
    return this.cachedDump<TpCity, City[]>(
      this.citiesCache,
      (entry) => (this.citiesCache = entry),
      CITIES_PATH,
      normalizeCities
    );
  }

  // Um IATA pode ser de cidade (LIS) ou de aeroporto (GRU). Tenta cidade
  // primeiro e, não achando, resolve pelo city_code do aeroporto — é assim que
  // "GRU" vira o centro de São Paulo, e não a coordenada do terminal.
  async city(iata: string): Promise<City | null> {
    const upper = iata.toUpperCase();
    const cities = await this.cities();
    const direct = cities.find((c) => c.iata === upper);
    if (direct !== undefined) {
      return direct;
    }
    const airport = await this.airport(upper);
    if (airport === null || airport.cityCode === null) {
      return null;
    }
    return cities.find((c) => c.iata === airport.cityCode) ?? null;
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
