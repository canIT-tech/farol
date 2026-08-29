import { Inject, Injectable } from "@nestjs/common";
import { LLM, type LlmPort } from "../llm/llm.types";
import { ItineraryRepository } from "./itinerary.repository";

export interface ItineraryRegenerateDayData {
  itineraryId: string;
  dayIndex: number;
}

// Handler do job itinerary.regenerate-day. Registrado no work() só pelo worker.
@Injectable()
export class ItineraryRegenerateDayHandler {
  constructor(
    private readonly repo: ItineraryRepository,
    @Inject(LLM) private readonly llm: LlmPort
  ) {}

  async handle(data: ItineraryRegenerateDayData): Promise<void> {
    const itinerary = await this.repo.getById(data.itineraryId);
    if (!itinerary) {
      throw new Error(`itinerary ${data.itineraryId} não existe`);
    }
    const day = await this.repo.dayOf(data.itineraryId, data.dayIndex);
    if (!day) {
      throw new Error(`dia ${data.dayIndex} não existe no roteiro ${data.itineraryId}`);
    }

    const context = await this.repo.generationContext(itinerary.tripId, itinerary.version);
    const pinned = await this.repo.pinnedOfDay(day.id);
    const output = await this.llm.buildItinerary({ ...context, nights: 1, pinned });
    const pinnedKeys = new Set(pinned.map((item) => `${item.slot}|${item.type}|${item.title}`));
    await this.repo.replaceDayItems(day.id, output.days[0]!.slots, pinnedKeys);
  }
}
