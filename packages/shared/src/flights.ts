import { z } from "zod";
import { isoDateSchema } from "./trip.js";

const iata = z.string().length(3);

// Parâmetros de busca de voo (traduzidos para o Travelpayouts na camada de provider).
export const flightSearchParamsSchema = z.object({
  originIata: iata,
  destinationIata: iata,
  departDate: isoDateSchema,
  returnDate: isoDateSchema.optional(),
  adults: z.number().int().min(1),
  children: z.number().int().min(0),
  maxStops: z.number().int().min(0).optional()
});
export type FlightSearchParams = z.infer<typeof flightSearchParamsSchema>;

// Oferta de voo normalizada devolvida ao web.
// carrier/originIata/destinationIata saem do provider; os três campos *Name são
// preenchidos depois, pelo catálogo de aeroportos e companhias — ficam nulos
// quando o código não está no catálogo, e aí a UI mostra o código cru.
export const flightOfferSchema = z.object({
  id: z.string().min(1),
  price: z.number().positive(),
  currency: z.string().min(1),
  carrier: z.string().min(1),
  carrierName: z.string().min(1).nullable().default(null),
  originIata: z.string().length(3),
  originName: z.string().min(1).nullable().default(null),
  destinationIata: z.string().length(3),
  destinationName: z.string().min(1).nullable().default(null),
  stops: z.number().int().min(0),
  departAt: z.string().min(1),
  arriveAt: z.string().min(1),
  returnAt: z.string().min(1).nullable(),
  durationMinutes: z.number().int().min(0),
  deepLink: z.string().url()
});
export type FlightOffer = z.infer<typeof flightOfferSchema>;

// Contexto de preço da rota: "está caro ou barato comprar hoje?".
// Vem do Google Flights, que publica o preço mais baixo do momento, o típico da
// rota e a série do que ela custou nas últimas semanas. Não confundir com o
// calendário por data de partida (RoutePriceSample, do Travelpayouts): aqui a
// data que varia é a da *compra*, não a do voo.
export const flightPriceContextSchema = z.object({
  cheapest: z.number().positive(),
  typical: z.number().positive(),
  /** Quanto o mais barato está acima (+) ou abaixo (−) do típico da rota. */
  delta: z.number(),
  bandLow: z.number().positive(),
  bandHigh: z.number().positive(),
  currency: z.string().min(1),
  history: z.array(
    z.object({
      /** Data da consulta, em ISO curto. */
      at: z.string().min(1),
      price: z.number().positive()
    })
  )
});
export type FlightPriceContext = z.infer<typeof flightPriceContextSchema>;
