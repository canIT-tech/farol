import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import { z } from "zod";
import type {
  CurrentUser as CurrentUserType,
  FlightOffer,
  ProviderSection
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
