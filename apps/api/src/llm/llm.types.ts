import type { z } from "zod";
import type {
  BuildItineraryOutput,
  ItemType,
  LlmRanking,
  Slot,
  TasteProfileInput
} from "@farol/shared";

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

// Item que a versão anterior fixou e que precisa voltar igual na nova versão.
export interface PinnedItem {
  dayIndex: number;
  slot: Slot;
  type: ItemType;
  title: string;
}

export interface BuildItineraryInput {
  destination: { city: string; country: string };
  nights: number;
  pace: TasteProfileInput["pace"];
  interests: string[];
  party: { adults: number; children: number };
  pinned?: PinnedItem[];
}

// Entrada de um turno de chat. tripId é obrigatório: o chat sempre acontece
// dentro de uma viagem, e é o que permite somar custo por roteiro.
export interface LlmChatInput {
  system: string;
  messages: LlmMessage[];
  tools: LlmToolSpec[];
  tripId: string;
}

export interface LlmPort {
  rankDestinations(input: RankDestinationsInput): Promise<LlmRanking>;
  buildItinerary(input: BuildItineraryInput): Promise<BuildItineraryOutput>;
  chat(input: LlmChatInput): Promise<LlmCompletion>;
}

// ---------------------------------------------------------------------------
// Porta neutra de LLM (design 2026-08-31, §D1).
// Nenhum nome de fornecedor nem de biblioteca aparece aqui: é o vocabulário
// do app. Os adaptadores em providers/ traduzem para o formato de cada SDK.
// ---------------------------------------------------------------------------

// Tier de custo. O call site pede tier; a config resolve para provider + modelo.
export type LlmTier = "cheap" | "capable";

// Chamada de tool pedida pelo modelo. Mesma forma que ChatMessageDto já
// persiste em chat_messages — de propósito, para não haver tradução na borda
// do banco.
export interface LlmToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface LlmMessage {
  role: "user" | "assistant" | "tool";
  content: string | null;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
  // Nome da tool numa mensagem de resultado; o SDK precisa dele para casar o
  // resultado com a chamada.
  name?: string;
}

// parameters é zod, não JSON Schema: a mesma definição descreve a tool para o
// modelo e valida o args que volta.
export interface LlmToolSpec {
  name: string;
  description: string;
  parameters: z.ZodType<Record<string, unknown>>;
}

export interface LlmCompletion {
  text: string;
  toolCalls: LlmToolCall[];
  model: string;
  usage: { inputTokens: number; outputTokens: number };
}

export interface LlmCompletionRequest {
  tier: LlmTier;
  kind: string;
  tripId: string | null;
  system: string;
  messages: LlmMessage[];
  tools?: LlmToolSpec[];
}

export interface LlmStructuredRequest<T> {
  tier: LlmTier;
  kind: string;
  tripId: string | null;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
}

// Único contrato que o app conhece.
export interface LlmProvider {
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
  completeStructured<T>(request: LlmStructuredRequest<T>): Promise<T>;
}

// Preços em USD por 1M de tokens, por "<provider>:<model>". O prefixo do
// provider importa porque o mesmo id de modelo pode custar diferente em
// fornecedores diferentes. Conferido em 2026-09-01 na tabela oficial da
// Anthropic (platform.claude.com/docs/en/about-claude/pricing).
//
// Groq: só os gpt-oss entram. Os llama não servem ao produto — no Groq eles
// não têm structured output com JSON schema, só json_object, que a própria doc
// descreve como "may not match your intended schema"; rankDestinations e
// buildItinerary usam generateObject e quebrariam de forma imprevisível. Os
// llama também não têm preço público ("Enterprise / Contact Sales").
// Modelo sem preço conhecido devolve null — melhor do que inventar número, e
// melhor ainda do que zero, que tornaria qualquer teto de orçamento
// inoperante sem avisar.
export const MODEL_PRICING: Record<string, { inUsdPerMTok: number; outUsdPerMTok: number }> = {
  "anthropic:claude-sonnet-5": { inUsdPerMTok: 2, outUsdPerMTok: 10 },
  "anthropic:claude-haiku-4-5-20251001": { inUsdPerMTok: 1, outUsdPerMTok: 5 },
  "groq:openai/gpt-oss-120b": { inUsdPerMTok: 0.15, outUsdPerMTok: 0.6 },
  "groq:openai/gpt-oss-20b": { inUsdPerMTok: 0.075, outUsdPerMTok: 0.3 }
};

export function estimateUsd(
  providerModelKey: string,
  inputTokens: number,
  outputTokens: number
): number | null {
  const price = MODEL_PRICING[providerModelKey];
  if (price === undefined) {
    return null;
  }
  return (inputTokens * price.inUsdPerMTok + outputTokens * price.outUsdPerMTok) / 1_000_000;
}

export interface LlmCallMetrics {
  model: string;
  inputTokens: number;
  outputTokens: number;
  // null quando o modelo nao tem preco publico conhecido.
  estimatedUsd: number | null;
  kind: string;
  latencyMs: number;
  // Sem isto não dá para somar custo por roteiro (Q3 da spec do MVP).
  tripId: string | null;
}

export interface LlmLogger {
  info(metrics: LlmCallMetrics): void;
}

export const consoleLlmLogger: LlmLogger = {
  info: (metrics) => {
    console.info(JSON.stringify({ event: "llm_call", ...metrics }));
  }
};
