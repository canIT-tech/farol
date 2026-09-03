import {
  AmadeusHotelProvider,
  GooglePlacesProvider,
  TravelpayoutsFlightProvider,
  TravelpayoutsGeoProvider,
  type PlacesProvider,
  type HotelProvider
} from "@farol/providers";
import { DomainError } from "@farol/shared";
import type { Env } from "../config/env.schema";

// A Amadeus descontinuou o Self-Service e não foi substituída no hotel ainda
// (o Hotellook não vem liberado na conta Travelpayouts). Sem credencial, o
// provider recusa e a seção de hotel degrada — o resto do roteiro segue (§7.3).
export function createHotelProvider(env: Env): HotelProvider {
  if (env.AMADEUS_CLIENT_ID === undefined || env.AMADEUS_CLIENT_SECRET === undefined) {
    return {
      search: () =>
        Promise.reject(
          new DomainError("hotel_provider_not_configured", "provider de hotel não configurado")
        )
    };
  }
  return new AmadeusHotelProvider({
    baseUrl: env.AMADEUS_BASE_URL,
    clientId: env.AMADEUS_CLIENT_ID,
    clientSecret: env.AMADEUS_CLIENT_SECRET,
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
