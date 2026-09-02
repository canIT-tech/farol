import { z } from "zod";

// Destino candidato completo, como a api devolve ao web (design §6.2).
export const destinationCandidateSchema = z.object({
  iata: z.string().length(3),
  city: z.string().min(1),
  country: z.string().min(1),
  score: z.number().min(0).max(1),
  rationale: z.string().min(10).max(400),
  estCost: z.object({
    flight: z.number().nonnegative(),
    lodgingPerNight: z.number().nonnegative(),
    dailyLocal: z.number().nonnegative(),
    currency: z.string().min(1)
  }),
  climate: z.object({
    // null quando nao ha fonte de clima. Nunca inventar numero: a marca se
    // define como honesta sobre incerteza.
    expectedC: z.number().nullable(),
    summary: z.string().min(1),
    bestMonths: z.array(z.number().int().min(1).max(12))
  }),
  flightTimeHours: z.number().nonnegative().nullable()
});
export type DestinationCandidate = z.infer<typeof destinationCandidateSchema>;

// Forma exata que o Claude devolve na descoberta: 3 a 5 destinos escolhidos da shortlist.
export const llmRankingItemSchema = z.object({
  iata: z.string().length(3),
  score: z.number().min(0).max(1),
  rationale: z.string().min(10).max(400)
});
export const llmRankingSchema = z.array(llmRankingItemSchema).min(3).max(5);
// Envelope de objeto para a chamada estruturada: a Groq recusa schema cujo
// topo seja array ("schema must have type object"). O domínio segue falando em
// lista; o envelope existe só na fronteira do provider.
export const llmRankingResponseSchema = z.object({ picks: llmRankingSchema });
export type LlmRankingResponse = z.infer<typeof llmRankingResponseSchema>;
export type LlmRankingItem = z.infer<typeof llmRankingItemSchema>;
export type LlmRanking = z.infer<typeof llmRankingSchema>;
