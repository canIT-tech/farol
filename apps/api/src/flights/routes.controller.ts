import { Controller, Get, Query } from "@nestjs/common";
import { z } from "zod";
import {
  isoDateSchema,
  type FlightOffer,
  type ProviderSection,
  type RouteDeal
} from "@farol/shared";
import { ZodValidationPipe } from "../common/zod.pipe";
import { FlightsService } from "./flights.service";

const iata = z.string().length(3);

// Query string chega como texto: o coerce converte antes de validar. Sem ele,
// `adults=2` reprovaria por não ser número.
export const routeMonthsQuerySchema = z.object({
  origin: iata,
  destination: iata,
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0)
});
export type RouteMonthsQuery = z.infer<typeof routeMonthsQuerySchema>;

// `return` ausente é ida só — não é um campo esquecido. O codificador do
// protobuf do Google só acrescenta a perna de volta quando ela existe.
export const routeOffersQuerySchema = routeMonthsQuerySchema.extend({
  depart: isoDateSchema,
  return: isoDateSchema.optional()
});
export type RouteOffersQuery = z.infer<typeof routeOffersQuerySchema>;

/**
 * Busca de voo por rota livre: origem e destino quaisquer, sem passar pelo
 * catálogo de destinos nem por uma viagem. É a única porta para um destino que
 * o catálogo não tem — Sydney, por exemplo.
 *
 * Fica atrás do AuthGuard global de propósito: não há rate limiting no projeto,
 * e rota aberta que consome cota de provider externo é convite.
 */
@Controller("routes")
export class RoutesController {
  constructor(private readonly flights: FlightsService) {}

  /** Melhor preço mês a mês — "quando essa rota é mais barata". Não pede data. */
  @Get("months")
  months(
    @Query(new ZodValidationPipe(routeMonthsQuerySchema)) query: RouteMonthsQuery
  ): Promise<ProviderSection<RouteDeal>> {
    return this.flights.monthsByRoute(
      { originIata: query.origin, destinationIata: query.destination },
      query.adults + query.children
    );
  }

  /** Ofertas reais numa data. Sem `return`, é ida só. */
  @Get("offers")
  offers(
    @Query(new ZodValidationPipe(routeOffersQuerySchema)) query: RouteOffersQuery
  ): Promise<ProviderSection<FlightOffer>> {
    return this.flights.offersByRoute({
      originIata: query.origin,
      destinationIata: query.destination,
      departDate: query.depart,
      returnDate: query.return,
      adults: query.adults,
      children: query.children
    });
  }
}
