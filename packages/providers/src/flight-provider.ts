import type { FlightOffer, FlightSearchParams } from "@farol/shared";

export type { FlightOffer, FlightSearchParams };

// Contrato de provider de voo (design §7.1). Implementação Amadeus em amadeus/.
export interface FlightProvider {
  search(params: FlightSearchParams): Promise<FlightOffer[]>;
}

export function isFlightProvider(x: unknown): x is FlightProvider {
  return (
    typeof x === "object" && x !== null && typeof (x as FlightProvider).search === "function"
  );
}
