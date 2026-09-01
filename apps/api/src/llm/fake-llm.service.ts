import {
  buildItineraryOutputSchema,
  llmRankingSchema,
  type BuildItineraryOutput,
  type ItemType,
  type Slot,
  type LlmRanking
} from "@farol/shared";
import type {
  BuildItineraryInput,
  LlmChatInput,
  LlmCompletion,
  LlmPort,
  LlmToolCall,
  PinnedItem,
  RankDestinationsInput
} from "./llm.types";

export interface FakeLlmOptions {
  // Quando informado, a PRIMEIRA chamada de chat devolve esta tool call e as
  // seguintes devolvem texto — o suficiente para exercitar o loop sem travá-lo
  // em MAX_TURNS.
  nextToolCall?: LlmToolCall;
}

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
  private chatCalls = 0;

  constructor(private readonly options: FakeLlmOptions = {}) {}

  chat(input: LlmChatInput): Promise<LlmCompletion> {
    this.chatCalls += 1;
    const pending = this.options.nextToolCall;
    const shouldCallTool = pending !== undefined && this.chatCalls === 1;

    return Promise.resolve({
      text: shouldCallTool ? "" : `Resposta determinística de teste para ${input.tripId}.`,
      toolCalls: shouldCallTool ? [pending] : [],
      model: "fake-model",
      usage: { inputTokens: 0, outputTokens: 0 }
    });
  }

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
