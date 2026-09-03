import type { Airline, Airport, City, GeoLocation } from "@farol/shared";

export type { Airline, Airport, City, GeoLocation };

// Contrato de dados geográficos: origem pelo IP e catálogo de aeroportos e
// companhias. Implementação em travelpayouts/travelpayouts-geo-provider.ts.
export interface GeoProvider {
  whereami(ip: string, locale?: string): Promise<GeoLocation | null>;
  airport(iata: string): Promise<Airport | null>;
  /** Cidade do IATA — dá a coordenada de centro que a busca de hotel usa. */
  city(iata: string): Promise<City | null>;
  airline(code: string): Promise<Airline | null>;
  searchAirports(term: string, limit?: number): Promise<Airport[]>;
}

export function isGeoProvider(x: unknown): x is GeoProvider {
  const methods = ["whereami", "airport", "airline", "city", "searchAirports"] as const;
  return (
    typeof x === "object" &&
    x !== null &&
    methods.every((m) => typeof (x as unknown as Record<string, unknown>)[m] === "function")
  );
}
