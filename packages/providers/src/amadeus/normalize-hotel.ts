import { hotelOfferSchema, type HotelOffer } from "@farol/shared";
import { fillTemplate } from "./deep-link.js";

const MS_PER_DAY = 86_400_000;
const MIN_RATING = 1;
const MAX_RATING = 5;

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / MS_PER_DAY);
}

interface HotelListEntry {
  hotelId: string;
  address?: { lines?: string[] };
}
interface HotelListResponse {
  data?: HotelListEntry[];
}

interface HotelOfferRaw {
  id: string;
  checkInDate: string;
  checkOutDate: string;
  price: { currency: string; total: string };
}
interface HotelOffersItem {
  hotel: { hotelId: string; name: string; cityCode: string; rating?: string };
  offers: HotelOfferRaw[];
}
interface HotelOffersResponse {
  data?: HotelOffersItem[];
}

export function toRating(raw: string | undefined): number | null {
  if (raw === undefined) {
    return null;
  }
  const value = Number(raw);
  return value >= MIN_RATING && value <= MAX_RATING ? value : null;
}

// Traduz lista da cidade + ofertas do Amadeus para HotelOffer[] (design §7.2).
export function normalizeHotel(
  rawList: unknown,
  rawOffers: unknown,
  deepLinkTemplate: string
): HotelOffer[] {
  const regionById = new Map<string, string | null>();
  for (const entry of (rawList as HotelListResponse).data ?? []) {
    regionById.set(entry.hotelId, entry.address?.lines?.[0] ?? null);
  }

  const results: HotelOffer[] = [];
  for (const item of (rawOffers as HotelOffersResponse).data ?? []) {
    const offer = item.offers[0];
    if (offer === undefined) {
      continue;
    }
    const nights = nightsBetween(offer.checkInDate, offer.checkOutDate);
    if (nights <= 0) {
      continue;
    }
    const priceTotal = Number(offer.price.total);

    results.push(
      hotelOfferSchema.parse({
        id: offer.id,
        name: item.hotel.name,
        region: regionById.get(item.hotel.hotelId) ?? null,
        pricePerNight: Math.round((priceTotal / nights) * 100) / 100,
        priceTotal,
        currency: offer.price.currency,
        rating: toRating(item.hotel.rating),
        deepLink: fillTemplate(deepLinkTemplate, {
          cityCode: item.hotel.cityCode,
          checkIn: offer.checkInDate,
          checkOut: offer.checkOutDate,
          name: item.hotel.name
        })
      })
    );
  }
  return results;
}
