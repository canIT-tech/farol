import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type {
  CurrentUser as CurrentUserType,
  FlightOffer,
  ProviderSection,
  RouteDeal,
  RoutePriceSample
} from "@farol/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod.pipe";
import { FlightsService } from "./flights.service";
import type { FlightSelection } from "./flight-selection";

export const flightSelectBodySchema = z.object({ offerId: z.string().min(1) });

@Controller("trips/:id/flights")
@UseGuards(AuthGuard)
export class FlightsController {
  constructor(private readonly flights: FlightsService) {}

  @Get()
  search(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<ProviderSection<FlightOffer>> {
    return this.flights.search(user.id, tripId);
  }

  /** Aeroportos vizinhos com preço — "saindo de VCP custa menos". */
  @Get("nearby")
  nearby(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<ProviderSection<FlightOffer>> {
    return this.flights.nearbyOptions(user.id, tripId);
  }

  /** Preço por dia do mês — alimenta o seletor de data do roteiro. */
  @Get("calendar")
  calendar(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<ProviderSection<RoutePriceSample>> {
    return this.flights.priceCalendar(user.id, tripId);
  }

  /** Preços recentes da rota — a faixa de referência mostrada junto da oferta. */
  @Get("latest")
  latest(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<ProviderSection<RoutePriceSample>> {
    return this.flights.latestPrices(user.id, tripId);
  }

  /** Melhor preço mês a mês — responde "quando ir". */
  @Get("months")
  months(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<ProviderSection<RouteDeal>> {
    return this.flights.monthlyPrices(user.id, tripId);
  }

  /** Destinos mais baratos saindo da origem da viagem — sinal para a descoberta. */
  @Get("directions")
  directions(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<ProviderSection<RouteDeal>> {
    return this.flights.cityDirections(user.id, tripId);
  }

  @Post("select")
  @HttpCode(201)
  select(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string,
    @Body(new ZodValidationPipe(flightSelectBodySchema)) body: { offerId: string }
  ): Promise<FlightSelection> {
    return this.flights.select(user.id, tripId, body.offerId);
  }
}
