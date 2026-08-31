import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3333),
  SUPABASE_JWKS_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(1),
  LLM_MODEL_CAPABLE: z.string().min(1).default("claude-sonnet-5"),
  LLM_MODEL_CHEAP: z.string().min(1).default("claude-haiku-4-5-20251001"),
  JOBS_SCHEMA: z.string().min(1).default("pgboss"),
  AMADEUS_BASE_URL: z.string().url().default("https://test.api.amadeus.com"),
  AMADEUS_CLIENT_ID: z.string().min(1),
  AMADEUS_CLIENT_SECRET: z.string().min(1),
  FLIGHT_DEEPLINK_TEMPLATE: z
    .string()
    .min(1)
    .default("https://www.google.com/travel/flights?q=voos%20{origin}%20{destination}%20{departDate}"),
  HOTEL_DEEPLINK_TEMPLATE: z
    .string()
    .min(1)
    .default("https://www.google.com/travel/hotels/{cityCode}?checkin={checkIn}&checkout={checkOut}"),
  FLIGHT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(600),
  HOTEL_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  // Google Places (Passo 6). Cache de 24 h: lugar não muda de lugar.
  GOOGLE_PLACES_KEY: z.string().min(1),
  PLACES_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400)
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const r = envSchema.safeParse(raw);
  if (!r.success) {
    const fields = r.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Env inválida: ${fields}`);
  }
  return r.data;
}
