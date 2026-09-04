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
  // E-mail transacional, mesmo desenho do LLM: opcional, e com provider as
  // outras duas viram obrigatórias. "fake" guarda em memória (testes/E2E).
  EMAIL_PROVIDER: z.enum(["resend", "fake"]).optional(),
  EMAIL_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  JOBS_SCHEMA: z.string().min(1).default("pgboss"),
  // Deploy de serviço único (Render free não tem Background Worker): a api
  // registra os handlers do pg-boss no próprio processo e serve o apps/web como
  // catch-all. Em desenvolvimento os dois ficam desligados — worker e web sobem
  // separados. Enum em vez de coerce.boolean: coerce trata qualquer string não
  // vazia como true, inclusive "false".
  // `aud` exigido no JWT. O Supabase emite "authenticated" para token de
  // usuário. Vazio desliga a checagem.
  SUPABASE_JWT_AUD: z.string().default("authenticated"),
  // Origens liberadas no CORS, separadas por vírgula. Vazio = nenhuma.
  // O default cobre o desenvolvimento (web em :3000, api em :3333, e :3100 do
  // Playwright), onde a chamada é mesmo cross-origin. Em produção a api e o web
  // são a mesma origem, então o render.yaml zera esta lista de propósito —
  // nenhuma requisição cross-origin é legítima lá.
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3100"),
  RUN_JOB_HANDLERS: z.enum(["true", "false"]).default("false"),
  SERVE_WEB: z.enum(["true", "false"]).default("false"),
  // Travelpayouts (Aviasales) — provider de voo do MVP. Sem OAuth: o token vai
  // no header X-Access-Token e o marker de afiliado em todo deep link de saída.
  // Spec: docs/negocio/2026-08-31-spec-migracao-travelpayouts.md
  TRAVELPAYOUTS_TOKEN: z.string().min(1),
  TRAVELPAYOUTS_MARKER: z.string().min(1),
  TRAVELPAYOUTS_BASE_URL: z.string().url().default("https://api.travelpayouts.com"),
  TRAVELPAYOUTS_CURRENCY: z.string().min(1).default("brl"),
  // Dumps de aeroporto/companhia: pesados e praticamente estáticos.
  GEO_DUMP_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  // LiteAPI (Nuitée) — provider de hotel, no lugar do Hotellook (encerrado em
  // 20/10/2025) e da Amadeus (Self-Service descontinuado). Conteúdo e tarifa
  // são gratuitos; a chave de sandbox começa com "sand_".
  LITEAPI_KEY: z.string().min(1),
  LITEAPI_BASE_URL: z.string().url().default("https://api.liteapi.travel/v3.0"),
  LITEAPI_CURRENCY: z.string().min(1).default("BRL"),
  /** Nacionalidade do hóspede: muda tarifa e imposto na LiteAPI. */
  LITEAPI_GUEST_NATIONALITY: z.string().length(2).default("BR"),
  /** Raio da busca em volta do centro da cidade. Mínimo aceito pela LiteAPI: 1 km. */
  HOTEL_SEARCH_RADIUS_METERS: z.coerce.number().int().min(1000).default(5000),
  FLIGHT_DEEPLINK_TEMPLATE: z
    .string()
    .min(1)
    .default(
      "https://www.aviasales.com/search/{origin}{departDdmm}{destination}{returnDdmm}{passengers}?marker={marker}"
    ),
  HOTEL_DEEPLINK_TEMPLATE: z
    .string()
    .min(1)
    .default(
      "https://www.google.com/travel/hotels/{cityName}?q={hotelName}&checkin={checkIn}&checkout={checkOut}"
    ),
  // Preço do Travelpayouts é cacheado na origem e muda devagar (spec §6).
  FLIGHT_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(1800),
  HOTEL_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(3600),
  // Google Flights — fonte primária de oferta de voo. Não é uma API: a busca
  // vai num parâmetro protobuf e a resposta é lida de um <script> da página
  // pública. Dá preço e horário reais, que o cache do Travelpayouts não dá, mas
  // não tem SLA nem contrato — por isso roda sempre atrás do
  // FallbackFlightProvider, que cai no Travelpayouts se o layout mudar.
  // Sem credencial: não há chave nem afiliado envolvidos.
  GOOGLE_FLIGHTS_ENABLED: z.enum(["true", "false"]).default("true"),
  GOOGLE_FLIGHTS_BASE_URL: z.string().url().default("https://www.google.com/travel/flights"),
  /** Idioma da página: muda os nomes de aeroporto e companhia devolvidos. */
  GOOGLE_FLIGHTS_LOCALE: z.string().min(1).default("pt-BR"),
  GOOGLE_FLIGHTS_CURRENCY: z.string().min(1).default("BRL"),
  // Google Places (Passo 6). Cache de 24 h: lugar não muda de lugar.
  GOOGLE_PLACES_KEY: z.string().min(1),
  PLACES_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400)
});

type BaseEnv = z.infer<typeof baseEnvSchema>;

// Com provider real definido, os campos listados viram obrigatórios.
// "fake" e ausente não exigem nada.
function requireWithProvider(
  env: BaseEnv,
  ctx: z.RefinementCtx,
  providerField: "LLM_PROVIDER" | "EMAIL_PROVIDER",
  fields: readonly (keyof BaseEnv)[]
): void {
  const provider = env[providerField];
  if (provider === undefined || provider === "fake") {
    return;
  }
  for (const field of fields) {
    if (env[field] === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} é obrigatória quando ${providerField} está definida`
      });
    }
  }
}

export const envSchema = baseEnvSchema.superRefine((env, ctx) => {
  requireWithProvider(env, ctx, "LLM_PROVIDER", ["LLM_API_KEY", "LLM_MODEL_CAPABLE", "LLM_MODEL_CHEAP"]);
  requireWithProvider(env, ctx, "EMAIL_PROVIDER", ["EMAIL_API_KEY", "EMAIL_FROM"]);
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
