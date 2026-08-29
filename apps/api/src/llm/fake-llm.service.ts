import {
  buildItineraryOutputSchema,
  llmRankingSchema,
  type BuildItineraryOutput,
  type ItemType,
  type Slot,
  type LlmRanking
} from "@farol/shared";
import type { BuildItineraryInput, LlmPort, PinnedItem, RankDestinationsInput } from "./llm.types";

const PICKS = 3;

// Um slot por período do dia, sempre na mesma ordem.
const SLOT_PLAN: { slot: Slot; type: ItemType }[] = [
  { slot: "morning", type: "activity" },
  { slot: "afternoon", type: "meal" },
  { slot: "evening", type: "activity" }
];

export function fakeSlotTitle(type: ItemType, city: string, dayIndex: number): string {
  const kind = type === "meal" ? "Refeição" : "Atividade";
  return `${kind} de teste — ${city} dia ${dayIndex}`;
}

// Usado nos testes no lugar do LlmService. Nenhuma chamada de rede.
export class FakeLlmService implements LlmPort {
  rankDestinations(input: RankDestinationsInput): Promise<LlmRanking> {
    const picks = input.shortlist.slice(0, PICKS).map((seed, index) => ({
      iata: seed.iata,
      score: Number((0.9 - index * 0.1).toFixed(2)),
      rationale: `Escolha determinística de teste para ${seed.city} (${seed.iata}).`
    }));
    return Promise.resolve(llmRankingSchema.parse(picks));
  }

  buildItinerary(input: BuildItineraryInput): Promise<BuildItineraryOutput> {
    const findPinned = (dayIndex: number, slot: Slot): PinnedItem | undefined =>
      input.pinned?.find((item) => item.dayIndex === dayIndex && item.slot === slot);

    const days = Array.from({ length: input.nights }, (_, dayOffset) => {
      const dayIndex = dayOffset + 1;
      const slots = SLOT_PLAN.map((plan) => {
        const fixed = findPinned(dayIndex, plan.slot);
        if (fixed !== undefined) {
          return { slot: fixed.slot, type: fixed.type, title: fixed.title };
        }
        return {
          slot: plan.slot,
          type: plan.type,
          title: fakeSlotTitle(plan.type, input.destination.city, dayIndex)
        };
      });
      return { dayIndex, slots };
    });
    return Promise.resolve(buildItineraryOutputSchema.parse({ days }));
  }
}
