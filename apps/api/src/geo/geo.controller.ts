import { Controller, Get, Ip, Param, Query } from "@nestjs/common";
import { z } from "zod";
import type { Airline, Airport, GeoLocation } from "@farol/shared";
import { ZodValidationPipe } from "../common/zod.pipe";
import { GeoService } from "./geo.service";

export const airportQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});
export type AirportQuery = z.infer<typeof airportQuerySchema>;

// Rotas públicas: são dados de referência e o /whereami roda antes do login,
// no onboarding, para sugerir a cidade de origem.
@Controller("geo")
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get("whereami")
  whereami(@Ip() ip: string, @Query("ip") override?: string): Promise<GeoLocation | null> {
    return this.geo.whereami(override ?? ip);
  }

  @Get("airports")
  airports(
    @Query(new ZodValidationPipe(airportQuerySchema)) query: AirportQuery
  ): Promise<Airport[]> {
    return this.geo.searchAirports(query.q, query.limit);
  }

  @Get("airports/:iata")
  airport(@Param("iata") iata: string): Promise<Airport> {
    return this.geo.airport(iata);
  }

  @Get("airlines/:code")
  airline(@Param("code") code: string): Promise<Airline> {
    return this.geo.airline(code);
  }
}
