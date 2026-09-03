import { z } from "zod";
import { isoDateSchema } from "./trip.js";

// Parâmetros de busca de hotel.
// A busca por coordenada é a preferida: nome de cidade depende do idioma
// ("Lisboa" acha 2 hotéis, "Lisbon" acha 6.748). cityName fica como recurso
// quando o destino não tem coordenada no catálogo.
export const hotelSearchParamsSchema = z.object({
  cityCode: z.string().min(1),
  countryCode: z.string().length(2),
  cityName: z.string().min(1).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  radiusMeters: z.number().int().min(1000).optional(),
  checkIn: isoDateSchema,
  checkOut: isoDateSchema,
  adults: z.number().int().min(1)
});
export type HotelSearchParams = z.infer<typeof hotelSearchParamsSchema>;

// Oferta de hotel normalizada devolvida ao web.
// rating é normalizado para a escala de 0 a 5 (a estrela da UI); stars é a
// classificação oficial do hotel, que é outra coisa e pode não existir.
export const hotelOfferSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  region: z.string().min(1).nullable(),
  address: z.string().min(1).nullable().default(null),
  pricePerNight: z.number().positive(),
  priceTotal: z.number().positive(),
  currency: z.string().min(1),
  rating: z.number().min(0).max(5).nullable(),
  reviewCount: z.number().int().min(0).nullable().default(null),
  stars: z.number().int().min(0).max(5).nullable().default(null),
  photoUrl: z.string().url().nullable().default(null),
  lat: z.number().nullable().default(null),
  lng: z.number().nullable().default(null),
  deepLink: z.string().url()
});
export type HotelOffer = z.infer<typeof hotelOfferSchema>;

// Seção de resultados de provider com degradação graciosa (design §7.3).
// fetchedAt é o instante em que o dado veio do provider (do provider_cache
// quando é acerto de cache) — é o que permite dizer "preços de 8 min atrás".
export function providerSectionSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    offers: z.array(item),
    stale: z.boolean(),
    fetchedAt: z.string().min(1).nullable().default(null),
    error: z.literal("unavailable").nullable()
  });
}
export type ProviderSection<T> = {
  offers: T[];
  stale: boolean;
  fetchedAt: string | null;
  error: "unavailable" | null;
};
