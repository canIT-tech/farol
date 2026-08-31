import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from "@nestjs/common";
import {
  chooseDestinationSchema,
  swapRestaurantSchema,
  type ChooseDestinationInput,
  type CurrentUser as CurrentUserType,
  type Itinerary,
  type ItineraryItem,
  type SwapRestaurantInput
} from "@farol/shared";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod.pipe";
import { ItineraryService } from "./itinerary.service";

@Controller("trips/:id")
@UseGuards(AuthGuard)
export class ItineraryController {
  constructor(private readonly itinerary: ItineraryService) {}

  @Post("destination")
  @HttpCode(202)
  choose(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string,
    @Body(new ZodValidationPipe(chooseDestinationSchema)) body: ChooseDestinationInput
  ): Promise<{ itineraryId: string }> {
    return this.itinerary.chooseDestination(user.id, tripId, body.iata);
  }

  @Get("itinerary")
  latest(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<Itinerary> {
    return this.itinerary.getLatest(user.id, tripId);
  }

  @Post("itinerary/days/:dayIndex/regenerate")
  @HttpCode(202)
  regenerateDay(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string,
    @Param("dayIndex") dayIndex: string
  ): Promise<void> {
    return this.itinerary.regenerateDay(user.id, tripId, Number(dayIndex));
  }

  @Post("itinerary/enrich")
  @HttpCode(202)
  enrich(@CurrentUser() user: CurrentUserType, @Param("id") tripId: string): Promise<void> {
    return this.itinerary.requestEnrich(user.id, tripId);
  }

  @Post("itinerary/items/:itemId/swap-restaurant")
  swapRestaurant(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string,
    @Param("itemId") itemId: string,
    @Body(new ZodValidationPipe(swapRestaurantSchema)) body: SwapRestaurantInput
  ): Promise<ItineraryItem> {
    return this.itinerary.swapRestaurant(user.id, tripId, itemId, body);
  }
}
