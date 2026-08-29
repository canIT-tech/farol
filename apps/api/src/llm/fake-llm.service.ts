import { llmRankingSchema, type LlmRanking } from "@farol/shared";
import type { LlmPort, RankDestinationsInput } from "./llm.types";

const PICKS = 3;

// Usado nos testes no lugar do LlmService: escolhe os 3 primeiros da shortlist,
// score decrescente, rationale fixa. Nenhuma chamada de rede.
export class FakeLlmService implements LlmPort {
  rankDestinations(input: RankDestinationsInput): Promise<LlmRanking> {
    const picks = input.shortlist.slice(0, PICKS).map((seed, index) => ({
      iata: seed.iata,
      score: Number((0.9 - index * 0.1).toFixed(2)),
      rationale: `Escolha determinística de teste para ${seed.city} (${seed.iata}).`
    }));
    return Promise.resolve(llmRankingSchema.parse(picks));
  }
}
