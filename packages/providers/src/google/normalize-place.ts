import { placeSchema, placeDetailsSchema, type Place, type PlaceDetails } from "@farol/shared";

// Faixas de preço do Places API v1, na ordem 0..4 (design §7.1).
// PRICE_LEVEL_UNSPECIFIED fica de fora de propósito: vira null.
const PRICE_LEVELS = [
  "PRICE_LEVEL_FREE",
  "PRICE_LEVEL_INEXPENSIVE",
  "PRICE_LEVEL_MODERATE",
  "PRICE_LEVEL_EXPENSIVE",
  "PRICE_LEVEL_VERY_EXPENSIVE"
] as const;

export function toPriceLevel(raw: string | undefined): number | null {
  const index = PRICE_LEVELS.indexOf(raw as (typeof PRICE_LEVELS)[number]);
  return index === -1 ? null : index;
}

export function toPriceLevelEnum(level: number): string | undefined {
  return PRICE_LEVELS[level];
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  priceLevel?: string;
  types?: string[];
  formattedAddress?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
}

function baseOf(raw: unknown): Record<string, unknown> {
  const p = raw as RawPlace;
  return {
    placeId: p.id,
    name: p.displayName?.text,
    lat: p.location?.latitude,
    lng: p.location?.longitude,
    rating: p.rating ?? null,
    priceLevel: toPriceLevel(p.priceLevel),
    types: p.types ?? []
  };
}

export function normalizePlace(raw: unknown): Place {
  return placeSchema.parse(baseOf(raw));
}

export function normalizePlaceDetails(raw: unknown): PlaceDetails {
  const p = raw as RawPlace;
  return placeDetailsSchema.parse({
    ...baseOf(raw),
    address: p.formattedAddress ?? null,
    openingHours: p.regularOpeningHours?.weekdayDescriptions ?? null
  });
}

// Um lugar malformado não derruba a busca inteira: é descartado (design §7.3).
export function normalizePlaceList(raw: unknown): Place[] {
  const places = (raw as { places?: unknown[] }).places ?? [];
  const results: Place[] = [];
  for (const item of places) {
    const parsed = placeSchema.safeParse(baseOf(item));
    if (parsed.success) {
      results.push(parsed.data);
    }
  }
  return results;
}
