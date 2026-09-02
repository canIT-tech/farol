import {
  DomainError,
  buildItineraryOutputSchema,
  llmRankingResponseSchema,
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
    // Envelope de objeto por exigência do structured output da Groq; o domínio
    // continua trabalhando com a lista.
    const { picks: ranking } = await this.provider.completeStructured({
      tier: "capable",
      kind: "rank_destinations",
      tripId: null,
      system: RANK_SYSTEM,
      prompt: buildRankUserPrompt(input),
      schema: llmRankingResponseSchema
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

  // Tier barato: o chat é a chamada de maior volume (vários turnos por viagem)
  // e a que menos exige do modelo. Era o único ponto previsto para o tier na
  // spec de LLM, e sem ele LLM_MODEL_CHEAP seria env obrigatória sem chamador.
  chat(input: LlmChatInput): Promise<LlmCompletion> {
    return this.provider.complete({
      tier: "cheap",
      kind: "chat",
      tripId: input.tripId,
      system: input.system,
      messages: input.messages,
      tools: input.tools
    });
  }
}
