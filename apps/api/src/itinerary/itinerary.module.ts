import { Module } from "@nestjs/common";
import { TripsModule } from "../trips/trips.module";
import { ItineraryController } from "./itinerary.controller";
import { ItineraryService } from "./itinerary.service";
import { ItineraryRepository } from "./itinerary.repository";
import { ItineraryGenerateHandler } from "./itinerary-generate.handler";

@Module({
  imports: [TripsModule],
  controllers: [ItineraryController],
  providers: [ItineraryService, ItineraryRepository, ItineraryGenerateHandler],
  exports: [ItineraryRepository, ItineraryGenerateHandler]
})
export class ItineraryModule {}
