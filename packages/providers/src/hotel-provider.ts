import type { HotelOffer, HotelSearchParams } from "@farol/shared";

export type { HotelOffer, HotelSearchParams };

// Contrato de provider de hotel (design §7.1). Implementação Amadeus em amadeus/.
export interface HotelProvider {
  search(params: HotelSearchParams): Promise<HotelOffer[]>;
}

export function isHotelProvider(x: unknown): x is HotelProvider {
  return (
    typeof x === "object" && x !== null && typeof (x as HotelProvider).search === "function"
  );
}
