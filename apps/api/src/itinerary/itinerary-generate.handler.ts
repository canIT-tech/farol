import { Inject, Injectable } from "@nestjs/common";
import type { Database } from "@farol/db";
import { DB } from "../db/db.module";
import { LLM, type LlmPort } from "../llm/llm.types";
import { PlacesService } from "../places/places.service";
import { enrichItinerary } from "./enrich-itinerary";
import { ItineraryRepository } from "./itinerary.repository";

export interface ItineraryGenerateData {
  itineraryId: string;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Handler do job itinerary.generate. Registrado no work() só pelo worker (Passo 4 Task 6).
@Injectable()
export class ItineraryGenerateHandler {
  constructor(
    private readonly repo: ItineraryRepository,
    @Inject(LLM) private readonly llm: LlmPort,
    @Inject(DB) private readonly db: Database,
    private readonly places: PlacesService
  ) {}

  async handle(data: ItineraryGenerateData): Promise<void> {
    const itinerary = await this.repo.getById(data.itineraryId);
    if (!itinerary) {
      throw new Error(`itinerary ${data.itineraryId} não existe`);
    }

    try {
      const context = await this.repo.generationContext(itinerary.tripId, itinerary.version);
      const output = await this.llm.buildItinerary(context);
      await this.repo.replaceDays(data.itineraryId, output.days, context.pinned);
      await this.enrich(
        data.itineraryId,
        `${context.destination.city}, ${context.destination.country}`
      );
      await this.repo.markReady(data.itineraryId);
    } catch (err) {
      await this.repo.markFailed(data.itineraryId, errorMessage(err));
      throw err;
    }
  }

  // O enrich é acessório: se o Places cair, o roteiro fica ready mesmo assim,
  // com os itens marcados needsReview (design §7.3). O job places.enrich retenta.
  private async enrich(itineraryId: string, cityQueryHint: string): Promise<void> {
    try {
      await enrichItinerary({ db: this.db, places: this.places }, itineraryId, cityQueryHint);
    } catch (err) {
      console.error(
        JSON.stringify({
          event: "itinerary_enrich_failed",
          itineraryId,
          message: errorMessage(err)
        })
      );
    }
  }
}
