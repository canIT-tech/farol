import { z } from "zod";

const baseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().int().positive().default(3333),
  SUPABASE_JWKS_URL: z.string().url(),
  // LLM (design 2026-08-31, §D4.1). Todas opcionais: a aplicação sobe sem IA
  // configurada, e só os fluxos de IA recusam (llm_not_configured, 503).
  // Se LLM_PROVIDER vier, as outras três passam a ser obrigatórias — meia
  // configuração é erro de boot, não falha no meio de um job.
  // "fake" é o provider determinístico do E2E: sobe a api sem chamar rede.
  LLM_PROVIDER: z.enum(["anthropic", "groq", "openai", "fake"]).optional(),
  LLM_API_KEY: z.string().min(1).optional(),
  LLM_MODEL_CAPABLE: z.string().min(1).optional(),
  LLM_MODEL_CHEAP: z.string().min(1).optional(),
  JOBS_SCHEMA: z.string().min(1).default("pgboss"),
  // Deploy de serviço único (Render free não tem Background Worker): a api
  // registra os handlers do pg-boss no próprio processo e serve o apps/web como
  // catch-all. Em desenvolvimento os dois ficam desligados — worker e web sobem
  // separados. Enum em vez de coerce.boolean: coerce trata qualquer string não
  // vazia como true, inclusive "false".
  RUN_JOB_HANDLERS: z.enum(["true", "false"]).default("false"),
  SERVE_WEB: z.enum(["true", "false"]).default("false"),
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

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  if (env.LLM_PROVIDER === undefined || env.LLM_PROVIDER === "fake") {
    return;
  }
  for (const field of ["LLM_API_KEY", "LLM_MODEL_CAPABLE", "LLM_MODEL_CHEAP"] as const) {
    if (env[field] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} é obrigatória quando LLM_PROVIDER está definida`
      });
    }
  }
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
