import { describe, it, expect } from "vitest";
import {
  TravelpayoutsFlightProvider,
  TravelpayoutsGeoProvider,
  isFlightProvider,
  isHotelProvider,
  isPlacesProvider
} from "@farol/providers";
import { DomainError } from "@farol/shared";
import {
  createFlightProvider,
  createGeoProvider,
  createHotelProvider,
  createPlacesProvider
} from "./provider-factories";
import type { Env } from "../config/env.schema";

const env = {
  TRAVELPAYOUTS_TOKEN: "tok",
  TRAVELPAYOUTS_MARKER: "555",
  TRAVELPAYOUTS_BASE_URL: "https://api.travelpayouts.com",
  TRAVELPAYOUTS_CURRENCY: "brl",
  GEO_DUMP_TTL_SECONDS: 86_400,
  AMADEUS_BASE_URL: "https://test.api.amadeus.com",
  FLIGHT_DEEPLINK_TEMPLATE: "https://x.example.com/{origin}?marker={marker}",
  HOTEL_DEEPLINK_TEMPLATE: "https://x.example.com/{cityCode}",
  GOOGLE_PLACES_KEY: "gkey"
} as unknown as Env;

describe("createFlightProvider", () => {
  it("monta o provider do Travelpayouts", () => {
    const provider = createFlightProvider(env);
    expect(provider).toBeInstanceOf(TravelpayoutsFlightProvider);
    expect(isFlightProvider(provider)).toBe(true);
  });
});

describe("createGeoProvider", () => {
  it("monta o provider de geo com o TTL em milissegundos", () => {
    expect(createGeoProvider(env)).toBeInstanceOf(TravelpayoutsGeoProvider);
  });
});

describe("createPlacesProvider", () => {
  it("monta o provider do Google Places", () => {
    expect(isPlacesProvider(createPlacesProvider(env))).toBe(true);
  });
});

describe("createHotelProvider", () => {
  it("monta o provider da Amadeus quando há credencial", () => {
    const provider = createHotelProvider({
      ...env,
      AMADEUS_CLIENT_ID: "id",
      AMADEUS_CLIENT_SECRET: "secret"
    });
    expect(isHotelProvider(provider)).toBe(true);
  });

  it("recusa a busca quando falta o client id", async () => {
    const provider = createHotelProvider({ ...env, AMADEUS_CLIENT_SECRET: "secret" });
    await expect(
      provider.search({ cityCode: "RIO", checkIn: "2026-09-10", checkOut: "2026-09-15", adults: 2 })
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("recusa a busca quando falta o client secret", async () => {
    const provider = createHotelProvider({ ...env, AMADEUS_CLIENT_ID: "id" });
    const err = await provider
      .search({ cityCode: "RIO", checkIn: "2026-09-10", checkOut: "2026-09-15", adults: 2 })
      .catch((e: unknown) => e);
    expect((err as DomainError).code).toBe("hotel_provider_not_configured");
  });
});
