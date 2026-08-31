import type { Place, PlaceDetails, PlacesTextSearchParams } from "@farol/shared";

export type { Place, PlaceDetails, PlacesTextSearchParams };

// Contrato de provider de lugares (design §7.1). Implementação Google em google/.
export interface PlacesProvider {
  textSearch(params: PlacesTextSearchParams): Promise<Place[]>;
  details(placeId: string): Promise<PlaceDetails>;
}

export function isPlacesProvider(x: unknown): x is PlacesProvider {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as PlacesProvider).textSearch === "function" &&
    typeof (x as PlacesProvider).details === "function"
  );
}
