import type { LlmRanking, TasteProfileInput } from "@farol/shared";

// Token de injeção do port de LLM.
export const LLM = Symbol("LLM");

// Dado mínimo de um destino da shortlist enviado ao modelo (sem PII).
export interface DestinationSeed {
  iata: string;
  city: string;
  country: string;
  tags: string[];
}

// Só o que o prompt de ranking precisa da viagem (sem PII).
export interface RankTripContext {
  originIata: string;
  budgetTotal: number | null;
  currency: string;
  party: { adults: number };
}

export interface RankDestinationsInput {
  shortlist: DestinationSeed[];
  profile: TasteProfileInput;
  trip: RankTripContext;
}

export interface LlmPort {
  rankDestinations(input: RankDestinationsInput): Promise<LlmRanking>;
}

// Preços aproximados em USD por 1M de tokens — revisar periodicamente.
export const MODEL_PRICING: Record<string, { inUsdPerMTok: number; outUsdPerMTok: number }> = {
  "claude-sonnet-5": { inUsdPerMTok: 3, outUsdPerMTok: 15 },
  "claude-haiku-4-5-20251001": { inUsdPerMTok: 0.8, outUsdPerMTok: 4 }
};

const FALLBACK_PRICE = { inUsdPerMTok: 3, outUsdPerMTok: 15 };

export function estimateUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = MODEL_PRICING[model] ?? FALLBACK_PRICE;
  return (inputTokens * price.inUsdPerMTok + outputTokens * price.outUsdPerMTok) / 1_000_000;
}

export interface LlmCallMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedUsd: number;
  kind: string;
  latencyMs: number;
}

export interface LlmLogger {
  info(metrics: LlmCallMetrics): void;
}

export const consoleLlmLogger: LlmLogger = {
  info: (metrics) => {
    console.info(JSON.stringify({ event: "llm_call", ...metrics }));
  }
};
