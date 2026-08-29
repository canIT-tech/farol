import { DomainError, llmRankingSchema, type LlmRanking } from "@farol/shared";
import {
  estimateUsd,
  type LlmLogger,
  type LlmPort,
  type RankDestinationsInput
} from "./llm.types";
import { RANK_SYSTEM, buildRankUserPrompt } from "./prompts/rank-destinations";

// Superfície mínima do SDK Anthropic que o serviço usa (facilita o fake nos testes).
export interface AnthropicLike {
  messages: {
    create(args: {
      model: string;
      max_tokens: number;
      system: string;
      messages: { role: "user"; content: string }[];
    }): Promise<{
      model: string;
      content: { type: string; text?: string }[];
      usage: { input_tokens: number; output_tokens: number };
    }>;
  };
}

const MAX_ATTEMPTS = 2;
const MAX_TOKENS = 1024;

// Extrai o primeiro array JSON de um texto que pode vir com prosa ou cercas ```.
// Sem colchetes plausíveis, devolve o texto original (o parse a seguir falha e dispara o retry).
export function extractJsonArray(text: string): string {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) {
    return text;
  }
  return text.slice(start, end + 1);
}

type ParseResult = { ok: true; value: LlmRanking } | { ok: false; error: string };

export class LlmService implements LlmPort {
  constructor(
    private readonly client: AnthropicLike,
    private readonly capableModel: string,
    private readonly logger: LlmLogger
  ) {}

  async rankDestinations(input: RankDestinationsInput): Promise<LlmRanking> {
    const allowed = new Set(input.shortlist.map((seed) => seed.iata));
    let previousError: string | undefined;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const startedAt = Date.now();
      const response = await this.client.messages.create({
        model: this.capableModel,
        max_tokens: MAX_TOKENS,
        system: RANK_SYSTEM,
        messages: [{ role: "user", content: buildRankUserPrompt(input, previousError) }]
      });

      const text = response.content.map((block) => block.text ?? "").join("");
      this.logger.info({
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        estimatedUsd: estimateUsd(
          response.model,
          response.usage.input_tokens,
          response.usage.output_tokens
        ),
        kind: "rank_destinations",
        latencyMs: Date.now() - startedAt
      });

      const parsed = this.parseRanking(text, allowed);
      if (parsed.ok) {
        return parsed.value;
      }
      previousError = parsed.error;
    }

    throw new DomainError("llm_invalid_output", "o modelo não devolveu um ranking válido");
  }

  private parseRanking(text: string, allowed: Set<string>): ParseResult {
    let json: unknown;
    try {
      json = JSON.parse(extractJsonArray(text));
    } catch {
      return { ok: false, error: "a resposta não era JSON válido" };
    }

    const result = llmRankingSchema.safeParse(json);
    if (!result.success) {
      return { ok: false, error: result.error.issues.map((issue) => issue.message).join("; ") };
    }

    const strays = result.data.filter((item) => !allowed.has(item.iata)).map((item) => item.iata);
    if (strays.length > 0) {
      return { ok: false, error: `iata fora da shortlist: ${strays.join(", ")}` };
    }

    return { ok: true, value: result.data };
  }
}
