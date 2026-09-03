import {
  GooglePlacesProvider,
  LiteApiHotelProvider,
  TravelpayoutsFlightProvider,
  TravelpayoutsGeoProvider,
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

export function createFlightProvider(env: Env): TravelpayoutsFlightProvider {
  return new TravelpayoutsFlightProvider({
    baseUrl: env.TRAVELPAYOUTS_BASE_URL,
    token: env.TRAVELPAYOUTS_TOKEN,
    marker: env.TRAVELPAYOUTS_MARKER,
    currency: env.TRAVELPAYOUTS_CURRENCY,
    deepLinkTemplate: env.FLIGHT_DEEPLINK_TEMPLATE
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
