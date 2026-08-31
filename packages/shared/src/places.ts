import { z } from "zod";

// Tipos de lugar que o enrich do roteiro consulta (design §6.3 passo b).
export const placeTypeEnum = z.enum(["restaurant", "tourist_attraction", "point_of_interest"]);
export type PlaceType = z.infer<typeof placeTypeEnum>;

// Faixa de preço do Google Places: 0 (grátis) a 4 (caríssimo).
const priceLevelSchema = z.number().int().min(0).max(4);

// Parâmetros de busca textual no Places.
export const placesTextSearchParamsSchema = z.object({
  query: z.string().min(2).max(200),
  near: z.object({ lat: z.number(), lng: z.number() }).optional(),
  type: placeTypeEnum.optional(),
  minPrice: priceLevelSchema.optional(),
  maxPrice: priceLevelSchema.optional()
});
export type PlacesTextSearchParams = z.infer<typeof placesTextSearchParamsSchema>;

// Lugar normalizado. rating/priceLevel são nulos quando o Places não traz.
export const placeSchema = z.object({
  placeId: z.string().min(1),
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
  rating: z.number().min(0).max(5).nullable(),
  priceLevel: priceLevelSchema.nullable(),
  types: z.array(z.string())
});
export type Place = z.infer<typeof placeSchema>;

// Detalhe de um lugar (Place Details), usado pelo chat do Passo 7.
export const placeDetailsSchema = placeSchema.extend({
  address: z.string().nullable(),
  openingHours: z.array(z.string()).nullable()
});
export type PlaceDetails = z.infer<typeof placeDetailsSchema>;
