import {
  FallbackFlightProvider,
  GoogleFlightsProvider,
  GooglePlacesProvider,
  LiteApiHotelProvider,
  TravelpayoutsFlightProvider,
  TravelpayoutsGeoProvider,
  type FlightInsightsProvider,
  type PlacesProvider
} from "@farol/providers";
import type { Env } from "../config/env.schema";

export function createHotelProvider(env: Env): LiteApiHotelProvider {
  return new LiteApiHotelProvider({
    baseUrl: env.LITEAPI_BASE_URL,
    apiKey: env.LITEAPI_KEY,
    currency: env.LITEAPI_CURRENCY,
    guestNationality: env.LITEAPI_GUEST_NATIONALITY,
    defaultRadiusMeters: env.HOTEL_SEARCH_RADIUS_METERS,
    deepLinkTemplate: env.HOTEL_DEEPLINK_TEMPLATE
  });
}

export function createTravelpayoutsFlightProvider(env: Env): TravelpayoutsFlightProvider {
  return new TravelpayoutsFlightProvider({
    baseUrl: env.TRAVELPAYOUTS_BASE_URL,
    token: env.TRAVELPAYOUTS_TOKEN,
    marker: env.TRAVELPAYOUTS_MARKER,
    currency: env.TRAVELPAYOUTS_CURRENCY,
    deepLinkTemplate: env.FLIGHT_DEEPLINK_TEMPLATE
  });
}

// Ofertas do Google Flights, insights e reserva do Travelpayouts. O Google dá
// preço real; o Travelpayouts dá "quando ir", "melhor dia", aeroportos vizinhos
// — e o marker de afiliado. Desligar o GOOGLE_FLIGHTS_ENABLED devolve o
// comportamento anterior, com o Travelpayouts sozinho.
export function createFlightProvider(env: Env): FlightInsightsProvider {
  const travelpayouts = createTravelpayoutsFlightProvider(env);
  if (env.GOOGLE_FLIGHTS_ENABLED === "false") {
    return travelpayouts;
  }
  return new FallbackFlightProvider({
    primary: new GoogleFlightsProvider({
      baseUrl: env.GOOGLE_FLIGHTS_BASE_URL,
      locale: env.GOOGLE_FLIGHTS_LOCALE,
      currency: env.GOOGLE_FLIGHTS_CURRENCY
    }),
    fallback: travelpayouts,
    // Cair no fallback é normal e não é erro do usuário, mas precisa aparecer:
    // uma sequência disso no log é o sinal de que o layout do Google mudou.
    // String(error) em vez de error.message: registra também a classe, e
    // distinguir GoogleFlightsParseError de GoogleFlightsHttpError é a
    // diferença entre "mudaram o layout" e "fomos bloqueados".
    onFallback: (error) => {
      console.warn(JSON.stringify({ event: "google_flights_fallback", message: String(error) }));
    }
  });
}

export function createGeoProvider(env: Env): TravelpayoutsGeoProvider {
  return new TravelpayoutsGeoProvider({
    baseUrl: env.TRAVELPAYOUTS_BASE_URL,
    token: env.TRAVELPAYOUTS_TOKEN,
    dumpTtlMs: env.GEO_DUMP_TTL_SECONDS * 1000
  });
}

export function createPlacesProvider(env: Env): PlacesProvider {
  return new GooglePlacesProvider({ apiKey: env.GOOGLE_PLACES_KEY });
}
