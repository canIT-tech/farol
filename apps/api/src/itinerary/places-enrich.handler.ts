import { Inject, Injectable } from "@nestjs/common";
import type { Database } from "@farol/db";
import { DB } from "../db/db.module";
import { PlacesService } from "../places/places.service";
import { enrichItinerary } from "./enrich-itinerary";
import { ItineraryRepository } from "./itinerary.repository";

export interface PlacesEnrichData {
  itineraryId: string;
}

// Handler do job places.enrich: reprocessa o que ficou sem lugar na geração.
// Não precisa filtrar por needsReview — enrichItinerary já pula item que tem
// placeId, então só os pendentes são rebuscados.
@Injectable()
export class PlacesEnrichHandler {
  constructor(
    private readonly repo: ItineraryRepository,
    @Inject(DB) private readonly db: Database,
    private readonly places: PlacesService
  ) {}

  async handle(data: PlacesEnrichData): Promise<void> {
    const hint = await this.repo.destinationHint(data.itineraryId);
    if (hint === null) {
      throw new Error(`itinerary ${data.itineraryId} não tem destino escolhido`);
    }
    await enrichItinerary({ db: this.db, places: this.places }, data.itineraryId, hint);
  }
}
