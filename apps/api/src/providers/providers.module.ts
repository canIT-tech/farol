import { Global, Module } from "@nestjs/common";
import { AmadeusFlightProvider, AmadeusHotelProvider } from "@farol/providers";
import { ENV } from "../config/config.module";
import type { Env } from "../config/env.schema";
import { ProviderCacheRepository } from "./provider-cache.repository";

export const FLIGHT_PROVIDER = Symbol("FLIGHT_PROVIDER");
export const HOTEL_PROVIDER = Symbol("HOTEL_PROVIDER");

@Global()
@Module({
  providers: [
    ProviderCacheRepository,
    {
      provide: FLIGHT_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        new AmadeusFlightProvider({
          baseUrl: env.AMADEUS_BASE_URL,
          clientId: env.AMADEUS_CLIENT_ID,
          clientSecret: env.AMADEUS_CLIENT_SECRET,
          deepLinkTemplate: env.FLIGHT_DEEPLINK_TEMPLATE
        })
    },
    {
      provide: HOTEL_PROVIDER,
      inject: [ENV],
      useFactory: (env: Env) =>
        new AmadeusHotelProvider({
          baseUrl: env.AMADEUS_BASE_URL,
          clientId: env.AMADEUS_CLIENT_ID,
          clientSecret: env.AMADEUS_CLIENT_SECRET,
          deepLinkTemplate: env.HOTEL_DEEPLINK_TEMPLATE
        })
    }
  ],
  exports: [ProviderCacheRepository, FLIGHT_PROVIDER, HOTEL_PROVIDER]
})
export class ProvidersModule {}
