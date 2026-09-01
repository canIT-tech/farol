import { Module } from "@nestjs/common";
import { PlacesModule } from "../places/places.module";
import { TripsModule } from "../trips/trips.module";
import { ItineraryController } from "./itinerary.controller";
import { ItineraryService } from "./itinerary.service";
import { ItineraryRepository } from "./itinerary.repository";
import { ItineraryGenerateHandler } from "./itinerary-generate.handler";
import { ItineraryRegenerateDayHandler } from "./itinerary-regenerate-day.handler";
import { PlacesEnrichHandler } from "./places-enrich.handler";

@Module({
  imports: [TripsModule, PlacesModule],
  controllers: [ItineraryController],
  providers: [
    ItineraryService,
    ItineraryRepository,
    ItineraryGenerateHandler,
    ItineraryRegenerateDayHandler,
    PlacesEnrichHandler
  ],
  exports: [
    // ChatModule injeta ItineraryService no ChatToolService (tools do Passo 7).
    ItineraryService,
    ItineraryRepository,
    ItineraryGenerateHandler,
    ItineraryRegenerateDayHandler,
    PlacesEnrichHandler
  ]
})
export class ItineraryModule {}
