import { z } from "zod";

const iata = z.string().length(3);

// Amostra de preço de uma rota (Travelpayouts /v2/prices/latest e
// /v2/prices/month-matrix). Não é uma oferta comprável — é o preço agregado que
// o Aviasales viu, usado para "quanto costuma custar" e "melhor dia do mês".
export const routePriceSampleSchema = z.object({
  origin: iata,
  destination: iata,
  departDate: z.string().min(1),
  returnDate: z.string().min(1).nullable(),
  price: z.number().positive(),
  currency: z.string().min(1),
  transfers: z.number().int().min(0),
  durationMinutes: z.number().int().min(0),
  gate: z.string().min(1).nullable(),
  foundAt: z.string().min(1).nullable(),
  deepLink: z.string().url()
});
export type RoutePriceSample = z.infer<typeof routePriceSampleSchema>;

// Melhor achado de uma rota, indexado por uma chave. A chave é o mês
// ("2026-09") no /v1/prices/monthly e o IATA do destino no /v1/city-directions —
// os dois endpoints devolvem o mesmo item, só muda o que indexa.
export const routeDealSchema = z.object({
  key: z.string().min(1),
  origin: iata,
  destination: iata,
  airline: z.string().min(1),
  departAt: z.string().min(1),
  returnAt: z.string().min(1).nullable(),
  price: z.number().positive(),
  currency: z.string().min(1),
  flightNumber: z.string().min(1).nullable(),
  transfers: z.number().int().min(0),
  deepLink: z.string().url()
});
export type RouteDeal = z.infer<typeof routeDealSchema>;

// Localização inferida pelo IP (/whereami) — pré-preenche a origem no onboarding.
export const geoLocationSchema = z.object({
  iata: iata,
  name: z.string().min(1),
  countryName: z.string().min(1),
  countryCode: z.string().length(2),
  lat: z.number().nullable(),
  lon: z.number().nullable()
});
export type GeoLocation = z.infer<typeof geoLocationSchema>;

// Aeroporto do dump /data/en/airports.json.
export const airportSchema = z.object({
  iata: iata,
  name: z.string().min(1),
  cityCode: z.string().length(3).nullable(),
  countryCode: z.string().length(2),
  timeZone: z.string().min(1).nullable(),
  lat: z.number().nullable(),
  lon: z.number().nullable(),
  flightable: z.boolean()
});
export type Airport = z.infer<typeof airportSchema>;

// Companhia aérea do dump /data/en/airlines.json — traduz "LA" em "LATAM".
export const airlineSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(1),
  isLowcost: z.boolean()
});
export type Airline = z.infer<typeof airlineSchema>;
