import { Global, Module } from "@nestjs/common";
import { ENV } from "../config/config.module";
import { ProviderCacheRepository } from "./provider-cache.repository";
import {
  createFlightProvider,
  createGeoProvider,
  createHotelProvider,
  createPlacesProvider
} from "./provider-factories";

export const FLIGHT_PROVIDER = Symbol("FLIGHT_PROVIDER");
export const HOTEL_PROVIDER = Symbol("HOTEL_PROVIDER");
export const PLACES_PROVIDER = Symbol("PLACES_PROVIDER");
export const GEO_PROVIDER = Symbol("GEO_PROVIDER");

@Global()
@Module({
  providers: [
    ProviderCacheRepository,
    { provide: FLIGHT_PROVIDER, inject: [ENV], useFactory: createFlightProvider },
    { provide: HOTEL_PROVIDER, inject: [ENV], useFactory: createHotelProvider },
    { provide: GEO_PROVIDER, inject: [ENV], useFactory: createGeoProvider },
    { provide: PLACES_PROVIDER, inject: [ENV], useFactory: createPlacesProvider }
  ],
  exports: [
    ProviderCacheRepository,
    FLIGHT_PROVIDER,
    HOTEL_PROVIDER,
    PLACES_PROVIDER,
    GEO_PROVIDER
  ]
})
export class ProvidersModule {}
