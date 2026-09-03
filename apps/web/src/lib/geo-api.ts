import { z } from "zod";
import { airportSchema, geoLocationSchema, type Airport, type GeoLocation } from "@farol/shared";
import { apiFetchPublic } from "./api-client";

// O /whereami roda antes do login, na tela de nova viagem, só para sugerir a
// origem. É público e o schema aceita null quando o IP não resolve.
export function whereami(f?: typeof fetch): Promise<GeoLocation | null> {
  return apiFetchPublic({ path: "/geo/whereami", schema: geoLocationSchema.nullable() }, f);
}

export function searchAirports(term: string, f?: typeof fetch): Promise<Airport[]> {
  return apiFetchPublic(
    { path: `/geo/airports?q=${encodeURIComponent(term)}`, schema: z.array(airportSchema) },
    f
  );
}
