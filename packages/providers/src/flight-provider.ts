export interface FlightSearchParams {
  origin: string;
  destination: string;
  departAt: string;
}

export interface FlightOffer {
  price: number;
  currency: string;
}

export interface FlightProvider {
  search(p: FlightSearchParams): Promise<FlightOffer[]>;
}

/**
 * Type guard para FlightProvider. Stub inicial — as implementações Amadeus
 * entram no Plano 5.
 */
export function isFlightProvider(x: unknown): x is FlightProvider {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as FlightProvider).search === "function"
  );
}
