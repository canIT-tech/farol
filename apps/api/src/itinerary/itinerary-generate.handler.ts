import { Inject, Injectable } from "@nestjs/common";
import { LLM, type LlmPort } from "../llm/llm.types";
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
    @Inject(LLM) private readonly llm: LlmPort
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
      await this.repo.markReady(data.itineraryId);
    } catch (err) {
      await this.repo.markFailed(data.itineraryId, errorMessage(err));
      throw err;
    }
  }
}
