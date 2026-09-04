import { Body, Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { tripInputSchema, type CurrentUser as CurrentUserType, type TripInput } from "@farol/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { ZodValidationPipe } from "../common/zod.pipe";
import { TripsService } from "./trips.service";
import type { Trip, TripState } from "./trip-state";

@Controller("trips")
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: CurrentUserType,
    @Body(new ZodValidationPipe(tripInputSchema)) body: TripInput
  ): Promise<Trip> {
    return this.trips.create(user.id, body);
  }

  @Get()
  list(@CurrentUser() user: CurrentUserType): Promise<Trip[]> {
    return this.trips.list(user.id);
  }

  @Get(":id")
  get(@CurrentUser() user: CurrentUserType, @Param("id") id: string): Promise<TripState> {
    return this.trips.get(user.id, id);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@CurrentUser() user: CurrentUserType, @Param("id") id: string): Promise<void> {
    return this.trips.remove(user.id, id);
  }
}
