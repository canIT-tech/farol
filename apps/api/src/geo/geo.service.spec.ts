import { describe, it, expect, vi } from "vitest";
import type { GeoProvider } from "@farol/providers";
import { isDomainError, type Airline, type Airport, type GeoLocation } from "@farol/shared";
import { GeoService } from "./geo.service";

const GRU: Airport = {
  iata: "GRU",
  name: "Guarulhos International Airport",
  cityCode: "SAO",
  countryCode: "BR",
  timeZone: "America/Sao_Paulo",
  lat: -23.435555,
  lon: -46.473055,
  flightable: true
};

const LATAM: Airline = { code: "LA", name: "LATAM Airlines", isLowcost: false };

const CHAPECO: GeoLocation = {
  iata: "XAP",
  name: "Chapeco",
  countryName: "Brazil",
  countryCode: "BR",
  lat: -27.100935,
  lon: -52.6157
};

function fakeProvider(overrides: Partial<GeoProvider> = {}): GeoProvider {
  return {
    whereami: vi.fn(() => Promise.resolve(CHAPECO)),
    airport: vi.fn(() => Promise.resolve(GRU)),
    airline: vi.fn(() => Promise.resolve(LATAM)),
    searchAirports: vi.fn(() => Promise.resolve([GRU])),
    ...overrides
  };
}

describe("GeoService.whereami", () => {
  it("devolve a localização do provider", async () => {
    const provider = fakeProvider();
    await expect(new GeoService(provider).whereami("191.240.129.27")).resolves.toEqual(CHAPECO);
    expect(provider.whereami).toHaveBeenCalledWith("191.240.129.27");
  });

  it("devolve null quando o IP não resolve", async () => {
    const service = new GeoService(fakeProvider({ whereami: () => Promise.resolve(null) }));
    await expect(service.whereami("10.0.0.1")).resolves.toBeNull();
  });

  it("devolve null e loga quando o provider falha — o onboarding não pode travar", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const service = new GeoService(
      fakeProvider({ whereami: () => Promise.reject(new Error("503")) })
    );

    await expect(service.whereami("10.0.0.1")).resolves.toBeNull();
    expect(logged.mock.calls[0]![0]).toContain("geo_whereami_failed");
    logged.mockRestore();
  });
});

describe("GeoService.searchAirports", () => {
  it("repassa o termo e o limite padrão", async () => {
    const provider = fakeProvider();
    await expect(new GeoService(provider).searchAirports("gua")).resolves.toEqual([GRU]);
    expect(provider.searchAirports).toHaveBeenCalledWith("gua", 10);
  });

  it("respeita o limite informado", async () => {
    const provider = fakeProvider();
    await new GeoService(provider).searchAirports("gua", 3);
    expect(provider.searchAirports).toHaveBeenCalledWith("gua", 3);
  });
});

describe("GeoService.airport e airline", () => {
  it("devolvem o registro encontrado", async () => {
    const service = new GeoService(fakeProvider());
    await expect(service.airport("GRU")).resolves.toEqual(GRU);
    await expect(service.airline("LA")).resolves.toEqual(LATAM);
  });

  it("lançam not_found quando o código não existe", async () => {
    const service = new GeoService(
      fakeProvider({ airport: () => Promise.resolve(null), airline: () => Promise.resolve(null) })
    );

    const airportErr = await service.airport("ZZZ").catch((e: unknown) => e);
    expect(isDomainError(airportErr)).toBe(true);
    expect((airportErr as Error).message).toContain("ZZZ");

    const airlineErr = await service.airline("ZZ").catch((e: unknown) => e);
    expect(isDomainError(airlineErr)).toBe(true);
    expect((airlineErr as Error).message).toContain("ZZ");
  });
});
