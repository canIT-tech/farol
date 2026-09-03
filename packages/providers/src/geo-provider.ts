import type { Airline, Airport, GeoLocation } from "@farol/shared";

export type { Airline, Airport, GeoLocation };

// Contrato de dados geográficos: origem pelo IP e catálogo de aeroportos e
// companhias. Implementação em travelpayouts/travelpayouts-geo-provider.ts.
export interface GeoProvider {
  whereami(ip: string, locale?: string): Promise<GeoLocation | null>;
  airport(iata: string): Promise<Airport | null>;
  airline(code: string): Promise<Airline | null>;
  searchAirports(term: string, limit?: number): Promise<Airport[]>;
}

export function isGeoProvider(x: unknown): x is GeoProvider {
  const methods = ["whereami", "airport", "airline", "searchAirports"] as const;
  return (
    typeof x === "object" &&
    x !== null &&
    methods.every((m) => typeof (x as unknown as Record<string, unknown>)[m] === "function")
  );
}
