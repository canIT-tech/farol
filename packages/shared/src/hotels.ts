import { z } from "zod";
import { isoDateSchema } from "./trip.js";

// Parâmetros de busca de hotel.
export const hotelSearchParamsSchema = z.object({
  cityCode: z.string().min(1),
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  adults: z.number().int().min(1),
  radiusKm: z.number().int().positive().optional()
});
export type HotelSearchParams = z.infer<typeof hotelSearchParamsSchema>;

// Oferta de hotel normalizada devolvida ao web.
export const hotelOfferSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1).nullable(),
  pricePerNight: z.number().positive(),
  priceTotal: z.number().positive(),
  currency: z.string().min(1),
  rating: z.number().min(0).max(5).nullable(),
  deepLink: z.string().url()
});
export type HotelOffer = z.infer<typeof hotelOfferSchema>;

// Seção de resultados de provider com degradação graciosa (design §7.3).
export function providerSectionSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    offers: z.array(item),
    stale: z.boolean(),
    error: z.literal("unavailable").nullable()
  });
}
export type ProviderSection<T> = { offers: T[]; stale: boolean; error: "unavailable" | null };
