import { hotelOfferSchema, type HotelOffer } from "@farol/shared";
import { fillTemplate } from "../template.js";
import { nullIfEmpty } from "../text.js";

/** Hotel do GET /data/hotels. */
export interface LiteApiHotel {
  id: string;
  name: string;
  country: string;
  city: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  zip?: string;
  main_photo?: string;
  thumbnail?: string;
  stars?: number;
  rating?: number;
  reviewCount?: number;
}
export interface LiteApiHotelsResponse {
  data?: LiteApiHotel[];
  hotelIds?: string[];
  total?: number;
}

/** Tarifa mínima do POST /hotels/min-rates. */
export interface LiteApiMinRate {
  hotelId: string;
  price: number;
  suggestedSellingPrice?: number;
  offerId?: string;
}
export interface LiteApiMinRatesResponse {
  data?: LiteApiMinRate[];
  sandbox?: boolean;
}

export interface HotelDeepLinkContext {
  /** Template com {cityCode} {cityName} {checkIn} {checkOut} {adults} {hotelName}. */
  template: string;
  cityCode: string;
  cityName: string;
  checkIn: string;
  checkOut: string;
  adults: number;
}

const MS_PER_DAY = 86_400_000;

// Noites entre as duas datas. Mínimo 1: check-in e check-out no mesmo dia não
// existe como diária, e dividir por zero produziria Infinity no preço/noite.
export function nightsBetween(checkIn: string, checkOut: string): number {
  const nights = Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / MS_PER_DAY);
  return nights < 1 ? 1 : nights;
}

// A LiteAPI avalia de 0 a 10; a UI mostra estrela de 0 a 5.
export function toFiveScale(rating: number | undefined): number | null {
  if (rating === undefined) {
    return null;
  }
  return Math.round((rating / 2) * 10) / 10;
}

export function buildHotelDeepLink(ctx: HotelDeepLinkContext, hotelName: string): string {
  return fillTemplate(ctx.template, {
    cityCode: ctx.cityCode,
    cityName: ctx.cityName,
    checkIn: ctx.checkIn,
    checkOut: ctx.checkOut,
    adults: String(ctx.adults),
    hotelName: encodeURIComponent(hotelName)
  });
}

// Junta conteúdo (/data/hotels) com tarifa (/hotels/min-rates) em HotelOffer[].
// Hotel sem tarifa fica de fora: a tela promete um preço por noite, e mostrar
// um hotel sem preço quebraria o cartão e a comparação.
export function normalizeHotels(
  hotels: LiteApiHotelsResponse,
  rates: LiteApiMinRatesResponse,
  ctx: HotelDeepLinkContext,
  currency: string
): HotelOffer[] {
  const nights = nightsBetween(ctx.checkIn, ctx.checkOut);
  const priceByHotel = new Map((rates.data ?? []).map((rate) => [rate.hotelId, rate.price]));

  const offers: HotelOffer[] = [];
  for (const hotel of hotels.data ?? []) {
    const total = priceByHotel.get(hotel.id);
    if (total === undefined || total <= 0) {
      continue;
    }
    offers.push(
      hotelOfferSchema.parse({
        id: hotel.id,
        name: hotel.name,
        region: nullIfEmpty(hotel.city),
        address: nullIfEmpty(hotel.address),
        pricePerNight: Math.round((total / nights) * 100) / 100,
        priceTotal: total,
        currency,
        rating: toFiveScale(hotel.rating),
        reviewCount: hotel.reviewCount ?? null,
        stars: hotel.stars ?? null,
        photoUrl: nullIfEmpty(hotel.main_photo),
        lat: hotel.latitude ?? null,
        lng: hotel.longitude ?? null,
        deepLink: buildHotelDeepLink(ctx, hotel.name)
      })
    );
  }
  return offers.sort((a, b) => a.pricePerNight - b.pricePerNight);
}
