import {
  hotelSearchParamsSchema,
  type HotelOffer,
  type HotelSearchParams
} from "@farol/shared";
import type { HotelProvider } from "../hotel-provider";
import { createAmadeusHttp, type AmadeusHttp, type AmadeusHttpConfig } from "./http";
import { normalizeHotel } from "./normalize-hotel";

export interface AmadeusHotelProviderConfig extends AmadeusHttpConfig {
  deepLinkTemplate: string;
  http?: AmadeusHttp;
}

const HOTELS_BY_CITY_PATH = "/v1/reference-data/locations/hotels/by-city";
const HOTEL_OFFERS_PATH = "/v3/shopping/hotel-offers";
const MAX_HOTELS = 20;

interface HotelListResponse {
  data?: { hotelId: string }[];
}

export class AmadeusHotelProvider implements HotelProvider {
  private readonly http: AmadeusHttp;

  constructor(private readonly cfg: AmadeusHotelProviderConfig) {
    this.http = cfg.http ?? createAmadeusHttp(cfg);
  }

  async search(params: HotelSearchParams): Promise<HotelOffer[]> {
    const p = hotelSearchParamsSchema.parse(params);

    const listQuery: Record<string, string> = { cityCode: p.cityCode };
    if (p.radiusKm !== undefined) {
      listQuery.radius = String(p.radiusKm);
      listQuery.radiusUnit = "KM";
    }
    const list = await this.http.get<HotelListResponse>(HOTELS_BY_CITY_PATH, listQuery);

    const hotelIds = (list.data ?? []).map((entry) => entry.hotelId).slice(0, MAX_HOTELS);
    if (hotelIds.length === 0) {
      return [];
    }

    const offers = await this.http.get(HOTEL_OFFERS_PATH, {
      hotelIds: hotelIds.join(","),
      checkInDate: p.checkIn,
      checkOutDate: p.checkOut,
      adults: String(p.adults)
    });

    return normalizeHotel(list, offers, this.cfg.deepLinkTemplate).sort(
      (a, b) => a.pricePerNight - b.pricePerNight
    );
  }
}
