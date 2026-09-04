import { Body, Controller, Get, HttpCode, Param, Post } from "@nestjs/common";
import { z } from "zod";
import type {
  CurrentUser as CurrentUserType,
  HotelOffer,
  ProviderSection
} from "@farol/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod.pipe";
import { HotelsService } from "./hotels.service";
import type { HotelSelection } from "./hotel-selection";

export const hotelSelectBodySchema = z.object({ offerId: z.string().min(1) });

@Controller("trips/:id/hotels")
export class HotelsController {
  constructor(private readonly hotels: HotelsService) {}

  @Get()
  search(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<ProviderSection<HotelOffer>> {
    return this.hotels.search(user.id, tripId);
  }

  @Post("select")
  @HttpCode(201)
  select(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string,
    @Body(new ZodValidationPipe(hotelSelectBodySchema)) body: { offerId: string }
  ): Promise<HotelSelection> {
    return this.hotels.select(user.id, tripId, body.offerId);
  }
}
