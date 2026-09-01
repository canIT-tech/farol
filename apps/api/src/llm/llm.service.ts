import {
  DomainError,
  buildItineraryOutputSchema,
  llmRankingSchema,
  type BuildItineraryOutput,
  type LlmRanking
} from "@farol/shared";
import type {
  BuildItineraryInput,
  LlmChatInput,
  LlmCompletion,
  LlmPort,
  LlmProvider,
  RankDestinationsInput
} from "./llm.types";
import { RANK_SYSTEM, buildRankUserPrompt } from "./prompts/rank-destinations";
import { BUILD_ITINERARY_SYSTEM, buildItineraryUserPrompt } from "./prompts/build-itinerary";

// Regra de negócio da camada de LLM. Não conhece fornecedor nem biblioteca:
// fala só a porta. A saída é forçada por schema no provider, então aqui não há
// parser de JSON nem retry — o que sobra é regra de domínio.
export class LlmService implements LlmPort {
  constructor(private readonly provider: LlmProvider) {}

  async rankDestinations(input: RankDestinationsInput): Promise<LlmRanking> {
    const ranking = await this.provider.completeStructured({
      tier: "capable",
      kind: "rank_destinations",
      tripId: null,
      system: RANK_SYSTEM,
      prompt: buildRankUserPrompt(input),
      schema: llmRankingSchema
    });

    // O schema garante a forma, não que o modelo ficou dentro da shortlist.
    // Isso é regra de domínio, e o lugar dela é aqui, não num parser.
    const allowed = new Set(input.shortlist.map((seed) => seed.iata));
    const strays = ranking.filter((item) => !allowed.has(item.iata)).map((item) => item.iata);
    if (strays.length > 0) {
      throw new DomainError(
        "llm_invalid_output",
        `o modelo escolheu destino fora da shortlist: ${strays.join(", ")}`
      );
    }

    return ranking;
  }

  buildItinerary(input: BuildItineraryInput): Promise<BuildItineraryOutput> {
    return this.provider.completeStructured({
      tier: "capable",
      kind: "build_itinerary",
      tripId: null,
      system: BUILD_ITINERARY_SYSTEM,
      prompt: buildItineraryUserPrompt(input),
      schema: buildItineraryOutputSchema
    });
  }

  chat(input: LlmChatInput): Promise<LlmCompletion> {
    return this.provider.complete({
      tier: "capable",
      kind: "chat",
      tripId: input.tripId,
      system: input.system,
      messages: input.messages,
      tools: input.tools
    });
  }
}
