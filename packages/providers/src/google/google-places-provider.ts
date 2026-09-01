import {
  placesTextSearchParamsSchema,
  type Place,
  type PlaceDetails,
  type PlacesTextSearchParams
} from "@farol/shared";
import type { PlacesProvider } from "../places-provider.js";
import { normalizePlaceDetails, normalizePlaceList, toPriceLevelEnum } from "./normalize-place.js";

export interface GooglePlacesProviderConfig {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

const DEFAULT_BASE_URL = "https://places.googleapis.com";
const SEARCH_PATH = "/v1/places:searchText";
const SEARCH_FIELDS =
  "places.id,places.displayName,places.location,places.rating,places.priceLevel,places.types";
const DETAILS_FIELDS =
  "id,displayName,location,rating,priceLevel,types,formattedAddress,regularOpeningHours";
// Raio do locationBias quando o enrich pede "perto do centro do dia" (design §6.3).
const NEAR_RADIUS_M = 3000;

export class GooglePlacesHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string
  ) {
    super(`Google Places respondeu ${status}`);
    this.name = "GooglePlacesHttpError";
  }
}

// Faixa de preço 0..4 → enums do Places. Faixa vazia/invertida = sem filtro.
export function priceLevelsBetween(
  min: number | undefined,
  max: number | undefined
): string[] {
  if (min === undefined && max === undefined) {
    return [];
  }
  const levels: string[] = [];
  for (let level = min ?? 0; level <= (max ?? 4); level += 1) {
    const name = toPriceLevelEnum(level);
    if (name !== undefined) {
      levels.push(name);
    }
  }
  return levels;
}

// Places API v1 (design §7.1). Autenticação por API key no header, sem OAuth —
// por isso não reusa o cliente HTTP do Amadeus. A degradação em caso de falha
// fica no PlacesService da api (design §7.3).
export class GooglePlacesProvider implements PlacesProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly cfg: GooglePlacesProviderConfig) {
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.baseUrl = cfg.baseUrl ?? DEFAULT_BASE_URL;
  }

  async textSearch(params: PlacesTextSearchParams): Promise<Place[]> {
    const p = placesTextSearchParamsSchema.parse(params);

    const body: Record<string, unknown> = { textQuery: p.query };
    if (p.type !== undefined) {
      body.includedType = p.type;
    }
    if (p.near !== undefined) {
      body.locationBias = {
        circle: {
          center: { latitude: p.near.lat, longitude: p.near.lng },
          radius: NEAR_RADIUS_M
        }
      };
    }
    const priceLevels = priceLevelsBetween(p.minPrice, p.maxPrice);
    if (priceLevels.length > 0) {
      body.priceLevels = priceLevels;
    }

    const raw = await this.call(SEARCH_PATH, SEARCH_FIELDS, {
      method: "POST",
      body: JSON.stringify(body)
    });
    return normalizePlaceList(raw);
  }

  async details(placeId: string): Promise<PlaceDetails> {
    const raw = await this.call(`/v1/places/${encodeURIComponent(placeId)}`, DETAILS_FIELDS, {
      method: "GET"
    });
    return normalizePlaceDetails(raw);
  }

  private async call(path: string, fieldMask: string, init: RequestInit): Promise<unknown> {
    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        "X-Goog-Api-Key": this.cfg.apiKey,
        "X-Goog-FieldMask": fieldMask
      }
    });
    if (!res.ok) {
      throw new GooglePlacesHttpError(res.status, await res.text());
    }
    return res.json();
  }
}
