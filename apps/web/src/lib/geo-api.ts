import { z } from "zod";
import { airportSchema, geoLocationSchema, type Airport, type GeoLocation } from "@farol/shared";
import { apiFetch } from "./api-client";

// O /geo deixou de ser público: os dois consumidores (nova viagem e modo
// autônomo) já rodam atrás do login, e aberto qualquer um gastava nossa cota do
// Travelpayouts — o /whereami consulta o provider a cada chamada.
export function whereami(token: string, f?: typeof fetch): Promise<GeoLocation | null> {
  return apiFetch({ path: "/geo/whereami", token, schema: geoLocationSchema.nullable() }, f);
}

export function searchAirports(
  token: string,
  term: string,
  f?: typeof fetch
): Promise<Airport[]> {
  return apiFetch(
    {
      path: `/geo/airports?q=${encodeURIComponent(term)}`,
      token,
      schema: z.array(airportSchema)
    },
    f
  );
}
