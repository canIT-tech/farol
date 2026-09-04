import { Controller, HttpCode, Param, Post } from "@nestjs/common";
import type { CurrentUser as CurrentUserType, DestinationCandidate } from "@farol/shared";
import { CurrentUser } from "../auth/current-user.decorator";
import { DiscoveryService } from "./discovery.service";

@Controller("trips/:id/discovery")
export class DiscoveryController {
  constructor(private readonly discovery: DiscoveryService) {}

  @Post()
  @HttpCode(200)
  run(
    @CurrentUser() user: CurrentUserType,
    @Param("id") tripId: string
  ): Promise<DestinationCandidate[]> {
    return this.discovery.run(user.id, tripId);
  }
}
